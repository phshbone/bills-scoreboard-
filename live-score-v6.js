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

  function scoreboardUrl(team) {
    const p = team.provider;
    return `${SITE}/${p.sport}/${p.league}/scoreboard`;
  }

  function eventState(event) {
    const type = event?.competitions?.[0]?.status?.type || event?.status?.type || {};
    if (type.completed === true) return 'post';
    return type.state || '';
  }

  function competitorMatches(competitor, team) {
    const key = String(team.provider.team || '').toLowerCase();
    const id = String(competitor?.team?.id || '').toLowerCase();
    const abbr = String(competitor?.team?.abbreviation || '').toLowerCase();
    return id === key || abbr === key;
  }

  function containsTeam(event, team) {
    const competitors = event?.competitions?.[0]?.competitors || [];
    return competitors.some(competitor => competitorMatches(competitor, team));
  }

  function eventForTeam(payload, team) {
    const events = Array.isArray(payload?.events) ? payload.events.filter(event => containsTeam(event, team)) : [];
    return events.find(event => eventState(event) === 'in')
      || events.filter(event => eventState(event) === 'post').sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0))[0]
      || null;
  }

  function scoreValue(competitor) {
    const score = competitor?.score;
    return String(score?.displayValue ?? score?.value ?? score ?? '—');
  }

  function parseEvent(event, team) {
    if (!event) return null;
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const mine = competitors.find(competitor => competitorMatches(competitor, team));
    const other = competitors.find(competitor => competitor !== mine) || competitors[0];
    const statusType = competition.status?.type || event.status?.type || {};
    const detail = statusType.shortDetail || statusType.detail || '';
    return {
      state: eventState(event),
      detail,
      mineName: mine?.team?.shortDisplayName || mine?.team?.displayName || team.name,
      mineScore: scoreValue(mine),
      otherName: other?.team?.shortDisplayName || other?.team?.displayName || other?.team?.abbreviation || 'Opponent',
      otherScore: scoreValue(other)
    };
  }

  async function fetchScoreboard(team) {
    const response = await fetch(scoreboardUrl(team), { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
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

    if (!game) {
      status.textContent = '—';
      body.replaceChildren(el('div', 'live-score-detail live-score-error', 'No current game was returned.'));
      return;
    }

    status.textContent = game.state === 'in' ? 'LIVE' : 'FINAL';
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
      const payload = await fetchScoreboard(activeTeam);
      const event = eventForTeam(payload, activeTeam);
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
      event.stopImmediatePropagation();
      closeOverlay();
    }
  });

  window.ScoreboardLiveFeed = Object.freeze({ scoreboardUrl, eventState, containsTeam, parseEvent, fetchScoreboard });
})();
