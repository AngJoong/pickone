import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import {
  AppError,
  createSay,
  createSession,
  createUser,
  deleteSession,
  getAppState,
  getSessionUser,
  openDatabase,
  setPick,
  submitReport,
  submitSwayed,
  toggleBoost,
  upsertOAuthUser,
} from './store.js';
import {
  completeOAuth,
  getPublicOAuthProviders,
  startOAuth,
} from './oauth.js';

const PORT = Number(process.env.PORT || 5173);
const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;
const DB_PATH = process.env.PICKONE_DB || 'data/pickone.sqlite';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const db = openDatabase(DB_PATH);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function requestOrigin(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  if (process.env.OAUTH_BASE_URL) return process.env.OAUTH_BASE_URL.replace(/\/$/, '');
  const host = req.headers.host || `localhost:${PORT}`;
  const hostname = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    return `http://localhost:${PORT}`;
  }
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

function redirectWithAuthError(res, origin, code, locale = 'en') {
  const target = new URL('/', origin);
  target.searchParams.set('auth_error', code);
  target.searchParams.set('lang', locale);
  redirect(res, target.toString());
}

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) return cookies;
    try {
      cookies[rawName] = decodeURIComponent(rawValue.join('='));
    } catch {
      cookies[rawName] = rawValue.join('=');
    }
    return cookies;
  }, {});
}

function requestUser(req) {
  return getSessionUser(db, parseCookies(req).pickone_session);
}

function requestUserId(req, fallbackUserId) {
  return requestUser(req)?.id || Number(fallbackUserId);
}

function sessionCookie(token, origin) {
  const secure = origin.startsWith('https://') ? '; Secure' : '';
  return `pickone_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearSessionCookie(origin) {
  const secure = origin.startsWith('https://') ? '; Secure' : '';
  return `pickone_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
}

function routePattern(pathname, pattern) {
  const pathParts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index];
    if (part.startsWith(':')) {
      params[part.slice(1)] = pathParts[index];
    } else if (part !== pathParts[index]) {
      return null;
    }
  }
  return params;
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/auth/providers') {
    return sendJson(res, 200, { providers: getPublicOAuthProviders(requestOrigin(req)) });
  }

  if (req.method === 'GET' && pathname === '/api/session') {
    return sendJson(res, 200, { user: requestUser(req) });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    deleteSession(db, parseCookies(req).pickone_session);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': clearSessionCookie(requestOrigin(req)),
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/state') {
    const userId = requestUserId(req, url.searchParams.get('userId') || 1);
    const topicId = url.searchParams.get('topicId') ? Number(url.searchParams.get('topicId')) : null;
    return sendJson(res, 200, getAppState(db, { userId, topicId }));
  }

  if (req.method === 'POST' && pathname === '/api/users') {
    return sendJson(res, 201, createUser(db, await readJson(req)));
  }

  let params = routePattern(pathname, '/api/topics/:topicId/pick');
  if (req.method === 'POST' && params) {
    const body = await readJson(req);
    return sendJson(res, 200, setPick(db, {
      topicId: Number(params.topicId),
      userId: requestUserId(req, body.userId),
      sideId: Number(body.sideId),
      source: 'manual',
    }));
  }

  params = routePattern(pathname, '/api/topics/:topicId/says');
  if (req.method === 'POST' && params) {
    const body = await readJson(req);
    return sendJson(res, 201, createSay(db, {
      topicId: Number(params.topicId),
      userId: requestUserId(req, body.userId),
      body: body.body,
      parentSayId: body.parentSayId ? Number(body.parentSayId) : null,
    }));
  }

  params = routePattern(pathname, '/api/says/:sayId/boost');
  if (req.method === 'POST' && params) {
    const body = await readJson(req);
    return sendJson(res, 200, toggleBoost(db, {
      sayId: Number(params.sayId),
      userId: requestUserId(req, body.userId),
    }));
  }

  params = routePattern(pathname, '/api/says/:sayId/swayed');
  if (req.method === 'POST' && params) {
    const body = await readJson(req);
    return sendJson(res, 201, submitSwayed(db, {
      sayId: Number(params.sayId),
      userId: requestUserId(req, body.userId),
      caseText: body.caseText,
    }));
  }

  if (req.method === 'POST' && pathname === '/api/reports') {
    const body = await readJson(req);
    return sendJson(res, 201, submitReport(db, {
      ...body,
      userId: requestUserId(req, body.userId),
    }));
  }

  return sendJson(res, 404, { error: { code: 'not_found', message: 'Route was not found.' } });
}

async function handleAuth(req, res, url) {
  const origin = requestOrigin(req);
  let params = routePattern(url.pathname, '/auth/:provider');
  if (req.method === 'GET' && params) {
    const locale = url.searchParams.get('lang') || 'en';
    try {
      return redirect(res, startOAuth(params.provider, origin, locale));
    } catch (error) {
      if (error instanceof AppError) {
        return redirectWithAuthError(res, origin, error.code, locale);
      }
      throw error;
    }
  }

  params = routePattern(url.pathname, '/auth/:provider/callback');
  if (req.method === 'GET' && params) {
    const locale = url.searchParams.get('lang') || 'en';
    try {
      const result = await completeOAuth(
        params.provider,
        url.searchParams.get('code'),
        url.searchParams.get('state'),
        origin,
      );
      const user = upsertOAuthUser(db, {
        provider: result.provider,
        subject: result.profile.subject,
        email: result.profile.email,
        displayName: result.profile.displayName,
      });
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
      createSession(db, { token, userId: user.id, expiresAt });
      const target = new URL('/', origin);
      target.searchParams.set('userId', String(user.id));
      target.searchParams.set('auth', result.provider);
      target.searchParams.set('lang', result.locale || locale);
      return redirect(res, target.toString(), { 'Set-Cookie': sessionCookie(token, origin) });
    } catch (error) {
      if (error instanceof AppError) {
        return redirectWithAuthError(res, origin, error.code, locale);
      }
      throw error;
    }
  }

  return sendJson(res, 404, { error: { code: 'not_found', message: 'Route was not found.' } });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    if (url.pathname.startsWith('/auth/')) {
      await handleAuth(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    if (error instanceof AppError) {
      sendJson(res, error.status, { error: { code: error.code, message: error.message } });
      return;
    }
    console.error(error);
    sendJson(res, 500, { error: { code: 'internal_error', message: 'Something went wrong.' } });
  }
});

server.listen(PORT, () => {
  console.log(`Pick One MVP running at http://localhost:${PORT}`);
});
