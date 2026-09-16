(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const teamPage = document.getElementById('data-modal');
  const dataGrid = document.getElementById('data-grid');
  let refreshTimer = null;
  let activeTeam = null;

  function el(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  function currentTeam() {
    const id = teamPage?.dataset?.teamId;
    return Array.isArray(window.SCOREBOARD_TEAMS)
      ? window.SCOREBOARD_TEAMS.find(team => team.id === id) || null
      : null;
  }

  function scheduleUrl(team) {
    const p = team.provider;
    return `${SITE}/${p.sport}/${p.league}/teams/${p.team}/schedule`;
  }

  function eventState(event) {
    const type = event?.competitions?.[0]?.status?.type || event?.status?.type || {};
    if (type.completed === true) return 'post';
    return type.state || '';
  }

  function eventForTeam(payload) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    return events.find(event => eventState(event) === 'in')
      || events.filter(event => eventState(event) === 'post').sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0))[0]
      || null;
  }

  function parseEvent(event, team) {
    if (!event) return null;
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const mine = competitors.find(c => String(c.team?.abbreviation || '').toLowerCase() === String(team.provider.team).toLowerCase())
      || competitors.find(c => String(c.team?.id || '') === String(team.provider.team));
    const other = competitors.find(c => c !== mine) || competitors[0];
    const statusType = competition.status?.type || event.status?.type || {};
    const detail = statusType.shortDetail || statusType.detail || '';
    const mineScore = mine?.score?.displayValue ?? mine?.score?.value ?? mine?.score ?? '—';
    const otherScore = other?.score?.displayValue ?? other?.score?.value ?? other?.score ?? '—';
    return {
      state: eventState(event),
      detail,
      mineName: mine?.team?.shortDisplayName || mine?.team?.displayName || team.name,
      mineScore: String(mineScore),
      otherName: other?.team?.shortDisplayName || other?.team?.displayName || other?.team?.abbreviation || 'Opponent',
      otherScore: String(otherScore)
    };
  }

  function ensureOverlay() {
    let overlay = document.getElementById('live-score-overlay');
    if (overlay) return overlay;

    overlay = el('div', 'live-score-overlay');
    overlay.id = 'live-score-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'live-score-heading');

    const card = el('section', 'live-score-card');
    const top = el('div', 'live-score-top');
    const heading = el('h3', 'live-score-title', 'Live score');
    heading.id = 'live-score-heading';
    const status = el('span', 'live-score-status', 'LIVE');
    status.id = 'live-score-status';
    top.append(heading, status);

    const body = el('div', 'live-score-body');
    body.id = 'live-score-body';
    const actions = el('div', 'live-score-actions');
    const refresh = el('button', 'button', 'Refresh');
    refresh.type = 'button';
    refresh.id = 'live-score-refresh';
    const close = el('button', 'button', 'Close');
    close.type = 'button';
    close.id = 'live-score-close';
    actions.append(refresh, close);
    card.append(top, body, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    close.addEventListener('click', closeOverlay);
    refresh.addEventListener('click', refreshScore);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeOverlay(); });
    return overlay;
  }

  function renderLoading() {
    const body = ensureOverlay().querySelector('#live-score-body');
    body.replaceChildren(el('div', 'live-score-detail', 'Updating score…'));
  }

  function renderGame(game) {
    const overlay = ensureOverlay();
    const body = overlay.querySelector('#live-score-body');
    const status = overlay.querySelector('#live-score-status');
    const heading = overlay.querySelector('#live-score-heading');
    heading.textContent = activeTeam?.name || 'Live score';
    status.textContent = game?.state === 'in' ? 'LIVE' : 'FINAL';

    if (!game) {
      body.replaceChildren(el('div', 'live-score-detail live-score-error', 'No current game was returned.'));
      return;
    }

    const mine = el('div', 'live-score-line');
    mine.append(el('div', 'live-score-team', game.mineName), el('div', 'live-score-number', game.mineScore));
    const other = el('div', 'live-score-line');
    other.append(el('div', 'live-score-team', game.otherName), el('div', 'live-score-number', game.otherScore));
    const detail = el('div', 'live-score-detail', game.detail || (game.state === 'post' ? 'Final' : 'In progress'));
    const updated = el('div', 'live-score-updated', `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date())}`);
    body.replaceChildren(mine, other, detail, updated);
  }

  async function refreshScore() {
    if (!activeTeam) return;
    try {
      const response = await fetch(scheduleUrl(activeTeam), { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const event = eventForTeam(payload);
      const game = parseEvent(event, activeTeam);
      renderGame(game);
      if (game?.state !== 'in') stopTimer();
    } catch (error) {
      const body = ensureOverlay().querySelector('#live-score-body');
      body.replaceChildren(el('div', 'live-score-detail live-score-error', `Live score temporarily unavailable. ${error.message}`));
    }
  }

  function startTimer() {
    stopTimer();
    refreshTimer = window.setInterval(refreshScore, 30000);
  }

  function stopTimer() {
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function openOverlay() {
    activeTeam = currentTeam();
    if (!activeTeam) return;
    const overlay = ensureOverlay();
    overlay.hidden = false;
    renderLoading();
    refreshScore();
    startTimer();
    overlay.querySelector('#live-score-close')?.focus();
  }

  function closeOverlay() {
    stopTimer();
    const overlay = document.getElementById('live-score-overlay');
    if (overlay) overlay.hidden = true;
    activeTeam = null;
    document.querySelector('.live-score-trigger')?.focus();
  }

  function decorateLivePanel() {
    if (!dataGrid || teamPage?.hidden) return;
    dataGrid.querySelectorAll('.data-panel').forEach(panel => {
      const label = panel.querySelector('.data-label')?.textContent?.trim().toLowerCase();
      if (label !== 'live now' || panel.dataset.liveScoreReady === 'true') return;
      panel.dataset.liveScoreReady = 'true';
      panel.classList.add('live-score-trigger');
      panel.tabIndex = 0;
      panel.setAttribute('role', 'button');
      panel.setAttribute('aria-label', 'Open live score');
      panel.addEventListener('click', openOverlay);
      panel.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openOverlay();
        }
      });
    });
  }

  const observer = new MutationObserver(decorateLivePanel);
  if (dataGrid) observer.observe(dataGrid, { childList: true, subtree: true });
  decorateLivePanel();

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('live-score-overlay')?.hidden) {
      event.stopPropagation();
      closeOverlay();
    }
  });
})();
