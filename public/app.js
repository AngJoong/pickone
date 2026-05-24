const query = new URLSearchParams(window.location.search);
const localeFromQuery = query.get('lang');
const userIdFromQuery = Number(query.get('userId') || 0);

const STRINGS = {
  en: {
    account: 'Account',
    activeTopic: 'Active topic',
    admin: 'admin',
    adminPreview: 'admin preview',
    authConfigHint: 'Set provider env vars to enable.',
    boost: 'Boost',
    boosted: 'Boosted',
    byFor: 'by {actor} for {side}',
    changeTo: 'Change to {side}',
    composerPlaceholder: 'Make your case for {side}',
    confirmSwayed: 'Change your Pick because of this Say?',
    currentPick: 'Current Pick: {side}',
    currentPickSnapshot: 'New Says use your current Pick snapshot.',
    emptyTopics: 'No active topics.',
    forSide: 'for {side}',
    global: 'Global',
    inactivePreview: 'Inactive preview',
    inactiveReadOnly: 'Inactive topics are private and read-only.',
    language: 'Language',
    loginFailed: 'Login failed: {code}',
    loginSuccess: 'Signed in with {provider}.',
    loginWith: 'Continue with {provider}',
    mine: 'Mine: {side}',
    newHandle: 'new handle',
    noEvents: 'No events yet.',
    noPick: 'No Pick',
    noSays: 'No Says yet.',
    noTopic: 'No topic selected.',
    none: 'None',
    oauthNeeded: '{provider} setup needed',
    personal: 'Personal',
    pick: 'Pick',
    pickCount: '{count} Picks',
    picked: 'Picked',
    pickFirstActions: 'Pick a side before writing, Boosting, or using Swayed.',
    pickFirstCase: 'Pick first to make your case.',
    pickUpdated: 'Pick updated.',
    private: 'Private',
    report: 'Report',
    reportReason: 'Report reason: {reasons}',
    reportSubmitted: 'Report submitted.',
    requestFailed: 'Request failed.',
    resay: 'ReSay',
    rootSays: '{count} root Says',
    say: 'Say',
    sayCount: '{count} Says',
    sideStats: '{picks} Picks · {says} Says',
    signUp: 'Sign up',
    swayed: 'Swayed',
    swayedReason: 'Optional: why did it sway you?',
    swayedRecorded: 'Swayed recorded.',
    tagline: 'Pick one. Make your case.',
    topics: 'Topics',
    writeResay: 'Write a ReSay',
    yourSay: 'Your Say',
  },
  ko: {
    account: '계정',
    activeTopic: '진행 중 토픽',
    admin: '관리자',
    adminPreview: '관리자 미리보기',
    authConfigHint: '환경 변수를 설정하면 켜집니다.',
    boost: 'Boost',
    boosted: 'Boosted',
    byFor: '{actor} · {side}',
    changeTo: '{side}로 변경',
    composerPlaceholder: '{side} 쪽 주장을 남겨주세요',
    confirmSwayed: '이 Say 때문에 Pick을 바꿀까요?',
    currentPick: '현재 Pick: {side}',
    currentPickSnapshot: '새 Say는 현재 Pick 기준으로 기록됩니다.',
    emptyTopics: '진행 중인 토픽이 없습니다.',
    forSide: '{side} 쪽',
    global: '전체',
    inactivePreview: '비공개 미리보기',
    inactiveReadOnly: '비공개 토픽은 읽기만 가능합니다.',
    language: '언어',
    loginFailed: '로그인 실패: {code}',
    loginSuccess: '{provider}로 로그인했습니다.',
    loginWith: '{provider} 로그인',
    mine: '내 Pick: {side}',
    newHandle: '새 핸들',
    noEvents: '아직 기록이 없습니다.',
    noPick: 'Pick 없음',
    noSays: '아직 Say가 없습니다.',
    noTopic: '선택된 토픽이 없습니다.',
    none: '없음',
    oauthNeeded: '{provider} 설정 필요',
    personal: '개인',
    pick: 'Pick',
    pickCount: '{count} Pick',
    picked: 'Picked',
    pickFirstActions: '먼저 Pick해야 Say, Boost, Swayed를 사용할 수 있습니다.',
    pickFirstCase: '먼저 Pick해야 주장을 남길 수 있습니다.',
    pickUpdated: 'Pick이 변경됐습니다.',
    private: '비공개',
    report: '신고',
    reportReason: '신고 사유: {reasons}',
    reportSubmitted: '신고가 접수됐습니다.',
    requestFailed: '요청에 실패했습니다.',
    resay: 'ReSay',
    rootSays: '상위 Say {count}개',
    say: 'Say',
    sayCount: '{count} Say',
    sideStats: 'Pick {picks} · Say {says}',
    signUp: '가입',
    swayed: 'Swayed',
    swayedReason: '선택 사항: 왜 설득됐나요?',
    swayedRecorded: 'Swayed가 기록됐습니다.',
    tagline: '하나를 골라. 네 주장을 펼쳐.',
    topics: '토픽',
    writeResay: 'ReSay 쓰기',
    yourSay: '내 Say',
  },
};

const state = {
  locale: normalizeLocale(localeFromQuery || localStorage.getItem('pickone:locale') || navigator.language),
  userId: userIdFromQuery || Number(localStorage.getItem('pickone:userId') || 1),
  topicId: Number(query.get('topicId') || localStorage.getItem('pickone:topicId') || 0) || null,
  data: null,
  authProviders: [],
  sessionResolved: false,
  sessionUserId: null,
  authNotice: query.get('auth')
    ? { type: 'success', provider: query.get('auth') }
    : query.get('auth_error')
      ? { type: 'error', code: query.get('auth_error') }
      : null,
  cleanUrl: window.location.search.length > 0,
};

const $ = (selector) => document.querySelector(selector);

function normalizeLocale(value) {
  const locale = String(value || '').toLowerCase();
  if (locale.startsWith('ko')) return 'ko';
  return 'en';
}

function t(key, values = {}) {
  const template = STRINGS[state.locale]?.[key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function time(value) {
  return new Intl.DateTimeFormat(state.locale === 'ko' ? 'ko-KR' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || t('requestFailed'));
  }
  return payload;
}

async function load() {
  await resolveSession();
  const params = new URLSearchParams({ userId: String(state.userId) });
  if (state.topicId) params.set('topicId', String(state.topicId));
  const [appState, authState] = await Promise.all([
    api(`/api/state?${params.toString()}`),
    api('/api/auth/providers'),
  ]);
  state.data = appState;
  state.authProviders = authState.providers;
  state.userId = state.data.currentUser.id;
  state.topicId = state.data.topic?.id ?? null;
  localStorage.setItem('pickone:userId', String(state.userId));
  localStorage.setItem('pickone:locale', state.locale);
  if (state.topicId) localStorage.setItem('pickone:topicId', String(state.topicId));
  render();
  showAuthNotice();
}

async function resolveSession() {
  if (state.sessionResolved) return;
  const session = await api('/api/session');
  if (session.user) {
    state.sessionUserId = session.user.id;
    state.userId = session.user.id;
  }
  state.sessionResolved = true;
}

function showAuthNotice() {
  if (!state.authNotice) return;
  if (state.authNotice.type === 'success') {
    toast(t('loginSuccess', { provider: providerLabel(state.authNotice.provider) }));
  } else {
    toast(t('loginFailed', { code: state.authNotice.code }));
  }
  state.authNotice = null;
  if (state.cleanUrl) {
    history.replaceState(null, '', '/');
    state.cleanUrl = false;
  }
}

function providerLabel(providerId) {
  return state.authProviders.find((provider) => provider.id === providerId)?.label || providerId;
}

function render() {
  renderChrome();
  renderUsers();
  renderOAuthProviders();
  renderTopics();
  renderTopicDetail();
  renderTimeline('#global-timeline', state.data.globalTimeline, 'global');
  renderTimeline('#personal-timeline', state.data.personalTimeline, 'personal');
}

function renderChrome() {
  document.documentElement.lang = state.locale;
  $('#brand-tagline').textContent = t('tagline');
  $('#account-label').textContent = t('account');
  $('#language-label').textContent = t('language');
  $('#topics-title').textContent = t('topics');
  $('#global-title').textContent = t('global');
  $('#personal-title').textContent = t('personal');
  $('#signup-handle').placeholder = t('newHandle');
  $('#signup-button').textContent = t('signUp');
  $('#locale-select').value = state.locale;
}

function renderUsers() {
  const select = $('#user-select');
  select.innerHTML = state.data.users.map((user) => `
    <option value="${user.id}" ${user.id === state.userId ? 'selected' : ''}>
      ${esc(user.displayName)}${user.isAdmin ? ` (${t('admin')})` : ''}
    </option>
  `).join('');
}

function renderOAuthProviders() {
  const buttons = $('#oauth-buttons');
  buttons.innerHTML = state.authProviders.map((provider) => {
    if (provider.configured) {
      return `<a class="oauth-button" href="${esc(provider.loginUrl)}?lang=${state.locale}">${esc(t('loginWith', { provider: provider.label }))}</a>`;
    }
    return `
      <button class="oauth-button" type="button" disabled title="${esc(t('authConfigHint'))}">
        ${esc(t('oauthNeeded', { provider: provider.label }))}
      </button>
    `;
  }).join('');
}

function renderTopics() {
  const list = $('#topic-list');
  list.innerHTML = state.data.topics.map((topic) => `
    <button class="topic-button ${topic.id === state.topicId ? 'active' : ''}" data-topic-id="${topic.id}">
      <strong>${esc(topic.question)}</strong>
      <div class="topic-sides">
        ${topic.sides.map((side) => `
          <span><span class="dot" style="background:${esc(side.color)}"></span>${esc(side.label)} ${side.pickCount}</span>
        `).join('')}
      </div>
      <div class="topic-meta">
        <span>${t('pickCount', { count: topic.pickCount })}</span>
        <span>${t('sayCount', { count: topic.sayCount })}</span>
        ${topic.currentPick ? `<span>${esc(t('mine', { side: topic.currentPick.sideLabel }))}</span>` : `<span>${t('noPick')}</span>`}
        ${topic.status === 'inactive' ? `<span>${t('adminPreview')}</span>` : ''}
      </div>
    </button>
  `).join('') || `<div class="empty-state">${t('emptyTopics')}</div>`;
}

function renderTopicDetail() {
  const topic = state.data.topic;
  const target = $('#topic-detail');
  if (!topic) {
    target.innerHTML = `<div class="empty-state">${t('noTopic')}</div>`;
    return;
  }

  const sideChoices = topic.sides.map((side) => `
    <div class="side-choice">
      <span class="side-swatch" style="background:${esc(side.color)}"></span>
      <div>
        <strong>${esc(side.label)}</strong>
        <span>${esc(t('sideStats', { picks: side.pickCount, says: side.sayCount }))}</span>
      </div>
      ${topic.status === 'active' ? `
        <button class="${topic.currentPick?.sideId === side.id ? '' : 'primary'}" data-pick-side="${side.id}">
          ${topic.currentPick?.sideId === side.id ? t('picked') : t('pick')}
        </button>
      ` : `<span class="hint">${t('private')}</span>`}
    </div>
  `).join('');

  target.innerHTML = `
    <section class="topic-header">
      <div class="topic-kicker">
        <span>${topic.status === 'active' ? t('activeTopic') : t('inactivePreview')}</span>
        <button data-report="topic:${topic.id}">${t('report')}</button>
      </div>
      <h2>${esc(topic.question)}</h2>
      <div class="side-picks">${sideChoices}</div>
    </section>
    ${renderPickStrip(topic)}
    ${renderComposer(topic)}
    <section class="lanes">
      ${topic.sides.map((side) => renderLane(topic, side)).join('')}
    </section>
  `;
}

function renderPickStrip(topic) {
  if (topic.status !== 'active') {
    return `
      <section class="pick-strip">
        <span class="hint">${t('inactiveReadOnly')}</span>
      </section>
    `;
  }
  if (!topic.currentPick) {
    return `
      <section class="pick-strip">
        <span class="hint">${t('pickFirstActions')}</span>
      </section>
    `;
  }

  const currentSide = topic.sides.find((side) => side.id === topic.currentPick.sideId);
  const changeButtons = topic.sides
    .filter((side) => side.id !== topic.currentPick.sideId)
    .map((side) => `<button data-pick-side="${side.id}">${esc(t('changeTo', { side: side.label }))}</button>`)
    .join('');
  return `
    <section class="pick-strip">
      <div class="pick-current">
        <span class="dot" style="background:${esc(currentSide.color)}"></span>
        ${esc(t('currentPick', { side: currentSide.label }))}
      </div>
      <div>${changeButtons}</div>
    </section>
  `;
}

function renderComposer(topic) {
  if (topic.status !== 'active') {
    return `<section class="composer"><span class="hint">${t('inactiveReadOnly')}</span></section>`;
  }
  if (!topic.currentPick) {
    return `<section class="composer"><span class="hint">${t('pickFirstCase')}</span></section>`;
  }
  const side = topic.sides.find((item) => item.id === topic.currentPick.sideId);
  return `
    <form class="composer" data-say-form>
      <textarea name="body" maxlength="600" placeholder="${esc(t('composerPlaceholder', { side: side.label }))}"></textarea>
      <div class="composer-footer">
        <span class="hint">${t('currentPickSnapshot')}</span>
        <button class="primary" type="submit">${t('say')}</button>
      </div>
    </form>
  `;
}

function renderLane(topic, side) {
  const says = topic.says.filter((say) => say.sideId === side.id);
  return `
    <div class="lane">
      <div class="lane-title">
        <span><span class="dot" style="background:${esc(side.color)}"></span> ${esc(side.label)}</span>
        <span class="hint">${t('rootSays', { count: says.length })}</span>
      </div>
      <div class="say-list">
        ${says.map((say) => renderSay(topic, say, false)).join('') || `<div class="empty-state">${t('noSays')}</div>`}
      </div>
    </div>
  `;
}

function renderSay(topic, say, isReply) {
  const currentPick = topic.currentPick;
  const isOwn = say.authorId === state.userId;
  const canParticipate = topic.status === 'active' && currentPick;
  const canBoost = canParticipate && !isOwn && say.sideId === currentPick.sideId && say.eligible;
  const canSwayed = canParticipate && !isOwn && say.sideId !== currentPick.sideId && say.eligible;
  const replyLabel = isReply && say.replyToAuthorName ? `<span class="reply-target">@${esc(say.replyToAuthorName)}</span>` : '';
  return `
    <article class="say-card ${isReply ? 'reply' : ''}" style="${isReply ? `border-left-color:${esc(say.sideColor)}` : ''}">
      <div class="say-meta">
        <span class="side-badge"><span class="dot" style="background:${esc(say.sideColor)}"></span>${esc(say.sideLabel)}</span>
        <span>${esc(say.authorName)}</span>
        ${replyLabel}
        <span>${time(say.createdAt)}</span>
      </div>
      <p class="say-body">${esc(say.body)}</p>
      <div class="say-actions">
        <button data-boost="${say.id}" ${canBoost ? '' : 'disabled'}>
          ${say.boostedByCurrentUser ? t('boosted') : t('boost')} · ${say.boostCount}
        </button>
        <button class="primary" data-swayed="${say.id}" ${canSwayed ? '' : 'disabled'}>
          ${t('swayed')} · ${say.swayCount}
        </button>
        <button data-reply="${say.id}" ${canParticipate && say.eligible ? '' : 'disabled'}>${t('resay')}</button>
        <button data-report="say:${say.id}">${t('report')}</button>
      </div>
      <div class="reply-list">
        ${(say.replies || []).map((reply) => renderSay(topic, reply, true)).join('')}
      </div>
    </article>
  `;
}

function renderTimeline(selector, items, mode) {
  const node = $(selector);
  node.innerHTML = items.map((item) => {
    if (mode === 'personal') {
      if (item.type === 'pick') {
        return `
          <div class="timeline-item">
            <strong>${item.source === 'swayed' ? t('swayed') : t('pick')}</strong>
            ${esc(item.fromLabel || t('none'))} -> ${esc(item.toLabel)}
            <br><span>${esc(item.topicQuestion)}</span>
          </div>
        `;
      }
      return `
        <div class="timeline-item">
          <strong>${t('yourSay')}</strong> ${esc(t('forSide', { side: item.toLabel }))}
          <br><span>${esc(item.sourceBody)}</span>
        </div>
      `;
    }
    return `
      <div class="timeline-item">
        <strong>${item.type === 'swayed' ? t('swayed') : item.isReSay ? t('resay') : t('say')}</strong>
        ${esc(t('byFor', { actor: item.actorName, side: item.sideLabel }))}
        <br><span>${esc(item.body)}</span>
      </div>
    `;
  }).join('') || `<div class="empty-state">${t('noEvents')}</div>`;
}

async function refreshAfter(action) {
  try {
    await action();
    await load();
  } catch (error) {
    toast(error.message);
  }
}

document.addEventListener('click', (event) => {
  const pick = event.target.closest('[data-pick-side]');
  if (pick) {
    const topic = state.data.topic;
    const sideId = Number(pick.dataset.pickSide);
    refreshAfter(async () => {
      await api(`/api/topics/${topic.id}/pick`, {
        method: 'POST',
        body: { userId: state.userId, sideId },
      });
      toast(t('pickUpdated'));
    });
    return;
  }

  const topicButton = event.target.closest('[data-topic-id]');
  if (topicButton) {
    state.topicId = Number(topicButton.dataset.topicId);
    localStorage.setItem('pickone:topicId', String(state.topicId));
    load().catch((error) => toast(error.message));
    return;
  }

  const boost = event.target.closest('[data-boost]');
  if (boost) {
    refreshAfter(async () => {
      await api(`/api/says/${boost.dataset.boost}/boost`, {
        method: 'POST',
        body: { userId: state.userId },
      });
    });
    return;
  }

  const swayed = event.target.closest('[data-swayed]');
  if (swayed) {
    if (!confirm(t('confirmSwayed'))) return;
    const reason = prompt(t('swayedReason')) || '';
    refreshAfter(async () => {
      await api(`/api/says/${swayed.dataset.swayed}/swayed`, {
        method: 'POST',
        body: { userId: state.userId, caseText: reason },
      });
      toast(t('swayedRecorded'));
    });
    return;
  }

  const reply = event.target.closest('[data-reply]');
  if (reply) {
    const body = prompt(t('writeResay'));
    if (!body) return;
    const topic = state.data.topic;
    refreshAfter(async () => {
      await api(`/api/topics/${topic.id}/says`, {
        method: 'POST',
        body: { userId: state.userId, body, parentSayId: Number(reply.dataset.reply) },
      });
    });
    return;
  }

  const report = event.target.closest('[data-report]');
  if (report) {
    const [targetType, targetId] = report.dataset.report.split(':');
    const reason = prompt(t('reportReason', { reasons: state.data.reportReasons.join(', ') }));
    if (!reason) return;
    refreshAfter(async () => {
      await api('/api/reports', {
        method: 'POST',
        body: { userId: state.userId, targetType, targetId: Number(targetId), reason },
      });
      toast(t('reportSubmitted'));
    });
  }
});

document.addEventListener('submit', (event) => {
  const sayForm = event.target.closest('[data-say-form]');
  if (sayForm) {
    event.preventDefault();
    const body = new FormData(sayForm).get('body');
    refreshAfter(async () => {
      await api(`/api/topics/${state.data.topic.id}/says`, {
        method: 'POST',
        body: { userId: state.userId, body },
      });
      sayForm.reset();
    });
    return;
  }

  if (event.target.id === 'signup-form') {
    event.preventDefault();
    const handle = $('#signup-handle').value;
    refreshAfter(async () => {
      if (state.sessionUserId) {
        await api('/api/logout', { method: 'POST' });
        state.sessionUserId = null;
        state.sessionResolved = true;
      }
      const user = await api('/api/users', {
        method: 'POST',
        body: { handle },
      });
      state.userId = user.id;
      $('#signup-handle').value = '';
    });
  }
});

$('#user-select').addEventListener('change', (event) => {
  state.userId = Number(event.target.value);
  localStorage.setItem('pickone:userId', String(state.userId));
  refreshAfter(async () => {
    if (state.sessionUserId) {
      await api('/api/logout', { method: 'POST' });
      state.sessionUserId = null;
      state.sessionResolved = true;
    }
  });
});

$('#locale-select').addEventListener('change', (event) => {
  state.locale = normalizeLocale(event.target.value);
  localStorage.setItem('pickone:locale', state.locale);
  render();
});

load().catch((error) => toast(error.message));
