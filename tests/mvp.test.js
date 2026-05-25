import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AppError,
  createSession,
  createSay,
  getSessionUser,
  getAppState,
  getTopicDetail,
  openDatabase,
  setPick,
  submitReport,
  submitSwayed,
  toggleBoost,
  upsertOAuthUser,
} from '../src/store.js';

function freshDb() {
  return openDatabase(':memory:');
}

function activeTopic(db, userId = 1) {
  return getAppState(db, { userId }).topics.find((topic) => topic.status === 'active');
}

function inactiveTopicForAdmin(db) {
  return getAppState(db, { userId: 3 }).topics.find((topic) => topic.status === 'inactive');
}

function oppositeSide(topic, sideId) {
  return topic.sides.find((side) => side.id !== sideId);
}

test('manual Pick changes do not add Sway count', () => {
  const db = freshDb();
  const topic = getTopicDetail(db, { topicId: activeTopic(db).id, userId: 1 });
  const before = topic.says.flatMap((say) => [say, ...say.replies]).reduce((sum, say) => sum + say.swayCount, 0);
  const next = oppositeSide(topic, topic.currentPick.sideId);

  const result = setPick(db, {
    topicId: topic.id,
    userId: 1,
    sideId: next.id,
    source: 'manual',
  });

  const afterTopic = getTopicDetail(db, { topicId: topic.id, userId: 1 });
  const after = afterTopic.says.flatMap((say) => [say, ...say.replies]).reduce((sum, say) => sum + say.swayCount, 0);
  assert.equal(result.changed, true);
  assert.equal(afterTopic.currentPick.sideId, next.id);
  assert.equal(after, before);
});

test('Swayed changes Pick and increments only the source Say', () => {
  const db = freshDb();
  const topic = getTopicDetail(db, { topicId: activeTopic(db).id, userId: 1 });
  const oppositeSay = topic.says.find((say) => say.sideId !== topic.currentPick.sideId);
  assert.ok(oppositeSay);

  submitSwayed(db, { sayId: oppositeSay.id, userId: 1 });

  const after = getTopicDetail(db, { topicId: topic.id, userId: 1 });
  const swayedSay = after.says.find((say) => say.id === oppositeSay.id);
  assert.equal(after.currentPick.sideId, oppositeSay.sideId);
  assert.equal(swayedSay.swayCount, oppositeSay.swayCount + 1);
});

test('Swayed rejects own Say, same-side Say, and duplicate attribution', () => {
  const db = freshDb();
  const topic = getTopicDetail(db, { topicId: activeTopic(db).id, userId: 1 });
  const ownSay = topic.says.find((say) => say.authorId === 1);
  assert.throws(() => submitSwayed(db, { sayId: ownSay.id, userId: 1 }), AppError);

  const oppositeSay = topic.says.find((say) => say.sideId !== topic.currentPick.sideId);
  submitSwayed(db, { sayId: oppositeSay.id, userId: 1 });
  assert.throws(() => submitSwayed(db, { sayId: oppositeSay.id, userId: 1 }), AppError);
});

test('ReSay replies to ReSay are flattened as 2-depth siblings', () => {
  const db = freshDb();
  const topic = getTopicDetail(db, { topicId: activeTopic(db).id, userId: 1 });
  const root = topic.says.find((say) => say.replies.length > 0);
  const firstReply = root.replies[0];

  const secondReply = createSay(db, {
    topicId: topic.id,
    userId: 1,
    parentSayId: firstReply.id,
    body: 'Replying to the ReSay, but staying flat.',
  });

  assert.equal(secondReply.parentSayId, root.id);
  assert.equal(secondReply.replyToSayId, firstReply.id);
});

test('inactive topics are hidden from normal users and read-only for admins', () => {
  const db = freshDb();
  const inactive = inactiveTopicForAdmin(db);
  assert.ok(inactive);
  assert.equal(getAppState(db, { userId: 1 }).topics.some((topic) => topic.id === inactive.id), false);

  const inactiveDetail = getTopicDetail(db, { topicId: inactive.id, userId: 3 });
  assert.equal(inactiveDetail.status, 'inactive');
  assert.notEqual(getAppState(db, { userId: 1, topicId: inactive.id }).topic.id, inactive.id);
  assert.throws(() => setPick(db, {
    topicId: inactive.id,
    userId: 3,
    sideId: inactiveDetail.sides[0].id,
    source: 'manual',
  }), AppError);
});

test('Boost is same-side only and cannot target own Say', () => {
  const db = freshDb();
  const topic = getTopicDetail(db, { topicId: activeTopic(db).id, userId: 1 });
  const ownSay = topic.says.find((say) => say.authorId === 1);
  const oppositeSay = topic.says.find((say) => say.sideId !== topic.currentPick.sideId);

  assert.throws(() => toggleBoost(db, { sayId: ownSay.id, userId: 1 }), AppError);
  assert.throws(() => toggleBoost(db, { sayId: oppositeSay.id, userId: 1 }), AppError);

  const minTopic = getTopicDetail(db, { topicId: topic.id, userId: 2 });
  setPick(db, {
    topicId: topic.id,
    userId: 1,
    sideId: minTopic.currentPick.sideId,
    source: 'manual',
  });
  const sameSideForMin = createSay(db, {
    topicId: topic.id,
    userId: 1,
    body: 'A same-side Say for Min to Boost.',
  });
  const result = toggleBoost(db, { sayId: sameSideForMin.id, userId: 2 });
  assert.equal(result.boosted, true);
});

test('Report creates private records and blocks duplicate reason reports', () => {
  const db = freshDb();
  const topic = activeTopic(db);
  const report = submitReport(db, {
    userId: 1,
    targetType: 'topic',
    targetId: topic.id,
    reason: 'spam',
  });
  assert.ok(report.id);
  assert.throws(() => submitReport(db, {
    userId: 1,
    targetType: 'topic',
    targetId: topic.id,
    reason: 'spam',
  }), AppError);
});

test('hidden or ineligible Says cannot receive ReSay, Boost, or Swayed', () => {
  const db = freshDb();
  const topic = getTopicDetail(db, { topicId: activeTopic(db).id, userId: 1 });
  const oppositeSay = topic.says.find((say) => say.sideId !== topic.currentPick.sideId);
  db.prepare('UPDATE says SET visible = 0, eligible = 0 WHERE id = ?').run(oppositeSay.id);

  assert.throws(() => createSay(db, {
    topicId: topic.id,
    userId: 1,
    parentSayId: oppositeSay.id,
    body: 'This should not attach to hidden content.',
  }), AppError);
  assert.throws(() => toggleBoost(db, { sayId: oppositeSay.id, userId: 2 }), AppError);
  assert.throws(() => submitSwayed(db, { sayId: oppositeSay.id, userId: 1 }), AppError);
});

test('OAuth users are reused by provider identity and can create sessions', () => {
  const db = freshDb();
  const first = upsertOAuthUser(db, {
    provider: 'google',
    subject: 'google-subject-1',
    email: 'pick@example.com',
    displayName: 'Pick User',
  });
  const second = upsertOAuthUser(db, {
    provider: 'google',
    subject: 'google-subject-1',
    email: 'pick@example.com',
    displayName: 'Pick User Renamed',
  });
  assert.equal(second.id, first.id);
  assert.equal(second.displayName, 'Pick User Renamed');

  createSession(db, {
    token: 'test-session-token',
    userId: first.id,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(getSessionUser(db, 'test-session-token').id, first.id);
});

test('app state includes richer profile sections for personal history', () => {
  const db = freshDb();
  const state = getAppState(db, { userId: 1 });

  assert.equal(state.users.length >= 7, true);
  assert.equal(state.topics.length >= 5, true);
  assert.equal(state.globalTimeline.length > 0, true);
  assert.equal(state.globalTimeline.every((item) => Number.isInteger(item.topicId)), true);
  assert.equal(state.personalProfile.mySays.length > 0, true);
  assert.equal(state.personalProfile.pickHistory.length > 0, true);
  assert.equal(state.personalProfile.swayedHistory.length > 0, true);
});
