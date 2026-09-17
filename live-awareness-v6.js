(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const grid = document.getElementById('team-grid');
  if (!grid) return;

  let liveIds = new Set();
  let liveGames = new Map();
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

  function scoreValue(competitor) {
    const score = competitor?.score;
    return String(score?.displayValue ?? score?.value ?? score ?? '—');
  }

  function liveGame(payload, team) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    const event = events.find(item => {
      if (eventState(item) !== 'in') return false;
      const competitors = item?.competitions?.[0]?.competitors || [];
      return competitors.some(competitor => competitorMatches(competitor, team));
    });
    if (!event) return null;
    const competition = event?.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const mine = competitors.find(competitor => competitorMatches(competitor, team));
    const other = competitors.find(competitor => competitor !== mine) || competitors[0];
    const statusType = competition.status?.type || event.status?.type || {};
    return {
      state: 'in',
      detail: statusType.shortDetail || statusType.detail || 'In progress',
      mineName: mine?.team?.shortDisplayName || mine?.team?.displayName || team.name,
      mineAbbr: mine?.team?.abbreviation || String(team.provider.team || '').toUpperCase(),
      mineScore: scoreValue(mine),
      otherName: other?.team?.shortDisplayName || other?.team?.displayName || 'Opponent',
      otherAbbr: other?.team?.abbreviation || 'OPP',
      otherScore: scoreValue(other)
    };
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

  function publish() {
    const games = {};
    liveGames.forEach((game, id) => { games[id] = game; });
    window.dispatchEvent(new CustomEvent('scoreboard:live-state', { detail: { games } }));
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

      const nextIds = new Set();
      const nextGames = new Map();
      await Promise.all([...groups.values()].map(async group => {
        try {
          const payload = await fetchJson(scoreboardUrl(group.team));
          await Promise.all(group.teams.map(async team => {
            let game = liveGame(payload, team);
            if (!game && (team?.league === 'MLB' || team?.sport === 'baseball') && window.ScoreboardLiveFeed?.fetchCurrentGame) {
              try {
                game = await window.ScoreboardLiveFeed.fetchCurrentGame(team, payload);
              } catch {
                game = null;
              }
            }
            if (!game || game.state !== 'in') return;
            nextIds.add(team.id);
            nextGames.set(team.id, game);
          }));
        } catch {
          // A failed league check leaves that league without a pill until the next successful refresh.
        }
      }));
      liveIds = nextIds;
      liveGames = nextGames;
      applyPills();
      publish();
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

  window.ScoreboardLiveAwareness = Object.freeze({
    refresh,
    getGame: teamId => liveGames.get(teamId) || null
  });
})();
