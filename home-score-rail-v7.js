(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const grid = document.getElementById('team-grid');
  if (!grid) return;

  const recentByTeam = new Map();
  const liveByTeam = new Map();
  let refreshTimer = null;
  let refreshing = false;

  function scheduleUrl(team) {
    const p = team.provider;
    return `${SITE}/${p.sport}/${p.league}/teams/${encodeURIComponent(p.team)}/schedule`;
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
    const value = score?.displayValue ?? score?.value ?? score;
    return value == null ? '' : String(value);
  }

  function eventDate(event) {
    const raw = event?.date || event?.competitions?.[0]?.date || '';
    const value = Date.parse(raw);
    return Number.isFinite(value) ? value : NaN;
  }

  function formatDate(value, includeTime = false) {
    if (!Number.isFinite(value)) return '';
    const options = includeTime
      ? { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { weekday: 'short', month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
  }

  function parseEvent(event, team) {
    if (!event) return null;
    const competition = event?.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const mine = competitors.find(competitor => competitorMatches(competitor, team));
    const other = competitors.find(competitor => competitor !== mine) || competitors[0];
    const date = eventDate(event);
    const state = eventState(event);
    return {
      state,
      date,
      mineAbbr: mine?.team?.abbreviation || String(team.provider.team || '').toUpperCase(),
      mineScore: scoreValue(mine),
      otherAbbr: other?.team?.abbreviation || 'OPP',
      otherScore: scoreValue(other),
      homeAway: mine?.homeAway || '',
      detail: competition.status?.type?.shortDetail || event.status?.type?.shortDetail || ''
    };
  }

  function findRecent(payload, team) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    const parsed = events.map(event => parseEvent(event, team)).filter(Boolean);
    const completed = parsed.filter(game => game.state === 'post').sort((a, b) => b.date - a.date);
    if (completed.length) return { kind: 'final', game: completed[0] };
    const upcoming = parsed.filter(game => game.state === 'pre' && Number.isFinite(game.date) && game.date >= Date.now() - 6 * 60 * 60 * 1000).sort((a, b) => a.date - b.date);
    if (upcoming.length) return { kind: 'next', game: upcoming[0] };
    return null;
  }

  function railText(team) {
    const live = liveByTeam.get(team.id) || window.ScoreboardLiveAwareness?.getGame?.(team.id);
    if (live) {
      return {
        live: true,
        main: `LIVE · ${live.mineAbbr || String(team.provider.team).toUpperCase()} ${live.mineScore} — ${live.otherAbbr || 'OPP'} ${live.otherScore}`,
        sub: live.detail || 'In progress'
      };
    }
    const recent = recentByTeam.get(team.id);
    if (!recent) return null;
    const game = recent.game;
    if (recent.kind === 'final') {
      const scoreText = game.mineScore !== '' && game.otherScore !== ''
        ? `${game.mineAbbr} ${game.mineScore} — ${game.otherAbbr} ${game.otherScore}`
        : `${game.mineAbbr} vs ${game.otherAbbr}`;
      return { live: false, main: `FINAL · ${scoreText}`, sub: formatDate(game.date) };
    }
    const opponentPrefix = game.homeAway === 'away' ? '@ ' : 'vs ';
    return { live: false, main: `NEXT · ${opponentPrefix}${game.otherAbbr}`, sub: formatDate(game.date, true) };
  }

  function apply() {
    const teams = Array.isArray(window.SCOREBOARD_ACTIVE_TEAMS) ? window.SCOREBOARD_ACTIVE_TEAMS : [];
    const byId = new Map(teams.map(team => [team.id, team]));
    grid.querySelectorAll('.team-card').forEach(card => {
      const team = byId.get(card.dataset.teamId);
      if (!team) return;
      const data = railText(team);
      let rail = card.querySelector('.home-score-rail');
      if (!data) {
        rail?.remove();
        return;
      }
      if (!rail) {
        rail = document.createElement('div');
        rail.className = 'home-score-rail';
        rail.setAttribute('aria-hidden', 'true');
        rail.append(document.createElement('div'), document.createElement('div'));
        rail.children[0].className = 'home-score-main';
        rail.children[1].className = 'home-score-sub';
        card.appendChild(rail);
      }
      rail.classList.toggle('live', data.live);
      rail.querySelector('.home-score-main').textContent = data.main;
      rail.querySelector('.home-score-sub').textContent = data.sub;
    });
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function refreshRecent() {
    if (refreshing || document.hidden) return;
    refreshing = true;
    try {
      const teams = Array.isArray(window.SCOREBOARD_ACTIVE_TEAMS) ? [...window.SCOREBOARD_ACTIVE_TEAMS] : [];
      await Promise.all(teams.map(async team => {
        try {
          const payload = await fetchJson(scheduleUrl(team));
          const recent = findRecent(payload, team);
          if (recent) recentByTeam.set(team.id, recent);
          else recentByTeam.delete(team.id);
        } catch {
          // Keep any prior successful rail data until the next successful refresh.
        }
      }));
      apply();
    } finally {
      refreshing = false;
    }
  }

  window.addEventListener('scoreboard:live-state', event => {
    liveByTeam.clear();
    const games = event?.detail?.games || {};
    Object.entries(games).forEach(([id, game]) => liveByTeam.set(id, game));
    apply();
  });

  const observer = new MutationObserver(apply);
  observer.observe(grid, { childList: true, subtree: false });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshRecent(); });
  window.addEventListener('online', refreshRecent);

  refreshRecent();
  refreshTimer = window.setInterval(refreshRecent, 10 * 60 * 1000);

  window.ScoreboardHomeScores = Object.freeze({ refresh: refreshRecent });
})();
