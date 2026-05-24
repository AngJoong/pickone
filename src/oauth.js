import { randomBytes } from 'node:crypto';
import { AppError } from './store.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const pendingStates = new Map();

const PROVIDERS = {
  google: {
    label: 'Google',
    clientIdEnv: ['GOOGLE_CLIENT_ID'],
    clientSecretEnv: ['GOOGLE_CLIENT_SECRET'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid profile email',
    tokenMethod: 'POST',
    extraAuthParams: { prompt: 'select_account' },
    mapProfile(profile) {
      return {
        subject: profile.sub,
        email: profile.email,
        displayName: profile.name || profile.email || `Google ${profile.sub}`,
      };
    },
  },
  naver: {
    label: 'Naver',
    clientIdEnv: ['NAVER_CLIENT_ID'],
    clientSecretEnv: ['NAVER_CLIENT_SECRET'],
    authUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    profileUrl: 'https://openapi.naver.com/v1/nid/me',
    tokenMethod: 'GET',
    mapProfile(profile) {
      const response = profile.response ?? {};
      return {
        subject: response.id,
        email: response.email,
        displayName: response.nickname || response.name || response.email || `Naver ${response.id}`,
      };
    },
  },
  kakao: {
    label: 'Kakao',
    clientIdEnv: ['KAKAO_REST_API_KEY', 'KAKAO_CLIENT_ID'],
    clientSecretEnv: ['KAKAO_CLIENT_SECRET'],
    clientSecretOptional: true,
    authUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    profileUrl: 'https://kapi.kakao.com/v2/user/me',
    scope: 'profile_nickname account_email',
    tokenMethod: 'POST',
    mapProfile(profile) {
      const account = profile.kakao_account ?? {};
      const kakaoProfile = account.profile ?? {};
      return {
        subject: profile.id ? String(profile.id) : null,
        email: account.email,
        displayName: kakaoProfile.nickname || account.email || `Kakao ${profile.id}`,
      };
    },
  },
};

function envValue(names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return null;
}

function providerConfig(providerId, origin) {
  const provider = PROVIDERS[providerId];
  if (!provider) return null;
  const clientId = envValue(provider.clientIdEnv);
  const clientSecret = envValue(provider.clientSecretEnv);
  const redirectUri = process.env[`${providerId.toUpperCase()}_REDIRECT_URI`]
    || `${origin}/auth/${providerId}/callback`;
  const missing = [];
  if (!clientId) missing.push(provider.clientIdEnv.join(' or '));
  if (!clientSecret && !provider.clientSecretOptional) missing.push(provider.clientSecretEnv.join(' or '));

  return {
    ...provider,
    id: providerId,
    clientId,
    clientSecret,
    configured: missing.length === 0,
    missing,
    redirectUri,
  };
}

function publicProvider(providerId, origin) {
  const config = providerConfig(providerId, origin);
  return {
    id: providerId,
    label: config.label,
    configured: config.configured,
    loginUrl: `/auth/${providerId}`,
    callbackPath: `/auth/${providerId}/callback`,
    missing: config.missing,
  };
}

function purgeExpiredStates() {
  const expiresBefore = Date.now() - STATE_TTL_MS;
  for (const [state, pending] of pendingStates.entries()) {
    if (pending.createdAt < expiresBefore) pendingStates.delete(state);
  }
}

function requireProvider(providerId, origin) {
  const config = providerConfig(providerId, origin);
  if (!config) {
    throw new AppError(404, 'unknown_oauth_provider', 'OAuth provider was not found.');
  }
  if (!config.configured) {
    throw new AppError(501, 'oauth_not_configured', `${config.label} login is not configured.`);
  }
  return config;
}

export function getPublicOAuthProviders(origin) {
  return Object.keys(PROVIDERS).map((providerId) => publicProvider(providerId, origin));
}

export function startOAuth(providerId, origin, locale = 'en') {
  purgeExpiredStates();
  const config = requireProvider(providerId, origin);
  const state = randomBytes(24).toString('hex');
  pendingStates.set(state, {
    providerId,
    redirectUri: config.redirectUri,
    locale,
    createdAt: Date.now(),
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  });
  if (config.scope) params.set('scope', config.scope);
  for (const [key, value] of Object.entries(config.extraAuthParams ?? {})) {
    params.set(key, value);
  }
  return `${config.authUrl}?${params.toString()}`;
}

async function requestToken(config, code, pendingState, state) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: pendingState.redirectUri,
  });
  if (config.clientSecret) params.set('client_secret', config.clientSecret);
  if (config.id === 'naver') params.set('state', state);

  const url = config.tokenMethod === 'GET'
    ? `${config.tokenUrl}?${params.toString()}`
    : config.tokenUrl;
  const options = config.tokenMethod === 'GET'
    ? {}
    : {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      };

  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new AppError(502, 'oauth_token_failed', 'OAuth token exchange failed.');
  }
  return payload.access_token;
}

async function requestProfile(config, accessToken) {
  const response = await fetch(config.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(502, 'oauth_profile_failed', 'OAuth profile request failed.');
  }
  const profile = config.mapProfile(payload);
  if (!profile.subject) {
    throw new AppError(502, 'oauth_profile_missing_subject', 'OAuth profile did not include an account id.');
  }
  return profile;
}

export async function completeOAuth(providerId, code, state, origin) {
  purgeExpiredStates();
  if (!code || !state) {
    throw new AppError(400, 'oauth_callback_missing_params', 'OAuth callback is missing required parameters.');
  }
  const pendingState = pendingStates.get(state);
  if (!pendingState || pendingState.providerId !== providerId) {
    throw new AppError(400, 'oauth_state_invalid', 'OAuth state is invalid or expired.');
  }
  pendingStates.delete(state);

  const config = requireProvider(providerId, origin);
  const accessToken = await requestToken(config, code, pendingState, state);
  const profile = await requestProfile(config, accessToken);
  return {
    provider: providerId,
    locale: pendingState.locale,
    profile,
  };
}
