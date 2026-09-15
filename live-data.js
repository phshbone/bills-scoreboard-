(() => {
  'use strict';

  const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
  const dataModal = document.getElementById('data-modal');
  const dataTitle = document.getElementById('data-title');
  const dataGrid = document.getElementById('data-grid');
  const dataStatusDot = document.getElementById('data-status-dot');
  const dataStatusText = document.getElementById('data-status-text');
  const closeData = document.getElementById('close-data');
  const retryData = document.getElementById('retry-data');
  const dataCache = new Map();
  let currentTeam = null;

  function endpoint(team, resource = '') {
    const p = team.provider;
    const root = `${ESPN_BASE}/${p.sport}/${p.league}/teams/${p.team}`;
    return resource ? `${root}/${resource}` : root;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function recordSummary(teamObj) {
    if (!teamObj) return '—';
    if (teamObj.recordSummary) return teamObj.recordSummary;
    const items = teamObj.record?.items || [];
    const total = items.find(item => item.type === 'total' || item.name === 'overall') || items[0];
    return total?.summary || total?.displayValue || '—';
  }

  function flattenRoster(payload) {
    const source = payload?.athletes || payload?.items || [];
    const players = [];
    source.forEach(group => {
      if (Array.isArray(group?.items)) players.push(...group.items);
      else if (Array.isArray(group?.athletes)) players.push(...group.athletes);
      else if (group?.fullName || group?.displayName || group?.name) players.push(group);
    });
    return players;
  }

  function eventState(event) {
    const status = event?.competitions?.[0]?.status?.type || event?.status?.type || {};
    if (status.completed === true) return 'post';
    return status.state || '';
  }

  function gameDate(event) {
    const value = Date.parse(event?.date || event?.competitions?.[0]?.date || '');
    return Number.isFinite(value) ? value : NaN;
  }

  function formatDate(value) {
    if (!Number.isFinite(value)) return 'Date unavailable';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }

  function gameSummary(event, providerTeamId) {
    if (!event) return { main: 'Unavailable', sub: '' };
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const mine = competitors.find(c => String(c.team?.id) === String(providerTeamId)) || competitors.find(c => c.team?.abbreviation?.toLowerCase() === event.__teamKey);
    const other = competitors.find(c => c !== mine) || competitors[0];
    const mineName = mine?.team?.shortDisplayName || mine?.team?.displayName || mine?.team?.abbreviation || 'Team';
    const otherName = other?.team?.shortDisplayName || other?.team?.displayName || other?.team?.abbreviation || 'Opponent';
    const mineScore = mine?.score?.displayValue ?? mine?.score?.value ?? mine?.score;
    const otherScore = other?.score?.displayValue ?? other?.score?.value ?? other?.score;
    const completed = eventState(event) === 'post';
    let main;
    if (completed && mineScore != null && otherScore != null) main = `${mineName} ${mineScore} · ${otherName} ${otherScore}`;
    else main = `${mine?.homeAway === 'away' ? '@ ' : 'vs '}${otherName}`;
    const detail = competition.status?.type?.shortDetail || event.status?.type?.shortDetail || '';
    return { main, sub: [formatDate(gameDate(event)), detail].filter(Boolean).join(' · ') };
  }

  function deriveGames(schedulePayload, providerTeamId, teamKey) {
    const events = Array.isArray(schedulePayload?.events) ? schedulePayload.events.map(e => Object.assign(e, { __teamKey: teamKey })) : [];
    const now = Date.now();
    const completed = events.filter(e => eventState(e) === 'post').sort((a,b) => gameDate(b) - gameDate(a));
    const upcoming = events.filter(e => eventState(e) === 'pre' && gameDate(e) >= now - 6 * 60 * 60 * 1000).sort((a,b) => gameDate(a) - gameDate(b));
    const live = events.find(e => eventState(e) === 'in') || null;
    return {
      live: gameSummary(live, providerTeamId),
      last: gameSummary(completed[0] || null, providerTeamId),
      next: gameSummary(upcoming[0] || null, providerTeamId),
      hasLive: Boolean(live)
    };
  }

  function panel(label, value, sub = '', wide = false, error = false) {
    const box = document.createElement('section');
    box.className = `data-panel${wide ? ' wide' : ''}`;
    const l = document.createElement('div');
    l.className = 'data-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = `data-value${error ? ' data-error' : ''}`;
    v.textContent = value;
    box.append(l, v);
    if (sub) {
      const d = document.createElement('div');
      d.className = 'data-sub';
      d.textContent = sub;
      box.appendChild(d);
    }
    return box;
  }

  function renderData(team, result) {
    const { teamPayload, schedulePayload, rosterPayload, errors } = result;
    const teamObj = teamPayload?.team || null;
    const providerTeamId = teamObj?.id || team.provider.team;
    const games = schedulePayload ? deriveGames(schedulePayload, providerTeamId, team.provider.team) : null;
    const players = rosterPayload ? flattenRoster(rosterPayload) : [];
    const nodes = [];

    nodes.push(panel('Record', teamObj ? recordSummary(teamObj) : 'Unavailable', teamObj?.standingSummary || (errors.team || '')));
    if (games?.hasLive) nodes.push(panel('Live now', games.live.main, games.live.sub, true));
    nodes.push(panel('Last game', games ? games.last.main : 'Unavailable', games ? games.last.sub : (errors.schedule || '')));
    nodes.push(panel('Next game', games ? games.next.main : 'Unavailable', games ? games.next.sub : (errors.schedule || '')));

    const rosterBox = panel('Roster feed', rosterPayload ? `${players.length} players returned` : 'Unavailable', rosterPayload ? 'Current roster endpoint responded successfully.' : (errors.roster || ''), true, !rosterPayload);
    if (players.length) {
      const list = document.createElement('ul');
      list.className = 'roster-sample';
      players.slice(0, 6).forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.fullName || player.displayName || player.name || 'Unnamed player';
        list.appendChild(li);
      });
      rosterBox.appendChild(list);
    }
    nodes.push(rosterBox);
    dataGrid.replaceChildren(...nodes);

    const okCount = [teamPayload, schedulePayload, rosterPayload].filter(Boolean).length;
    dataStatusDot.className = `status-dot ${okCount === 3 ? 'ok' : okCount ? '' : 'bad'}`;
    dataStatusText.textContent = okCount === 3
      ? 'Team, schedule, and roster feeds are responding.'
      : okCount
        ? `${okCount} of 3 feeds responded. The proof view remains usable.`
        : 'The provider did not respond. Retry when connectivity returns.';
  }

  async function loadTeamData(team, force = false) {
    if (!force && dataCache.has(team.id)) return dataCache.get(team.id);
    const urls = {
      team: endpoint(team),
      schedule: endpoint(team, 'schedule'),
      roster: endpoint(team, 'roster')
    };
    const entries = await Promise.all(Object.entries(urls).map(async ([key, url]) => {
      try { return [key, await fetchJson(url), null]; }
      catch (error) { return [key, null, `${key} feed: ${error.message}`]; }
    }));
    const result = { teamPayload: null, schedulePayload: null, rosterPayload: null, errors: {} };
    entries.forEach(([key, payload, error]) => {
      if (key === 'team') result.teamPayload = payload;
      if (key === 'schedule') result.schedulePayload = payload;
      if (key === 'roster') result.rosterPayload = payload;
      if (error) result.errors[key] = error;
    });
    if (result.teamPayload || result.schedulePayload || result.rosterPayload) dataCache.set(team.id, result);
    return result;
  }

  async function openTeamData(team, force = false) {
    if (!team) return;
    currentTeam = team;
    dataTitle.textContent = team.name;
    dataGrid.replaceChildren(panel('Connecting', 'Loading live sports data…', 'This proof uses three keyless public JSON calls.', true));
    dataStatusDot.className = 'status-dot';
    dataStatusText.textContent = 'Connecting to live team, schedule, and roster feeds…';
    dataModal.hidden = false;
    document.body.classList.add('modal-open');
    closeData.focus();
    const result = await loadTeamData(team, force);
    if (currentTeam?.id !== team.id || dataModal.hidden) return;
    renderData(team, result);
  }

  function closeDataModal() {
    const id = currentTeam?.id;
    dataModal.hidden = true;
    currentTeam = null;
    document.body.classList.remove('modal-open');
    const card = id ? document.querySelector(`#team-grid [data-team-id="${id}"]`) : null;
    card?.focus();
  }


  closeData.addEventListener('click', closeDataModal);
  dataModal.addEventListener('click', event => { if (event.target === dataModal) closeDataModal(); });
  retryData.addEventListener('click', () => { if (currentTeam) openTeamData(currentTeam, true); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dataModal.hidden) {
      event.stopPropagation();
      closeDataModal();
    }
  });

  window.ScoreboardLive = Object.freeze({
    open: (team, force = false) => openTeamData(team, force),
    close: closeDataModal,
    isOpen: () => !dataModal.hidden
  });
})();
