import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const REPORT_REASONS = new Set([
  'harassment',
  'hate',
  'private_information',
  'spam',
  'illegal_or_dangerous',
  'off_topic_abuse',
]);

export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function now() {
  return new Date().toISOString();
}

function cleanText(value, name, max = 600) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new AppError(400, 'missing_text', `${name} is required.`);
  }
  if (text.length > max) {
    throw new AppError(400, 'text_too_long', `${name} must be ${max} characters or less.`);
  }
  return text;
}

function optionalText(value, max = 600) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function bool(value) {
  return Boolean(value);
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    email: row.email ?? null,
    authProvider: row.auth_provider ?? null,
    isAdmin: bool(row.is_admin),
  };
}

function rowToSide(row) {
  return {
    id: row.id,
    topicId: row.topic_id,
    label: row.label,
    color: row.color,
  };
}

function rowToTopic(row) {
  return {
    id: row.id,
    slug: row.slug,
    question: row.question,
    status: row.status,
    createdAt: row.created_at,
  };
}

function rowToSay(row) {
  return {
    id: row.id,
    topicId: row.topic_id,
    authorId: row.author_id,
    authorName: row.author_name,
    sideId: row.side_id,
    sideLabel: row.side_label,
    sideColor: row.side_color,
    parentSayId: row.parent_say_id,
    replyToSayId: row.reply_to_say_id,
    replyToAuthorName: row.reply_to_author_name,
    body: row.body,
    visible: bool(row.visible),
    eligible: bool(row.eligible),
    swayCount: row.sway_count,
    boostCount: row.boost_count ?? 0,
    boostedByCurrentUser: bool(row.boosted_by_current_user),
    swayedByCurrentUser: bool(row.swayed_by_current_user),
    createdAt: row.created_at,
    replies: [],
  };
}

export function openDatabase(dbPath = 'data/pickone.sqlite') {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      auth_provider TEXT,
      auth_subject TEXT,
      email TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      question TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      UNIQUE(topic_id, label)
    );

    CREATE TABLE IF NOT EXISTS picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      side_id INTEGER NOT NULL REFERENCES sides(id) ON DELETE CASCADE,
      updated_at TEXT NOT NULL,
      UNIQUE(topic_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS pick_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_side_id INTEGER REFERENCES sides(id) ON DELETE SET NULL,
      to_side_id INTEGER NOT NULL REFERENCES sides(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK (source IN ('manual', 'swayed')),
      source_say_id INTEGER REFERENCES says(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS says (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      side_id INTEGER NOT NULL REFERENCES sides(id) ON DELETE CASCADE,
      parent_say_id INTEGER REFERENCES says(id) ON DELETE CASCADE,
      reply_to_say_id INTEGER REFERENCES says(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1,
      eligible INTEGER NOT NULL DEFAULT 1,
      sway_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      say_id INTEGER NOT NULL REFERENCES says(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(say_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS swayed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_side_id INTEGER NOT NULL REFERENCES sides(id) ON DELETE CASCADE,
      to_side_id INTEGER NOT NULL REFERENCES sides(id) ON DELETE CASCADE,
      sway_say_id INTEGER NOT NULL REFERENCES says(id) ON DELETE CASCADE,
      case_text TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(topic_id, user_id, sway_say_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('topic', 'say', 'user')),
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(reporter_id, target_type, target_id, reason)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
  ensureColumn(db, 'users', 'auth_provider', 'TEXT');
  ensureColumn(db, 'users', 'auth_subject', 'TEXT');
  ensureColumn(db, 'users', 'email', 'TEXT');
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_auth_identity_idx
    ON users(auth_provider, auth_subject)
    WHERE auth_provider IS NOT NULL AND auth_subject IS NOT NULL;
  `);
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function seed(db) {
  const stamp = now();
  const user = db.prepare(`
    INSERT INTO users (handle, display_name, is_admin, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const topic = db.prepare(`
    INSERT INTO topics (slug, question, status, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const side = db.prepare(`
    INSERT INTO sides (topic_id, label, color)
    VALUES (?, ?, ?)
  `);

  const ensureUser = (handle, displayName, isAdmin = 0) => {
    const existing = db.prepare('SELECT id FROM users WHERE handle = ?').get(handle);
    if (existing) return existing.id;
    return Number(user.run(handle, displayName, isAdmin, stamp).lastInsertRowid);
  };
  const ensureTopic = (slug, question, status = 'active') => {
    const existing = db.prepare('SELECT id FROM topics WHERE slug = ?').get(slug);
    if (existing) return existing.id;
    return Number(topic.run(slug, question, status, stamp).lastInsertRowid);
  };
  const ensureSide = (topicId, label, color) => {
    const existing = db.prepare('SELECT id FROM sides WHERE topic_id = ? AND label = ?').get(topicId, label);
    if (existing) return existing.id;
    return Number(side.run(topicId, label, color).lastInsertRowid);
  };
  const seedSaysWhenSparse = (topicId, desiredCount, create) => {
    const count = db.prepare('SELECT COUNT(*) AS count FROM says WHERE topic_id = ?').get(topicId).count;
    if (count < desiredCount) create();
  };
  const ensurePick = (topicId, userId, sideId) => {
    if (!getPick(db, topicId, userId)) {
      setPick(db, { topicId, userId, sideId, source: 'manual' });
    }
  };
  const sayAt = (say, minutesAgo) => {
    const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    db.prepare('UPDATE says SET created_at = ? WHERE id = ?').run(createdAt, say.id);
    return say;
  };
  const boostOnce = (sayId, userId) => {
    const existing = db.prepare('SELECT id FROM boosts WHERE say_id = ? AND user_id = ?').get(sayId, userId);
    if (!existing) {
      try {
        toggleBoost(db, { sayId, userId });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
      }
    }
  };
  const swayedOnce = (sayId, userId, caseText) => {
    const say = db.prepare('SELECT topic_id FROM says WHERE id = ?').get(sayId);
    const existing = say && db.prepare(`
      SELECT id FROM swayed
      WHERE topic_id = ? AND user_id = ? AND sway_say_id = ?
    `).get(say.topic_id, userId, sayId);
    if (!existing) {
      try {
        submitSwayed(db, { sayId, userId, caseText });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
      }
    }
  };

  const joonId = ensureUser('joon', 'Joon');
  const minId = ensureUser('min', 'Min');
  const adminId = ensureUser('admin', 'Admin', 1);
  const ariId = ensureUser('ari', 'Ari');
  const solId = ensureUser('sol', 'Sol');
  const nariId = ensureUser('nari', 'Nari');
  const theoId = ensureUser('theo', 'Theo');

  const remoteId = ensureTopic(
    'remote-work-default',
    'Should remote work be the default?',
    'active',
  );
  const sportsId = ensureTopic(
    'weekend-sport',
    'Which sport owns the weekend?',
    'active',
  );
  const aiDraftId = ensureTopic(
    'ai-first-drafts',
    'Should AI write the first draft?',
    'active',
  );
  const downtownId = ensureTopic(
    'downtown-car-ban',
    'Should downtown streets ban private cars?',
    'active',
  );
  const pizzaId = ensureTopic(
    'pineapple-pizza',
    'Does pineapple belong on pizza?',
    'active',
  );
  const draftId = ensureTopic(
    'draft-product-voice',
    'Draft: should Pick One sound sharper or calmer?',
    'inactive',
  );

  const officeId = ensureSide(remoteId, 'Office', '#d14d42');
  const remoteSideId = ensureSide(remoteId, 'Remote', '#12805c');
  const footballId = ensureSide(sportsId, 'Football', '#b35c00');
  const baseballId = ensureSide(sportsId, 'Baseball', '#2368b8');
  const humanId = ensureSide(aiDraftId, 'Human', '#6f4bc2');
  const aiId = ensureSide(aiDraftId, 'AI', '#12805c');
  const banCarsId = ensureSide(downtownId, 'Ban cars', '#d14d42');
  const keepCarsId = ensureSide(downtownId, 'Keep cars', '#2368b8');
  const yesPizzaId = ensureSide(pizzaId, 'Yes', '#12805c');
  const noPizzaId = ensureSide(pizzaId, 'No', '#d14d42');
  ensureSide(draftId, 'Sharper', '#6f4bc2');
  ensureSide(draftId, 'Calmer', '#607d3b');

  ensurePick(remoteId, joonId, officeId);
  ensurePick(remoteId, minId, remoteSideId);
  ensurePick(remoteId, ariId, officeId);
  ensurePick(remoteId, solId, remoteSideId);
  ensurePick(remoteId, nariId, officeId);
  ensurePick(remoteId, theoId, remoteSideId);
  ensurePick(sportsId, joonId, footballId);
  ensurePick(sportsId, minId, baseballId);
  ensurePick(sportsId, ariId, footballId);
  ensurePick(sportsId, solId, baseballId);
  ensurePick(sportsId, nariId, footballId);
  ensurePick(sportsId, theoId, baseballId);
  ensurePick(aiDraftId, joonId, humanId);
  ensurePick(aiDraftId, minId, aiId);
  ensurePick(aiDraftId, ariId, aiId);
  ensurePick(aiDraftId, solId, humanId);
  ensurePick(aiDraftId, theoId, aiId);
  ensurePick(downtownId, joonId, banCarsId);
  ensurePick(downtownId, minId, keepCarsId);
  ensurePick(downtownId, nariId, banCarsId);
  ensurePick(downtownId, solId, banCarsId);
  ensurePick(pizzaId, ariId, yesPizzaId);
  ensurePick(pizzaId, theoId, noPizzaId);

  seedSaysWhenSparse(remoteId, 8, () => {
    sayAt(createSay(db, { topicId: remoteId, userId: joonId, body: 'Office first keeps the small decisions fast and visible.' }), 72);
    const remoteAccess = sayAt(createSay(db, { topicId: remoteId, userId: minId, body: 'Remote first makes the best work accessible to more people.' }), 68);
    sayAt(createSay(db, { topicId: remoteId, userId: ariId, body: 'Access matters, but onboarding still breaks without daily context.', parentSayId: remoteAccess.id }), 63);
    const deepWork = sayAt(createSay(db, { topicId: remoteId, userId: solId, body: 'Remote wins because deep work dies when every desk is an interruption machine.' }), 57);
    sayAt(createSay(db, { topicId: remoteId, userId: nariId, body: 'The best mentoring happens in the weird five minutes after a meeting.', parentSayId: deepWork.id }), 52);
    const context = sayAt(createSay(db, { topicId: remoteId, userId: nariId, body: 'Office teams notice quiet blockers before they turn into a week of Slack archaeology.' }), 47);
    sayAt(createSay(db, { topicId: remoteId, userId: theoId, body: 'That only works for people near the office. Remote makes the default fair.', parentSayId: context.id }), 44);
    const hybrid = sayAt(createSay(db, { topicId: remoteId, userId: ariId, body: 'Default remote does not mean never meet. It means presence has to justify itself.' }), 39);
    boostOnce(hybrid.id, nariId);
    swayedOnce(remoteAccess.id, ariId, 'Access should be the default, office should be intentional.');
    swayedOnce(deepWork.id, nariId, 'I can defend mentoring days without making office the default.');
    swayedOnce(context.id, theoId, 'Quiet blockers are real enough to keep office as the default.');
    swayedOnce(hybrid.id, minId, 'Presence should justify itself, but the default can still be office.');
  });

  seedSaysWhenSparse(sportsId, 7, () => {
    const football = sayAt(createSay(db, { topicId: sportsId, userId: joonId, body: 'Football owns the weekend because one game can carry the whole city mood.' }), 95);
    sayAt(createSay(db, { topicId: sportsId, userId: minId, body: 'Baseball is better weekend background: slow enough to talk, tense enough to care.' }), 89);
    sayAt(createSay(db, { topicId: sportsId, userId: ariId, body: 'Tailgates, fantasy, Sunday pacing. Football is built for the weekend.', parentSayId: football.id }), 83);
    const baseball = sayAt(createSay(db, { topicId: sportsId, userId: solId, body: 'Baseball gives you a whole afternoon instead of three hours of ads and panic.' }), 76);
    sayAt(createSay(db, { topicId: sportsId, userId: theoId, body: 'That is exactly why football wins. Scarcity makes every possession matter.', parentSayId: baseball.id }), 71);
    const redZone = sayAt(createSay(db, { topicId: sportsId, userId: nariId, body: 'Football has the better shared ritual: everyone knows when the moment got big.' }), 66);
    sayAt(createSay(db, { topicId: sportsId, userId: minId, body: 'Baseball has shared rituals too. They just do not scream every six seconds.', parentSayId: redZone.id }), 61);
    boostOnce(football.id, ariId);
  });

  seedSaysWhenSparse(aiDraftId, 5, () => {
    const aiDraft = sayAt(createSay(db, { topicId: aiDraftId, userId: minId, body: 'Let AI make the ugly first draft. Humans should spend taste on choosing and cutting.' }), 34);
    sayAt(createSay(db, { topicId: aiDraftId, userId: joonId, body: 'First drafts are where the thinking starts. Outsourcing that makes the work generic.' }), 31);
    sayAt(createSay(db, { topicId: aiDraftId, userId: ariId, body: 'Blank pages are expensive. AI gets the argument on the table faster.', parentSayId: aiDraft.id }), 28);
    const humanDraft = sayAt(createSay(db, { topicId: aiDraftId, userId: solId, body: 'A human first draft shows what the team actually believes before polish hides it.' }), 22);
    sayAt(createSay(db, { topicId: aiDraftId, userId: theoId, body: 'Counterpoint: most teams do not need sacred drafts, they need momentum.', parentSayId: humanDraft.id }), 16);
    swayedOnce(aiDraft.id, joonId, 'Momentum beats staring at a blank doc.');
    swayedOnce(aiDraft.id, solId, 'Momentum beats staring at a blank doc.');
  });

  seedSaysWhenSparse(downtownId, 4, () => {
    sayAt(createSay(db, { topicId: downtownId, userId: joonId, body: 'Ban private cars downtown. Streets should move people, not store metal boxes.' }), 145);
    const access = sayAt(createSay(db, { topicId: downtownId, userId: minId, body: 'Keep cars until transit is good enough for late shifts, kids, and bad weather.' }), 138);
    sayAt(createSay(db, { topicId: downtownId, userId: nariId, body: 'Then phase it: delivery windows, resident permits, and car-free core blocks first.', parentSayId: access.id }), 131);
    sayAt(createSay(db, { topicId: downtownId, userId: solId, body: 'A car ban is not anti-driver. It is pro-street.' }), 124);
  });

  seedSaysWhenSparse(pizzaId, 3, () => {
    sayAt(createSay(db, { topicId: pizzaId, userId: ariId, body: 'Pineapple belongs. Sweet, salty, heat. That is the whole point.' }), 118);
    const no = sayAt(createSay(db, { topicId: pizzaId, userId: theoId, body: 'Fruit on pizza is a prank that got franchised.' }), 112);
    sayAt(createSay(db, { topicId: pizzaId, userId: ariId, body: 'Tomato is fruit. The door was already open.', parentSayId: no.id }), 105);
  });
}

function requireUser(db, userId) {
  const user = rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(userId)));
  if (!user) throw new AppError(404, 'user_not_found', 'User was not found.');
  return user;
}

function requireTopic(db, topicId, user = null) {
  const topic = rowToTopic(db.prepare('SELECT * FROM topics WHERE id = ?').get(Number(topicId)));
  if (!topic) throw new AppError(404, 'topic_not_found', 'Topic was not found.');
  if (topic.status !== 'active' && !user?.isAdmin) {
    throw new AppError(404, 'topic_not_found', 'Topic was not found.');
  }
  return topic;
}

function requireActiveTopic(topic) {
  if (topic.status !== 'active') {
    throw new AppError(403, 'topic_inactive', 'Inactive topics are private and read-only.');
  }
}

function requireSide(db, topicId, sideId) {
  const side = rowToSide(db.prepare('SELECT * FROM sides WHERE id = ? AND topic_id = ?').get(Number(sideId), Number(topicId)));
  if (!side) throw new AppError(400, 'side_not_found', 'Side does not belong to this topic.');
  return side;
}

function getPick(db, topicId, userId) {
  return db.prepare(`
    SELECT p.*, s.label AS side_label, s.color AS side_color
    FROM picks p
    JOIN sides s ON s.id = p.side_id
    WHERE p.topic_id = ? AND p.user_id = ?
  `).get(Number(topicId), Number(userId)) ?? null;
}

function requirePick(db, topicId, userId) {
  const pick = getPick(db, topicId, userId);
  if (!pick) {
    throw new AppError(403, 'pick_required', 'Pick a side before participating.');
  }
  return pick;
}

function requireSay(db, sayId) {
  const say = db.prepare(`
    SELECT sa.*, t.status AS topic_status
    FROM says sa
    JOIN topics t ON t.id = sa.topic_id
    WHERE sa.id = ?
  `).get(Number(sayId));
  if (!say) throw new AppError(404, 'say_not_found', 'Say was not found.');
  return say;
}

function requireVisibleEligibleSay(say) {
  if (!say.visible || !say.eligible) {
    throw new AppError(403, 'say_ineligible', 'This Say cannot receive new actions.');
  }
}

function runTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function normalizeHandle(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
}

function uniqueHandle(db, value) {
  const base = normalizeHandle(value) || 'user';
  let handle = base;
  let suffix = 2;
  while (db.prepare('SELECT id FROM users WHERE handle = ?').get(handle)) {
    const ending = `-${suffix}`;
    handle = `${base.slice(0, 32 - ending.length)}${ending}`;
    suffix += 1;
  }
  return handle;
}

export function createUser(db, { handle, displayName }) {
  const cleanHandle = normalizeHandle(cleanText(handle, 'handle', 32));
  if (!cleanHandle) throw new AppError(400, 'invalid_handle', 'Handle must include letters or numbers.');
  const name = cleanText(displayName || handle, 'displayName', 48);
  try {
    const id = Number(db.prepare(`
      INSERT INTO users (handle, display_name, is_admin, created_at)
      VALUES (?, ?, 0, ?)
    `).run(cleanHandle, name, now()).lastInsertRowid);
    return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      throw new AppError(409, 'handle_taken', 'That handle is already taken.');
    }
    throw error;
  }
}

export function upsertOAuthUser(db, { provider, subject, email, displayName }) {
  const cleanProvider = cleanText(provider, 'provider', 24);
  const cleanSubject = cleanText(subject, 'subject', 160);
  const cleanEmail = optionalText(email, 160);
  const name = cleanText(displayName || cleanEmail || `${cleanProvider} user`, 'displayName', 48);
  const existing = db.prepare(`
    SELECT * FROM users
    WHERE auth_provider = ? AND auth_subject = ?
  `).get(cleanProvider, cleanSubject);

  if (existing) {
    db.prepare(`
      UPDATE users
      SET display_name = ?, email = ?
      WHERE id = ?
    `).run(name, cleanEmail, existing.id);
    return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id));
  }

  const handle = uniqueHandle(db, cleanEmail?.split('@')[0] || name);
  const id = Number(db.prepare(`
    INSERT INTO users (handle, display_name, auth_provider, auth_subject, email, is_admin, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(handle, name, cleanProvider, cleanSubject, cleanEmail, now()).lastInsertRowid);
  return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function createSession(db, { token, userId, expiresAt }) {
  cleanText(token, 'token', 128);
  requireUser(db, userId);
  const expiry = cleanText(expiresAt, 'expiresAt', 64);
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
  db.prepare(`
    INSERT OR REPLACE INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, now(), expiry);
  return { token, userId, expiresAt: expiry };
}

export function getSessionUser(db, token) {
  const cleanToken = optionalText(token, 128);
  if (!cleanToken) return null;
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
  const row = db.prepare(`
    SELECT u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(cleanToken, now());
  return rowToUser(row);
}

export function deleteSession(db, token) {
  const cleanToken = optionalText(token, 128);
  if (!cleanToken) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(cleanToken);
}

export function listUsers(db) {
  return db.prepare('SELECT * FROM users ORDER BY is_admin ASC, id ASC').all().map(rowToUser);
}

export function listTopics(db, userId) {
  const user = requireUser(db, userId);
  const rows = user.isAdmin
    ? db.prepare('SELECT * FROM topics ORDER BY status ASC, id ASC').all()
    : db.prepare("SELECT * FROM topics WHERE status = 'active' ORDER BY id ASC").all();

  return rows.map((row) => {
    const topic = rowToTopic(row);
    const sayCount = db.prepare('SELECT COUNT(*) AS count FROM says WHERE topic_id = ? AND visible = 1').get(topic.id).count;
    const pickCount = db.prepare('SELECT COUNT(*) AS count FROM picks WHERE topic_id = ?').get(topic.id).count;
    const sides = db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM picks p WHERE p.side_id = s.id) AS pick_count
      FROM sides s
      WHERE s.topic_id = ?
      ORDER BY s.id ASC
    `).all(topic.id).map((side) => ({
      id: side.id,
      label: side.label,
      color: side.color,
      pickCount: side.pick_count,
    }));
    const currentPick = getPick(db, topic.id, user.id);
    return {
      ...topic,
      sides,
      sayCount,
      pickCount,
      currentPick: currentPick ? {
        sideId: currentPick.side_id,
        sideLabel: currentPick.side_label,
      } : null,
    };
  });
}

export function getTopicDetail(db, { topicId, userId }) {
  const user = requireUser(db, userId);
  const topic = requireTopic(db, topicId, user);
  const sides = db.prepare('SELECT * FROM sides WHERE topic_id = ? ORDER BY id ASC').all(topic.id).map((row) => {
    const mapped = rowToSide(row);
    const pickCount = db.prepare('SELECT COUNT(*) AS count FROM picks WHERE side_id = ?').get(mapped.id).count;
    const sayCount = db.prepare('SELECT COUNT(*) AS count FROM says WHERE topic_id = ? AND side_id = ? AND visible = 1').get(topic.id, mapped.id).count;
    return { ...mapped, pickCount, sayCount };
  });
  const pick = getPick(db, topic.id, user.id);
  const says = listSays(db, { topicId: topic.id, userId: user.id });

  return {
    ...topic,
    sides,
    currentPick: pick ? {
      sideId: pick.side_id,
      sideLabel: pick.side_label,
      sideColor: pick.side_color,
      updatedAt: pick.updated_at,
    } : null,
    says,
  };
}

export function getAppState(db, { userId, topicId = null }) {
  const users = listUsers(db);
  const user = requireUser(db, userId || users[0]?.id);
  const topics = listTopics(db, user.id);
  const selectedTopicId = topicId || topics[0]?.id;
  let topic = null;
  if (selectedTopicId) {
    try {
      topic = getTopicDetail(db, { topicId: selectedTopicId, userId: user.id });
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'topic_not_found') {
        throw error;
      }
      topic = topics[0] ? getTopicDetail(db, { topicId: topics[0].id, userId: user.id }) : null;
    }
  }
  return {
    currentUser: user,
    users,
    topics,
    topic,
    globalTimeline: listGlobalTimeline(db, user.id),
    personalTimeline: listPersonalTimeline(db, user.id),
    personalProfile: listPersonalProfile(db, user.id),
    reportReasons: Array.from(REPORT_REASONS),
  };
}

export function setPick(db, { topicId, userId, sideId, source = 'manual', sourceSayId = null }) {
  const user = requireUser(db, userId);
  const topic = requireTopic(db, topicId, user);
  requireActiveTopic(topic);
  const side = requireSide(db, topic.id, sideId);
  const previous = getPick(db, topic.id, user.id);

  if (previous?.side_id === side.id) {
    return {
      changed: false,
      pick: { sideId: side.id, sideLabel: side.label, sideColor: side.color },
    };
  }

  const stamp = now();
  return runTransaction(db, () => {
    db.prepare(`
      INSERT INTO picks (topic_id, user_id, side_id, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(topic_id, user_id)
      DO UPDATE SET side_id = excluded.side_id, updated_at = excluded.updated_at
    `).run(topic.id, user.id, side.id, stamp);
    db.prepare(`
      INSERT INTO pick_history (topic_id, user_id, from_side_id, to_side_id, source, source_say_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(topic.id, user.id, previous?.side_id ?? null, side.id, source, sourceSayId, stamp);

    return {
      changed: true,
      pick: { sideId: side.id, sideLabel: side.label, sideColor: side.color },
    };
  });
}

export function createSay(db, { topicId, userId, body, parentSayId = null }) {
  const user = requireUser(db, userId);
  const topic = requireTopic(db, topicId, user);
  requireActiveTopic(topic);
  const pick = requirePick(db, topic.id, user.id);
  const text = cleanText(body, 'Say', 600);
  let parentId = null;
  let replyToId = null;

  if (parentSayId) {
    const target = requireSay(db, parentSayId);
    requireVisibleEligibleSay(target);
    if (target.topic_id !== topic.id) {
      throw new AppError(400, 'reply_topic_mismatch', 'ReSay target belongs to another topic.');
    }
    parentId = target.parent_say_id || target.id;
    replyToId = target.parent_say_id ? target.id : null;

    const parent = requireSay(db, parentId);
    requireVisibleEligibleSay(parent);
    if (parent.parent_say_id) {
      throw new AppError(400, 'invalid_parent', 'ReSay parent must be a 1-depth Say.');
    }
  }

  const id = Number(db.prepare(`
    INSERT INTO says (topic_id, author_id, side_id, parent_say_id, reply_to_say_id, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(topic.id, user.id, pick.side_id, parentId, replyToId, text, now()).lastInsertRowid);

  return getSayDetail(db, { sayId: id, userId: user.id });
}

export function toggleBoost(db, { sayId, userId }) {
  const user = requireUser(db, userId);
  const say = requireSay(db, sayId);
  const topic = requireTopic(db, say.topic_id, user);
  requireActiveTopic(topic);
  requireVisibleEligibleSay(say);
  const pick = requirePick(db, topic.id, user.id);

  if (say.author_id === user.id) {
    throw new AppError(403, 'own_say_boost', 'Users cannot Boost their own Say.');
  }
  if (say.side_id !== pick.side_id) {
    throw new AppError(403, 'boost_same_side_only', 'Boost is for your current Pick side.');
  }

  const existing = db.prepare('SELECT id FROM boosts WHERE say_id = ? AND user_id = ?').get(say.id, user.id);
  if (existing) {
    db.prepare('DELETE FROM boosts WHERE id = ?').run(existing.id);
    return { boosted: false };
  }

  db.prepare('INSERT INTO boosts (say_id, user_id, created_at) VALUES (?, ?, ?)').run(say.id, user.id, now());
  return { boosted: true };
}

export function submitSwayed(db, { sayId, userId, caseText = null }) {
  const user = requireUser(db, userId);
  const say = requireSay(db, sayId);
  const topic = requireTopic(db, say.topic_id, user);
  requireActiveTopic(topic);
  requireVisibleEligibleSay(say);
  const pick = requirePick(db, topic.id, user.id);

  if (say.author_id === user.id) {
    throw new AppError(403, 'own_say_swayed', 'Users cannot be Swayed by their own Say.');
  }
  if (say.side_id === pick.side_id) {
    throw new AppError(403, 'swayed_opposite_side_only', 'Swayed requires an opposite-side Say.');
  }
  const duplicate = db.prepare(`
    SELECT id FROM swayed
    WHERE topic_id = ? AND user_id = ? AND sway_say_id = ?
  `).get(topic.id, user.id, say.id);
  if (duplicate) {
    throw new AppError(409, 'already_swayed_by_say', 'This Say already received your Swayed credit.');
  }

  const stamp = now();
  return runTransaction(db, () => {
    db.prepare(`
      INSERT INTO swayed (topic_id, user_id, from_side_id, to_side_id, sway_say_id, case_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(topic.id, user.id, pick.side_id, say.side_id, say.id, optionalText(caseText, 600), stamp);
    db.prepare(`
      INSERT INTO pick_history (topic_id, user_id, from_side_id, to_side_id, source, source_say_id, created_at)
      VALUES (?, ?, ?, ?, 'swayed', ?, ?)
    `).run(topic.id, user.id, pick.side_id, say.side_id, say.id, stamp);
    db.prepare('UPDATE picks SET side_id = ?, updated_at = ? WHERE topic_id = ? AND user_id = ?')
      .run(say.side_id, stamp, topic.id, user.id);
    db.prepare('UPDATE says SET sway_count = sway_count + 1 WHERE id = ?').run(say.id);

    return {
      changed: true,
      toSideId: say.side_id,
      sayId: say.id,
    };
  });
}

export function submitReport(db, { userId, targetType, targetId, reason, details = null }) {
  const user = requireUser(db, userId);
  const cleanTarget = String(targetType ?? '').trim();
  const cleanReason = String(reason ?? '').trim();
  if (!['topic', 'say', 'user'].includes(cleanTarget)) {
    throw new AppError(400, 'invalid_report_target', 'Report target is invalid.');
  }
  if (!REPORT_REASONS.has(cleanReason)) {
    throw new AppError(400, 'invalid_report_reason', 'Report reason is invalid.');
  }
  if (cleanTarget === 'topic') requireTopic(db, targetId, user);
  if (cleanTarget === 'say') requireSay(db, targetId);
  if (cleanTarget === 'user') requireUser(db, targetId);

  try {
    const id = Number(db.prepare(`
      INSERT INTO reports (reporter_id, target_type, target_id, reason, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, cleanTarget, Number(targetId), cleanReason, optionalText(details, 600), now()).lastInsertRowid);
    return { id };
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      throw new AppError(409, 'duplicate_report', 'You already reported this target for that reason.');
    }
    throw error;
  }
}

function getSayDetail(db, { sayId, userId }) {
  const row = db.prepare(`
    SELECT
      sa.*,
      u.display_name AS author_name,
      s.label AS side_label,
      s.color AS side_color,
      reply_author.display_name AS reply_to_author_name,
      (SELECT COUNT(*) FROM boosts b WHERE b.say_id = sa.id) AS boost_count,
      EXISTS(SELECT 1 FROM boosts b WHERE b.say_id = sa.id AND b.user_id = ?) AS boosted_by_current_user,
      EXISTS(SELECT 1 FROM swayed sw WHERE sw.sway_say_id = sa.id AND sw.user_id = ?) AS swayed_by_current_user
    FROM says sa
    JOIN users u ON u.id = sa.author_id
    JOIN sides s ON s.id = sa.side_id
    LEFT JOIN says reply_target ON reply_target.id = sa.reply_to_say_id
    LEFT JOIN users reply_author ON reply_author.id = reply_target.author_id
    WHERE sa.id = ?
  `).get(Number(userId), Number(userId), Number(sayId));
  if (!row) throw new AppError(404, 'say_not_found', 'Say was not found.');
  return rowToSay(row);
}

function listSays(db, { topicId, userId }) {
  const rows = db.prepare(`
    SELECT
      sa.*,
      u.display_name AS author_name,
      s.label AS side_label,
      s.color AS side_color,
      reply_author.display_name AS reply_to_author_name,
      (SELECT COUNT(*) FROM boosts b WHERE b.say_id = sa.id) AS boost_count,
      EXISTS(SELECT 1 FROM boosts b WHERE b.say_id = sa.id AND b.user_id = ?) AS boosted_by_current_user,
      EXISTS(SELECT 1 FROM swayed sw WHERE sw.sway_say_id = sa.id AND sw.user_id = ?) AS swayed_by_current_user
    FROM says sa
    JOIN users u ON u.id = sa.author_id
    JOIN sides s ON s.id = sa.side_id
    LEFT JOIN says reply_target ON reply_target.id = sa.reply_to_say_id
    LEFT JOIN users reply_author ON reply_author.id = reply_target.author_id
    WHERE sa.topic_id = ? AND sa.visible = 1
    ORDER BY sa.created_at DESC, sa.id DESC
  `).all(Number(userId), Number(userId), Number(topicId)).map(rowToSay);

  const roots = [];
  const byId = new Map();
  for (const say of rows) byId.set(say.id, say);
  for (const say of rows) {
    if (!say.parentSayId) {
      roots.push(say);
    } else {
      const parent = byId.get(say.parentSayId);
      if (parent) parent.replies.unshift(say);
    }
  }
  return roots;
}

function listGlobalTimeline(db, userId) {
  const sayRows = db.prepare(`
    SELECT
      'say' AS type,
      sa.id,
      sa.topic_id,
      sa.created_at,
      t.question AS topic_question,
      u.display_name AS actor_name,
      s.label AS side_label,
      sa.body AS body,
      sa.parent_say_id AS parent_say_id
    FROM says sa
    JOIN topics t ON t.id = sa.topic_id
    JOIN users u ON u.id = sa.author_id
    JOIN sides s ON s.id = sa.side_id
    WHERE t.status = 'active' AND sa.visible = 1
    ORDER BY sa.created_at DESC
    LIMIT 12
  `).all();
  const swayedRows = db.prepare(`
    SELECT
      'swayed' AS type,
      sw.id,
      sw.topic_id,
      sw.created_at,
      t.question AS topic_question,
      u.display_name AS actor_name,
      s.label AS side_label,
      sa.body AS body,
      NULL AS parent_say_id
    FROM swayed sw
    JOIN topics t ON t.id = sw.topic_id
    JOIN users u ON u.id = sw.user_id
    JOIN sides s ON s.id = sw.to_side_id
    JOIN says sa ON sa.id = sw.sway_say_id
    WHERE t.status = 'active'
    ORDER BY sw.created_at DESC
    LIMIT 12
  `).all();
  return [...sayRows, ...swayedRows]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 12)
    .map((row) => ({
      type: row.type,
      id: row.id,
      topicId: row.topic_id,
      createdAt: row.created_at,
      topicQuestion: row.topic_question,
      actorName: row.actor_name,
      sideLabel: row.side_label,
      body: row.body,
      isReSay: Boolean(row.parent_say_id),
    }));
}

function listPersonalTimeline(db, userId) {
  requireUser(db, userId);
  const pickRows = db.prepare(`
    SELECT
      'pick' AS type,
      ph.id,
      ph.created_at,
      t.question AS topic_question,
      ph.source,
      from_side.label AS from_label,
      to_side.label AS to_label,
      source_say.body AS source_body
    FROM pick_history ph
    JOIN topics t ON t.id = ph.topic_id
    LEFT JOIN sides from_side ON from_side.id = ph.from_side_id
    JOIN sides to_side ON to_side.id = ph.to_side_id
    LEFT JOIN says source_say ON source_say.id = ph.source_say_id
    WHERE ph.user_id = ?
    ORDER BY ph.created_at DESC
    LIMIT 12
  `).all(Number(userId));
  const ownSayRows = db.prepare(`
    SELECT
      'own_say' AS type,
      sa.id,
      sa.created_at,
      t.question AS topic_question,
      NULL AS source,
      NULL AS from_label,
      s.label AS to_label,
      sa.body AS source_body
    FROM says sa
    JOIN topics t ON t.id = sa.topic_id
    JOIN sides s ON s.id = sa.side_id
    WHERE sa.author_id = ? AND sa.visible = 1
    ORDER BY sa.created_at DESC
    LIMIT 12
  `).all(Number(userId));

  return [...pickRows, ...ownSayRows]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 12)
    .map((row) => ({
      type: row.type,
      id: row.id,
      createdAt: row.created_at,
      topicQuestion: row.topic_question,
      source: row.source,
      fromLabel: row.from_label,
      toLabel: row.to_label,
      sourceBody: row.source_body,
    }));
}

function mapPersonalRow(row) {
  return {
    type: row.type,
    id: row.id,
    createdAt: row.created_at,
    topicQuestion: row.topic_question,
    source: row.source,
    fromLabel: row.from_label,
    toLabel: row.to_label,
    sourceBody: row.source_body,
  };
}

function listPersonalProfile(db, userId) {
  requireUser(db, userId);
  const mySays = db.prepare(`
    SELECT
      'own_say' AS type,
      sa.id,
      sa.created_at,
      t.question AS topic_question,
      NULL AS source,
      NULL AS from_label,
      s.label AS to_label,
      sa.body AS source_body
    FROM says sa
    JOIN topics t ON t.id = sa.topic_id
    JOIN sides s ON s.id = sa.side_id
    WHERE sa.author_id = ? AND sa.visible = 1
    ORDER BY sa.created_at DESC, sa.id DESC
    LIMIT 50
  `).all(Number(userId)).map(mapPersonalRow);

  const pickRows = db.prepare(`
    SELECT
      'pick' AS type,
      ph.id,
      ph.created_at,
      t.question AS topic_question,
      ph.source,
      from_side.label AS from_label,
      to_side.label AS to_label,
      source_say.body AS source_body
    FROM pick_history ph
    JOIN topics t ON t.id = ph.topic_id
    LEFT JOIN sides from_side ON from_side.id = ph.from_side_id
    JOIN sides to_side ON to_side.id = ph.to_side_id
    LEFT JOIN says source_say ON source_say.id = ph.source_say_id
    WHERE ph.user_id = ?
    ORDER BY ph.created_at DESC, ph.id DESC
    LIMIT 50
  `).all(Number(userId)).map(mapPersonalRow);

  return {
    mySays,
    pickHistory: pickRows.filter((item) => item.source !== 'swayed'),
    swayedHistory: pickRows.filter((item) => item.source === 'swayed'),
  };
}
