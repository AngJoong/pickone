const state = {
  userId: Number(localStorage.getItem('pickone:userId') || 1),
  topicId: Number(localStorage.getItem('pickone:topicId') || 0) || null,
  data: null,
};

const $ = (selector) => document.querySelector(selector);

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function time(value) {
  return new Intl.DateTimeFormat('en', {
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
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request failed.');
  }
  return payload;
}

async function load() {
  const params = new URLSearchParams({ userId: String(state.userId) });
  if (state.topicId) params.set('topicId', String(state.topicId));
  state.data = await api(`/api/state?${params.toString()}`);
  state.userId = state.data.currentUser.id;
  state.topicId = state.data.topic?.id ?? null;
  localStorage.setItem('pickone:userId', String(state.userId));
  if (state.topicId) localStorage.setItem('pickone:topicId', String(state.topicId));
  render();
}

function render() {
  renderUsers();
  renderTopics();
  renderTopicDetail();
  renderTimeline('#global-timeline', state.data.globalTimeline, 'global');
  renderTimeline('#personal-timeline', state.data.personalTimeline, 'personal');
}

function renderUsers() {
  const select = $('#user-select');
  select.innerHTML = state.data.users.map((user) => `
    <option value="${user.id}" ${user.id === state.userId ? 'selected' : ''}>
      ${esc(user.displayName)}${user.isAdmin ? ' (admin)' : ''}
    </option>
  `).join('');
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
        <span>${topic.pickCount} Picks</span>
        <span>${topic.sayCount} Says</span>
        ${topic.currentPick ? `<span>Mine: ${esc(topic.currentPick.sideLabel)}</span>` : '<span>No Pick</span>'}
        ${topic.status === 'inactive' ? '<span>admin preview</span>' : ''}
      </div>
    </button>
  `).join('') || '<div class="empty-state">No active topics.</div>';
}

function renderTopicDetail() {
  const topic = state.data.topic;
  const target = $('#topic-detail');
  if (!topic) {
    target.innerHTML = '<div class="empty-state">No topic selected.</div>';
    return;
  }

  const sideChoices = topic.sides.map((side) => `
    <div class="side-choice">
      <span class="side-swatch" style="background:${esc(side.color)}"></span>
      <div>
        <strong>${esc(side.label)}</strong>
        <span>${side.pickCount} Picks · ${side.sayCount} Says</span>
      </div>
      ${topic.status === 'active' ? `
        <button class="${topic.currentPick?.sideId === side.id ? '' : 'primary'}" data-pick-side="${side.id}">
          ${topic.currentPick?.sideId === side.id ? 'Picked' : 'Pick'}
        </button>
      ` : '<span class="hint">Private</span>'}
    </div>
  `).join('');

  target.innerHTML = `
    <section class="topic-header">
      <div class="topic-kicker">
        <span>${topic.status === 'active' ? 'Active topic' : 'Inactive preview'}</span>
        <button data-report="topic:${topic.id}">Report</button>
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
        <span class="hint">Inactive topics are private and read-only.</span>
      </section>
    `;
  }
  if (!topic.currentPick) {
    return `
      <section class="pick-strip">
        <span class="hint">Pick a side before writing, Boosting, or using Swayed.</span>
      </section>
    `;
  }

  const currentSide = topic.sides.find((side) => side.id === topic.currentPick.sideId);
  const changeButtons = topic.sides
    .filter((side) => side.id !== topic.currentPick.sideId)
    .map((side) => `<button data-pick-side="${side.id}">Change to ${esc(side.label)}</button>`)
    .join('');
  return `
    <section class="pick-strip">
      <div class="pick-current">
        <span class="dot" style="background:${esc(currentSide.color)}"></span>
        Current Pick: ${esc(currentSide.label)}
      </div>
      <div>${changeButtons}</div>
    </section>
  `;
}

function renderComposer(topic) {
  if (topic.status !== 'active') {
    return '<section class="composer"><span class="hint">Inactive topics are private and read-only.</span></section>';
  }
  if (!topic.currentPick) {
    return '<section class="composer"><span class="hint">Pick first to make your case.</span></section>';
  }
  const side = topic.sides.find((item) => item.id === topic.currentPick.sideId);
  return `
    <form class="composer" data-say-form>
      <textarea name="body" maxlength="600" placeholder="Make your case for ${esc(side.label)}"></textarea>
      <div class="composer-footer">
        <span class="hint">New Says use your current Pick snapshot.</span>
        <button class="primary" type="submit">Say</button>
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
        <span class="hint">${says.length} root Says</span>
      </div>
      <div class="say-list">
        ${says.map((say) => renderSay(topic, say, false)).join('') || '<div class="empty-state">No Says yet.</div>'}
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
          ${say.boostedByCurrentUser ? 'Boosted' : 'Boost'} · ${say.boostCount}
        </button>
        <button class="primary" data-swayed="${say.id}" ${canSwayed ? '' : 'disabled'}>
          Swayed · ${say.swayCount}
        </button>
        <button data-reply="${say.id}" ${canParticipate && say.eligible ? '' : 'disabled'}>ReSay</button>
        <button data-report="say:${say.id}">Report</button>
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
            <strong>${item.source === 'swayed' ? 'Swayed' : 'Pick'}</strong>
            ${esc(item.fromLabel || 'None')} -> ${esc(item.toLabel)}
            <br><span>${esc(item.topicQuestion)}</span>
          </div>
        `;
      }
      return `
        <div class="timeline-item">
          <strong>Your Say</strong> for ${esc(item.toLabel)}
          <br><span>${esc(item.sourceBody)}</span>
        </div>
      `;
    }
    return `
      <div class="timeline-item">
        <strong>${item.type === 'swayed' ? 'Swayed' : item.isReSay ? 'ReSay' : 'Say'}</strong>
        by ${esc(item.actorName)} for ${esc(item.sideLabel)}
        <br><span>${esc(item.body)}</span>
      </div>
    `;
  }).join('') || '<div class="empty-state">No events yet.</div>';
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
      toast('Pick updated.');
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
    if (!confirm('Change your Pick because of this Say?')) return;
    const reason = prompt('Optional: why did it sway you?') || '';
    refreshAfter(async () => {
      await api(`/api/says/${swayed.dataset.swayed}/swayed`, {
        method: 'POST',
        body: { userId: state.userId, caseText: reason },
      });
      toast('Swayed recorded.');
    });
    return;
  }

  const reply = event.target.closest('[data-reply]');
  if (reply) {
    const body = prompt('Write a ReSay');
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
    const reason = prompt(`Report reason: ${state.data.reportReasons.join(', ')}`);
    if (!reason) return;
    refreshAfter(async () => {
      await api('/api/reports', {
        method: 'POST',
        body: { userId: state.userId, targetType, targetId: Number(targetId), reason },
      });
      toast('Report submitted.');
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
  load().catch((error) => toast(error.message));
});

load().catch((error) => toast(error.message));
