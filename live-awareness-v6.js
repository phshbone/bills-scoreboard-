(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const grid = document.getElementById('team-grid');
  if (!grid) return;

  let liveIds = new Set();
  let timer = null;
  let refreshing = false;

  function leagueKey(team) {
    return `${team.provider.sport}/${team.provider.league}`;
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

  function teamIsLive(payload, team) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    return events.some(event => {
      if (eventState(event) !== 'in') return false;
      const competitors = event?.competitions?.[0]?.competitors || [];
      return competitors.some(competitor => competitorMatches(competitor, team));
    });
  }

  function applyPills() {
    grid.querySelectorAll('.team-card').forEach(card => {
      const id = card.dataset.teamId;
      const isLive = liveIds.has(id);
      let pill = card.querySelector('.board-live-pill');
      if (isLive && !pill) {
        pill = document.createElement('span');
        pill.className = 'board-live-pill';
        pill.textContent = 'LIVE';
        pill.setAttribute('aria-hidden', 'true');
        card.appendChild(pill);
      } else if (!isLive && pill) {
        pill.remove();
      }
      if (!card.dataset.baseAriaLabel) card.dataset.baseAriaLabel = card.getAttribute('aria-label') || 'Open team';
      card.setAttribute('aria-label', isLive ? `${card.dataset.baseAriaLabel}. Game live now.` : card.dataset.baseAriaLabel);
    });
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function refresh() {
    if (refreshing || document.hidden) return;
    refreshing = true;
    try {
      const teams = Array.isArray(window.SCOREBOARD_ACTIVE_TEAMS) ? [...window.SCOREBOARD_ACTIVE_TEAMS] : [];
      const groups = new Map();
      teams.forEach(team => {
        const key = leagueKey(team);
        if (!groups.has(key)) groups.set(key, { team, teams: [] });
        groups.get(key).teams.push(team);
      });

      const next = new Set();
      await Promise.all([...groups.values()].map(async group => {
        try {
          const payload = await fetchJson(scoreboardUrl(group.team));
          group.teams.forEach(team => { if (teamIsLive(payload, team)) next.add(team.id); });
        } catch {
          // A failed league check leaves that league without a pill until the next successful refresh.
        }
      }));
      liveIds = next;
      applyPills();
    } finally {
      refreshing = false;
    }
  }

  const observer = new MutationObserver(applyPills);
  observer.observe(grid, { childList: true });

  function start() {
    refresh();
    if (timer) window.clearInterval(timer);
    timer = window.setInterval(refresh, 60000);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', refresh);
  start();

  window.ScoreboardLiveAwareness = Object.freeze({ refresh });
})();
