const query = new URLSearchParams(window.location.search);
const localeFromQuery = query.get('lang');
const userIdFromQuery = Number(query.get('userId') || 0);

const STRINGS = {
  en: {
    account: 'Account',
    activity: 'Arena Pulse',
    activityEmpty: 'No activity yet.',
    activitySubtitle: 'Recent Say and Swayed moments across active arenas.',
    admin: 'admin',
    adminPreview: 'admin preview',
    actionChangePick: 'Swayed',
    actionChangePickCount: 'Swayed ({count})',
    actionMore: 'More',
    actionReport: 'Report',
    actionSay: 'Say',
    actionSupport: 'Support',
    actionSupportCount: 'Support ({count})',
    authConfigHint: 'Set provider env vars to enable.',
    byFor: 'by {actor} for {side}',
    close: 'Close',
    composerPlaceholder: 'Make your case for {side}',
    confirmSwayed: 'Change your Pick because of this Say?',
    emptyTopics: 'No active topics.',
    forSide: 'for {side}',
    inactivePreview: 'Inactive preview',
    inactiveReadOnly: 'Inactive topics are private and read-only.',
    language: 'Language',
    loginFailed: 'Login failed: {code}',
    loginSuccess: 'Signed in with {provider}.',
    loginWith: 'Continue with {provider}',
    mine: 'Mine: {side}',
    newHandle: 'new handle',
    noMySays: 'No Says yet.',
    noPick: 'No Pick',
    noPickHistory: 'No Pick changes yet.',
    noSays: 'No Says yet.',
    noSwayedHistory: 'No Swayed records yet.',
    noTopic: 'No topic selected.',
    none: 'None',
    oauthNeeded: '{provider} setup needed',
    openTopic: 'Open topic',
    pick: 'Pick',
    pickHistory: 'Pick Changes',
    pickCount: '{count} Picks',
    picked: 'Picked',
    pickFirstCase: 'Pick first to make your case.',
    pickUpdated: 'Pick updated.',
    private: 'Private',
    profile: 'My Argument Trail',
    profileSubtitle: '@{handle} · {count} argument moments',
    report: 'Report',
    reportReason: 'Report reason: {reasons}',
    reportSubmitted: 'Report submitted.',
    requestFailed: 'Request failed.',
    resay: 'Say',
    say: 'Say',
    sayCount: '{count} Says',
    sideStats: '{picks} Picks · {says} Says',
    signUp: 'Sign up',
    swayed: 'Swayed',
    swayedHistory: 'Swayed Records',
    swayedReason: 'Optional: why did it sway you?',
    swayedRecorded: 'Swayed recorded.',
    tagline: 'Pick one. Change or defend your mind.',
    topics: 'Topics',
    writeResay: 'Write a Say',
    mySays: 'My Says',
    yourSay: 'Your Say',
  },
  ko: {
    account: '계정',
    activity: '흐름',
    activityEmpty: '아직 활동이 없습니다.',
    activitySubtitle: '진행 중 Arena의 Say, Swayed 흐름입니다.',
    admin: '관리자',
    adminPreview: '관리자 미리보기',
    actionChangePick: 'Swayed',
    actionChangePickCount: 'Swayed {count}',
    actionMore: '더보기',
    actionReport: '신고',
    actionSay: 'Say',
    actionSupport: 'Support',
    actionSupportCount: 'Support {count}',
    authConfigHint: '환경 변수를 설정하면 켜집니다.',
    byFor: '{actor} · {side}',
    close: '닫기',
    composerPlaceholder: '{side} 쪽 주장을 남겨주세요',
    confirmSwayed: '이 Say 때문에 Pick을 바꿀까요?',
    emptyTopics: '진행 중인 토픽이 없습니다.',
    forSide: '{side} 쪽',
    inactivePreview: '비공개 미리보기',
    inactiveReadOnly: '비공개 토픽은 읽기만 가능합니다.',
    language: '언어',
    loginFailed: '로그인 실패: {code}',
    loginSuccess: '{provider}로 로그인했습니다.',
    loginWith: '{provider} 로그인',
    mine: '내 Pick: {side}',
    newHandle: '새 핸들',
    noMySays: '아직 내 Say가 없습니다.',
    noPick: 'Pick 없음',
    noPickHistory: '아직 Pick 변경 기록이 없습니다.',
    noSays: '아직 Say가 없습니다.',
    noSwayedHistory: '아직 Swayed 기록이 없습니다.',
    noTopic: '선택된 토픽이 없습니다.',
    none: '없음',
    oauthNeeded: '{provider} 설정 필요',
    openTopic: '토픽 열기',
    pick: 'Pick',
    pickHistory: 'Pick 변화',
    pickCount: '{count} Pick',
    picked: 'Picked',
    pickFirstCase: '먼저 Pick해야 주장을 남길 수 있습니다.',
    pickUpdated: 'Pick이 변경됐습니다.',
    private: '비공개',
    profile: '내 주장 기록',
    profileSubtitle: '@{handle} · 주장 기록 {count}개',
    report: '신고',
    reportReason: '신고 사유: {reasons}',
    reportSubmitted: '신고가 접수됐습니다.',
    requestFailed: '요청에 실패했습니다.',
    resay: 'Say',
    say: 'Say',
    sayCount: '{count} Say',
    sideStats: 'Pick {picks} · Say {says}',
    signUp: '가입',
    swayed: 'Swayed',
    swayedHistory: '설득된 기록',
    swayedReason: '선택 사항: 왜 설득됐나요?',
    swayedRecorded: 'Swayed가 기록됐습니다.',
    tagline: '하나를 고르고, 설득하거나 바꿔라.',
    topics: '토픽',
    writeResay: 'Say 쓰기',
    mySays: '내 Say',
    yourSay: '내 Say',
  },
};

const state = {
  locale: normalizeLocale(localeFromQuery || localStorage.getItem('pickone:locale') || navigator.language),
  view: normalizeView(query.get('view') || localStorage.getItem('pickone:view')),
  userId: userIdFromQuery || Number(localStorage.getItem('pickone:userId') || 1),
  topicId: Number(query.get('topicId') || localStorage.getItem('pickone:topicId') || 0) || null,
  data: null,
  authProviders: [],
  profileOpen: query.get('profile') === '1' || window.location.hash === '#profile',
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

function normalizeView(value) {
  return value === 'activity' ? 'activity' : 'topics';
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

function icon(name) {
  const paths = {
    support: '<path d="M7 10v10"/><path d="M15 6.5 14 10h5.5l-1.2 8.4A2 2 0 0 1 16.3 20H7V10l4.2-6.3A1.8 1.8 0 0 1 14.5 5l.5 1.5Z"/>',
    swayed: '<path d="M7 7h10v10"/><path d="m7 17 10-10"/><path d="M17 17H7V7"/>',
    say: '<path d="M5 7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v4A3.5 3.5 0 0 1 15.5 15H11l-4.5 4v-4A3.5 3.5 0 0 1 5 11.5Z"/>',
    report: '<path d="M6 21V4"/><path d="M6 5h11l-2 4 2 4H6"/>',
  };
  return `<svg class="action-icon" aria-hidden="true" viewBox="0 0 24 24">${paths[name] || ''}</svg>`;
}

function renderActionButton({ className, dataAttr, iconName, label, count, disabled = false, active = false, hideLabel = false }) {
  const text = count == null ? label : `${label} ${count}`;
  return `
    <button class="action-button ${className} ${active ? 'active' : ''}" ${dataAttr} title="${esc(text)}" aria-label="${esc(text)}" ${disabled ? 'disabled' : ''}>
      ${icon(iconName)}
      ${hideLabel ? '' : `<span>${esc(label)}</span>`}
      ${count == null ? '' : `<strong>${count}</strong>`}
    </button>
  `;
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
  localStorage.setItem('pickone:view', state.view);
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
  renderActivityView();
  renderProfilePanel();
}

function renderChrome() {
  document.documentElement.lang = state.locale;
  $('#brand-tagline').textContent = t('tagline');
  $('#account-label').textContent = t('account');
  $('#language-label').textContent = t('language');
  $('#topics-title').textContent = t('topics');
  $('#profile-button').textContent = t('profile');
  $('#signup-handle').placeholder = t('newHandle');
  $('#signup-button').textContent = t('signUp');
  $('#locale-select').value = state.locale;
  $('#topics-view-button').textContent = t('topics');
  $('#activity-view-button').textContent = t('activity');
  $('#topics-view-button').classList.toggle('active', state.view === 'topics');
  $('#activity-view-button').classList.toggle('active', state.view === 'activity');
  $('#topics-view-button').setAttribute('aria-pressed', String(state.view === 'topics'));
  $('#activity-view-button').setAttribute('aria-pressed', String(state.view === 'activity'));
  $('.rail').hidden = state.view !== 'topics';
  $('#topic-detail').hidden = state.view !== 'topics';
  $('#activity-view').hidden = state.view !== 'activity';
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

  target.innerHTML = `
    ${renderTopicPanel(topic)}
    ${renderTopicSays(topic)}
  `;
}

function renderTopicPanel(topic) {
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

  return `
    <section class="topic-panel">
      <div class="topic-actions">
        ${renderActionButton({
          className: 'report quiet',
          dataAttr: `data-report="topic:${topic.id}"`,
          iconName: 'report',
          label: t('actionReport'),
          hideLabel: true,
        })}
      </div>
      <h2>${esc(topic.question)}</h2>
      ${renderTensionMeter(topic)}
      <div class="side-picks">${sideChoices}</div>
      ${renderComposer(topic)}
    </section>
  `;
}

function renderTensionMeter(topic) {
  const [left, right] = topic.sides;
  if (!left || !right) return '';
  const total = Math.max(1, left.pickCount + right.pickCount);
  const leftWidth = Math.round((left.pickCount / total) * 100);
  return `
    <div class="tension-meter" aria-hidden="true">
      <span style="--side-color:${esc(left.color)}; width:${leftWidth}%"></span>
      <i>VS</i>
      <span style="--side-color:${esc(right.color)}; width:${100 - leftWidth}%"></span>
    </div>
  `;
}

function renderTopicSays(topic) {
  return `
    <section class="arguments-section">
      <div class="lanes">
        ${topic.sides.map((side, index) => renderLane(topic, side, index)).join('')}
      </div>
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
        <button class="primary" type="submit">${t('say')}</button>
      </div>
    </form>
  `;
}

function renderLane(topic, side, index) {
  const says = topic.says.filter((say) => say.sideId === side.id);
  return `
    <div class="lane lane-${index % 2 === 0 ? 'left' : 'right'}" style="--side-color:${esc(side.color)}">
      <div class="lane-title">
        <span><span class="dot" style="background:${esc(side.color)}"></span> ${esc(side.label)}</span>
        <span class="hint">${t('sayCount', { count: says.length })}</span>
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
    <article class="say-card ${isReply ? 'reply' : ''}" style="border-left-color:${esc(say.sideColor)}">
      <div class="say-meta">
        <span class="side-badge"><span class="dot" style="background:${esc(say.sideColor)}"></span>${esc(say.sideLabel)}</span>
        <span>${esc(say.authorName)}</span>
        ${replyLabel}
        <span>${time(say.createdAt)}</span>
      </div>
      <p class="say-body">${esc(say.body)}</p>
      <div class="say-actions">
        ${renderActionButton({
          className: 'support',
          dataAttr: `data-boost="${say.id}"`,
          iconName: 'support',
          label: t('actionSupport'),
          count: say.boostCount,
          disabled: !canBoost,
          active: say.boostedByCurrentUser,
        })}
        ${renderActionButton({
          className: 'swayed',
          dataAttr: `data-swayed="${say.id}"`,
          iconName: 'swayed',
          label: t('actionChangePick'),
          count: say.swayCount,
          disabled: !canSwayed,
        })}
        ${renderActionButton({
          className: 'say',
          dataAttr: `data-reply="${say.id}"`,
          iconName: 'say',
          label: t('actionSay'),
          disabled: !(canParticipate && say.eligible),
        })}
        ${renderActionButton({
          className: 'report quiet',
          dataAttr: `data-report="say:${say.id}"`,
          iconName: 'report',
          label: t('actionReport'),
          hideLabel: true,
        })}
      </div>
      <div class="reply-list">
        ${(say.replies || []).map((reply) => renderSay(topic, reply, true)).join('')}
      </div>
    </article>
  `;
}

function renderActivityView() {
  const node = $('#activity-view');
  node.innerHTML = `
    <section class="activity-header">
      <div>
        <div class="section-title">${t('activity')}</div>
        <h2>${t('activity')}</h2>
        <p>${t('activitySubtitle')}</p>
      </div>
    </section>
    <section class="activity-list">
      ${state.data.globalTimeline.map(renderActivityItem).join('') || `<div class="empty-state">${t('activityEmpty')}</div>`}
    </section>
  `;
}

function renderActivityItem(item) {
  const label = item.type === 'swayed' ? t('swayed') : item.isReSay ? t('resay') : t('say');
  return `
    <article class="activity-item">
      <div class="activity-meta">
        <strong>${label}</strong>
        <span>${time(item.createdAt)}</span>
      </div>
      <h3>${esc(item.topicQuestion)}</h3>
      <p class="hint">${esc(t('byFor', { actor: item.actorName, side: item.sideLabel }))}</p>
      <p>${esc(item.body)}</p>
      <button type="button" data-open-topic="${item.topicId}">${t('openTopic')}</button>
    </article>
  `;
}

function renderProfilePanel() {
  const panel = $('#profile-panel');
  const backdrop = $('#profile-backdrop');
  const trigger = $('#profile-button');
  panel.hidden = !state.profileOpen;
  backdrop.hidden = !state.profileOpen;
  trigger.setAttribute('aria-expanded', String(state.profileOpen));
  if (!state.profileOpen) {
    panel.innerHTML = '';
    return;
  }

  const user = state.data.currentUser;
  const profile = state.data.personalProfile;
  const mySays = profile?.mySays ?? state.data.personalTimeline.filter((item) => item.type === 'own_say');
  const pickHistory = profile?.pickHistory ?? state.data.personalTimeline.filter((item) => item.type === 'pick' && item.source !== 'swayed');
  const swayedHistory = profile?.swayedHistory ?? state.data.personalTimeline.filter((item) => item.type === 'pick' && item.source === 'swayed');
  const eventCount = mySays.length + pickHistory.length + swayedHistory.length;

  panel.innerHTML = `
    <div class="profile-header">
      <div>
        <div class="section-title">${t('profile')}</div>
        <h2 id="profile-title">${esc(user.displayName)}</h2>
        <p>${esc(t('profileSubtitle', { handle: user.handle, count: eventCount }))}</p>
      </div>
      <button type="button" data-profile-close>${t('close')}</button>
    </div>
    ${renderProfileSection(t('mySays'), mySays, 'say', t('noMySays'))}
    ${renderProfileSection(t('pickHistory'), pickHistory, 'pick', t('noPickHistory'))}
    ${renderProfileSection(t('swayedHistory'), swayedHistory, 'swayed', t('noSwayedHistory'))}
  `;
}

function openProfile() {
  state.profileOpen = true;
  renderProfilePanel();
  $('#profile-panel').focus();
}

function closeProfile() {
  state.profileOpen = false;
  renderProfilePanel();
  $('#profile-button').focus();
}

function renderProfileSection(title, items, kind, emptyText) {
  return `
    <section class="profile-section">
      <div class="profile-section-title">
        <span>${esc(title)}</span>
        <span class="hint">${items.length}</span>
      </div>
      <div class="profile-list">
        ${items.map((item) => renderProfileItem(item, kind)).join('') || `<div class="empty-state">${esc(emptyText)}</div>`}
      </div>
    </section>
  `;
}

function renderProfileItem(item, kind) {
  if (kind === 'say') {
    return `
      <div class="profile-item">
        <div class="profile-item-meta">
          <strong>${esc(item.toLabel)}</strong>
          <span>${time(item.createdAt)}</span>
        </div>
        <span class="hint">${esc(item.topicQuestion)}</span>
        <p>${esc(item.sourceBody)}</p>
      </div>
    `;
  }

  const fromLabel = item.fromLabel || t('none');
  return `
    <div class="profile-item">
      <div class="profile-item-meta">
        <strong>${kind === 'swayed' ? t('swayed') : t('pick')}</strong>
        <span>${time(item.createdAt)}</span>
      </div>
      <span class="hint">${esc(item.topicQuestion)}</span>
      <p>${esc(fromLabel)} -> ${esc(item.toLabel)}</p>
      ${item.sourceBody ? `<p class="profile-source">${esc(item.sourceBody)}</p>` : ''}
    </div>
  `;
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
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    state.view = normalizeView(viewButton.dataset.view);
    localStorage.setItem('pickone:view', state.view);
    render();
    return;
  }

  if (event.target.closest('[data-profile-open]')) {
    openProfile();
    return;
  }

  if (event.target.closest('[data-profile-close]')) {
    closeProfile();
    return;
  }

  const activityTopic = event.target.closest('[data-open-topic]');
  if (activityTopic) {
    state.topicId = Number(activityTopic.dataset.openTopic);
    state.view = 'topics';
    localStorage.setItem('pickone:view', state.view);
    localStorage.setItem('pickone:topicId', String(state.topicId));
    load().catch((error) => toast(error.message));
    return;
  }

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

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.profileOpen) {
    closeProfile();
  }
});

load().catch((error) => toast(error.message));
