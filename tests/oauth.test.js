import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicOAuthProviders } from '../src/oauth.js';

function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('OAuth providers expose missing configuration without secrets', () => {
  withEnv({
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    NAVER_CLIENT_ID: undefined,
    NAVER_CLIENT_SECRET: undefined,
    KAKAO_REST_API_KEY: undefined,
    KAKAO_CLIENT_ID: undefined,
    KAKAO_CLIENT_SECRET: undefined,
  }, () => {
    const providers = getPublicOAuthProviders('http://localhost:5173');
    assert.deepEqual(providers.map((provider) => provider.id), ['google', 'naver', 'kakao']);
    assert.equal(providers.every((provider) => provider.configured === false), true);
    assert.equal(providers.some((provider) => 'clientSecret' in provider), false);
  });
});

test('OAuth provider status becomes configured when required env is present', () => {
  withEnv({
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    NAVER_CLIENT_ID: 'naver-client',
    NAVER_CLIENT_SECRET: 'naver-secret',
    KAKAO_REST_API_KEY: 'kakao-key',
    KAKAO_CLIENT_ID: undefined,
    KAKAO_CLIENT_SECRET: undefined,
  }, () => {
    const providers = getPublicOAuthProviders('http://localhost:5173');
    assert.equal(providers.find((provider) => provider.id === 'google').configured, true);
    assert.equal(providers.find((provider) => provider.id === 'naver').configured, true);
    assert.equal(providers.find((provider) => provider.id === 'kakao').configured, true);
  });
});
