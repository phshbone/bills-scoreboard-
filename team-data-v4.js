(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
  const teamCache = new Map();
  const standingsCache = new Map();

  function endpoint(team, resource = '') {
    const p = team.provider;
    if (resource === 'standings') return `${STANDINGS}/${p.sport}/${p.league}/standings`;
    const root = `${SITE}/${p.sport}/${p.league}/teams/${p.team}`;
    return resource ? `${root}/${resource}` : root;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function record(teamObj) {
    if (!teamObj) return '—';
    if (teamObj.recordSummary) return teamObj.recordSummary;
    const items = teamObj.record?.items || [];
    const total = items.find(item => item.type === 'total' || item.name === 'overall') || items[0];
    return total?.summary || total?.displayValue || '—';
  }

  function player(player, groupName = '') {
    return {
      name: player?.fullName || player?.displayName || player?.name || 'Unnamed player',
      position: player?.position?.abbreviation || player?.position?.displayName || player?.position?.name || groupName || '',
      jersey: player?.jersey || player?.uniform || '',
      id: player?.id || ''
    };
  }

  function roster(payload) {
    const source = payload?.athletes || payload?.items || [];
    const players = [];
    source.forEach(group => {
      const groupName = group?.position || group?.name || group?.displayName || '';
      const items = Array.isArray(group?.items) ? group.items : Array.isArray(group?.athletes) ? group.athletes : null;
      if (items) items.forEach(item => players.push(player(item, groupName)));
      else if (group?.fullName || group?.displayName || group?.name) players.push(player(group));
    });
    return players;
  }

  function state(event) {
    const type = event?.competitions?.[0]?.status?.type || event?.status?.type || {};
    if (type.completed === true) return 'post';
    return type.state || '';
  }

  function dateValue(event) {
    const value = Date.parse(event?.date || event?.competitions?.[0]?.date || '');
    return Number.isFinite(value) ? value : NaN;
  }

  function formatDate(value) {
    if (!Number.isFinite(value)) return 'Date unavailable';
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    }).format(new Date(value));
  }

  function context(event) {
    const competition = event?.competitions?.[0] || {};
    const attendanceRaw = competition?.attendance ?? event?.attendance;
    const attendance = Number.isFinite(Number(attendanceRaw)) && Number(attendanceRaw) > 0 ? Number(attendanceRaw) : null;
    return {
      venue: competition?.venue?.fullName || event?.venue?.fullName || '',
      attendance,
      capacity: null,
      weather: null,
      broadcast: Array.isArray(competition?.broadcasts) ? competition.broadcasts.flatMap(item => item?.names || []).filter(Boolean) : []
    };
  }

  function game(event, providerTeamId, teamKey) {
    if (!event) return null;
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const mine = competitors.find(c => String(c.team?.id) === String(providerTeamId))
      || competitors.find(c => String(c.team?.abbreviation || '').toLowerCase() === String(teamKey).toLowerCase());
    const other = competitors.find(c => c !== mine) || competitors[0];
    const mineName = mine?.team?.shortDisplayName || mine?.team?.displayName || mine?.team?.abbreviation || 'Team';
    const otherName = other?.team?.shortDisplayName || other?.team?.displayName || other?.team?.abbreviation || 'Opponent';
    const mineScore = mine?.score?.displayValue ?? mine?.score?.value ?? mine?.score;
    const otherScore = other?.score?.displayValue ?? other?.score?.value ?? other?.score;
    const eventState = state(event);
    let main;
    if ((eventState === 'post' || eventState === 'in') && mineScore != null && otherScore != null) {
      main = `${mineName} ${mineScore} · ${otherName} ${otherScore}`;
    } else {
      main = `${mine?.homeAway === 'away' ? '@ ' : 'vs '}${otherName}`;
    }
    const detail = competition.status?.type?.shortDetail || event.status?.type?.shortDetail || '';
    return {
      id: event?.id || competition?.id || '',
      main,
      sub: [formatDate(dateValue(event)), detail].filter(Boolean).join(' · '),
      state: eventState,
      date: dateValue(event),
      context: context(event)
    };
  }

  function games(schedulePayload, providerTeamId, teamKey) {
    const events = Array.isArray(schedulePayload?.events) ? schedulePayload.events : [];
    const now = Date.now();
    const all = events.map(event => game(event, providerTeamId, teamKey)).filter(Boolean);
    const completed = all.filter(item => item.state === 'post').sort((a,b) => b.date - a.date);
    const upcoming = all.filter(item => item.state === 'pre' && item.date >= now - 6 * 60 * 60 * 1000).sort((a,b) => a.date - b.date);
    const live = all.find(item => item.state === 'in') || null;
    return { live, last: completed[0] || null, next: upcoming[0] || null, completed, upcoming };
  }

  function stat(entry, names) {
    const stats = Array.isArray(entry?.stats) ? entry.stats : [];
    const wanted = names.map(name => String(name).toLowerCase());
    const found = stats.find(item => wanted.includes(String(item?.name || '').toLowerCase()) || wanted.includes(String(item?.abbreviation || '').toLowerCase()));
    return found?.displayValue ?? found?.value ?? '';
  }

  function standingGroups(payload) {
    const groups = [];
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node?.standings?.entries) && node.standings.entries.length) {
        groups.push({ name: node.name || node.displayName || node.abbreviation || 'Standings', entries: node.standings.entries });
      }
      if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    visit(payload);
    return groups;
  }

  function standingGroup(payload, team) {
    const key = String(team.provider.team).toLowerCase();
    const groups = standingGroups(payload);
    return groups.find(group => group.entries.some(entry => {
      const id = String(entry?.team?.id || '').toLowerCase();
      const abbr = String(entry?.team?.abbreviation || '').toLowerCase();
      return id === key || abbr === key;
    })) || groups[0] || null;
  }

  function standingRow(entry) {
    const t = entry?.team || {};
    const wins = stat(entry, ['wins', 'w']);
    const losses = stat(entry, ['losses', 'l']);
    const ties = stat(entry, ['ties', 't']);
    const pct = stat(entry, ['winpercent', 'winpercentage', 'pct']);
    const gb = stat(entry, ['gamesbehind', 'gb']);
    const points = stat(entry, ['points', 'pts']);
    let summary = [wins, losses].filter(v => v !== '').join('-');
    if (ties !== '' && String(ties) !== '0') summary += `-${ties}`;
    if (!summary && points !== '') summary = `${points} pts`;
    return {
      id: String(t.id || ''), abbreviation: t.abbreviation || '',
      name: t.shortDisplayName || t.displayName || t.name || t.abbreviation || 'Team',
      record: summary || '—', pct: pct === '' ? '' : String(pct), gb: gb === '' ? '' : String(gb)
    };
  }

  async function loadStandings(team, force) {
    const key = `${team.provider.sport}/${team.provider.league}`;
    if (!force && standingsCache.has(key)) return standingsCache.get(key);
    const payload = await fetchJson(endpoint(team, 'standings'));
    standingsCache.set(key, payload);
    return payload;
  }

  async function load(team, force = false) {
    if (!force && teamCache.has(team.id)) return teamCache.get(team.id);
    const urls = { team: endpoint(team), schedule: endpoint(team, 'schedule'), roster: endpoint(team, 'roster') };
    const entries = await Promise.all(Object.entries(urls).map(async ([key, url]) => {
      try { return [key, await fetchJson(url), null]; }
      catch (error) { return [key, null, `${key} feed: ${error.message}`]; }
    }));
    let standingsPayload = null;
    let standingsError = null;
    try { standingsPayload = await loadStandings(team, force); }
    catch (error) { standingsError = `standings feed: ${error.message}`; }

    const raw = { teamPayload: null, schedulePayload: null, rosterPayload: null, standingsPayload, errors: {} };
    entries.forEach(([key, payload, error]) => {
      raw[`${key}Payload`] = payload;
      if (error) raw.errors[key] = error;
    });
    if (standingsError) raw.errors.standings = standingsError;

    const teamObj = raw.teamPayload?.team || null;
    const providerTeamId = teamObj?.id || team.provider.team;
    const normalized = {
      raw,
      record: teamObj ? record(teamObj) : 'Unavailable',
      standingSummary: teamObj?.standingSummary || '',
      games: raw.schedulePayload ? games(raw.schedulePayload, providerTeamId, team.provider.team) : null,
      roster: raw.rosterPayload ? roster(raw.rosterPayload) : [],
      standingGroup: raw.standingsPayload ? standingGroup(raw.standingsPayload, team) : null,
      errors: raw.errors
    };
    if (normalized.record !== 'Unavailable' || normalized.games || normalized.roster.length || normalized.standingGroup) teamCache.set(team.id, normalized);
    return normalized;
  }

  window.ScoreboardData = Object.freeze({ load, standingRow });
})();
