import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'node:http';
import {
  AppError,
  createSay,
  createUser,
  getAppState,
  openDatabase,
  setPick,
  submitReport,
  submitSwayed,
  toggleBoost,
} from './store.js';

const PORT = Number(process.env.PORT || 5173);
const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;
const DB_PATH = process.env.PICKONE_DB || 'data/pickone.sqlite';
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

  if (req.method === 'GET' && pathname === '/api/state') {
    const userId = Number(url.searchParams.get('userId') || 1);
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
      userId: Number(body.userId),
      sideId: Number(body.sideId),
      source: 'manual',
    }));
  }

  params = routePattern(pathname, '/api/topics/:topicId/says');
  if (req.method === 'POST' && params) {
    const body = await readJson(req);
    return sendJson(res, 201, createSay(db, {
      topicId: Number(params.topicId),
      userId: Number(body.userId),
      body: body.body,
      parentSayId: body.parentSayId ? Number(body.parentSayId) : null,
    }));
  }

  params = routePattern(pathname, '/api/says/:sayId/boost');
  if (req.method === 'POST' && params) {
    const body = await readJson(req);
    return sendJson(res, 200, toggleBoost(db, {
      sayId: Number(params.sayId),
      userId: Number(body.userId),
    }));
  }

  params = routePattern(pathname, '/api/says/:sayId/swayed');
  if (req.method === 'POST' && params) {
    const body = await readJson(req);
    return sendJson(res, 201, submitSwayed(db, {
      sayId: Number(params.sayId),
      userId: Number(body.userId),
      caseText: body.caseText,
    }));
  }

  if (req.method === 'POST' && pathname === '/api/reports') {
    return sendJson(res, 201, submitReport(db, await readJson(req)));
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
