(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const NEXT_WINDOW_MS = 6 * 60 * 60 * 1000;
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
    return {
      state: eventState(event),
      date: eventDate(event),
      mineAbbr: mine?.team?.abbreviation || String(team.provider.team || '').toUpperCase(),
      mineScore: scoreValue(mine),
      otherAbbr: other?.team?.abbreviation || 'OPP',
      otherScore: scoreValue(other),
      homeAway: mine?.homeAway || '',
      detail: competition.status?.type?.shortDetail || event.status?.type?.shortDetail || ''
    };
  }

  function findRecent(payload, team, now = Date.now()) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    const parsed = events.map(event => parseEvent(event, team)).filter(Boolean);

    const upcoming = parsed
      .filter(game => game.state === 'pre' && Number.isFinite(game.date) && game.date >= now && game.date - now <= NEXT_WINDOW_MS)
      .sort((a, b) => a.date - b.date);
    if (upcoming.length) return { kind: 'next', game: upcoming[0] };

    const completed = parsed
      .filter(game => game.state === 'post' && Number.isFinite(game.date) && game.date <= now)
      .sort((a, b) => b.date - a.date);
    if (completed.length) return { kind: 'final', game: completed[0] };

    const future = parsed
      .filter(game => game.state === 'pre' && Number.isFinite(game.date) && game.date >= now)
      .sort((a, b) => a.date - b.date);
    return future.length ? { kind: 'next', game: future[0] } : null;
  }

  function railText(team) {
    const live = liveByTeam.get(team.id) || window.ScoreboardLiveAwareness?.getGame?.(team.id);
    if (live) {
      return {
        live: true,
        text: `LIVE · ${live.mineAbbr || String(team.provider.team).toUpperCase()} ${live.mineScore} — ${live.otherAbbr || 'OPP'} ${live.otherScore} · ${live.detail || 'In progress'}`
      };
    }

    const recent = recentByTeam.get(team.id);
    if (!recent) return null;
    const game = recent.game;
    if (recent.kind === 'final') {
      const score = game.mineScore !== '' && game.otherScore !== ''
        ? `${game.mineAbbr} ${game.mineScore} — ${game.otherAbbr} ${game.otherScore}`
        : `${game.mineAbbr} vs ${game.otherAbbr}`;
      return { live: false, text: `FINAL · ${score} · ${formatDate(game.date)}` };
    }

    const opponent = `${game.homeAway === 'away' ? '@ ' : 'vs '}${game.otherAbbr}`;
    return { live: false, text: `NEXT · ${opponent} · ${formatDate(game.date, true)}` };
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
        const line = document.createElement('div');
        line.className = 'home-score-line';
        rail.appendChild(line);
        card.appendChild(rail);
      }
      rail.classList.toggle('live', data.live);
      rail.querySelector('.home-score-line').textContent = data.text;
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
          // Preserve prior successful rail data until a later refresh succeeds.
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

  new MutationObserver(apply).observe(grid, { childList: true, subtree: false });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshRecent(); });
  window.addEventListener('online', refreshRecent);

  refreshRecent();
  refreshTimer = window.setInterval(refreshRecent, 10 * 60 * 1000);
  window.ScoreboardHomeScores = Object.freeze({ refresh: refreshRecent });
})();
