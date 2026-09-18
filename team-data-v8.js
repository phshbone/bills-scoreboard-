(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
  const MLB_ROSTER = 'https://statsapi.mlb.com/api/v1/teams';
  const MLB_TEAM_IDS = Object.freeze({ nyy: 147, nym: 121, phi: 143 });
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

  function player(playerObj, groupName = '') {
    return {
      name: playerObj?.fullName || playerObj?.displayName || playerObj?.shortName || playerObj?.name || 'Unnamed player',
      position: playerObj?.position?.abbreviation || playerObj?.position?.displayName || playerObj?.position?.name || (typeof playerObj?.position === 'string' ? playerObj.position : '') || groupName || '',
      jersey: playerObj?.jersey || playerObj?.uniform || '',
      id: String(playerObj?.id || playerObj?.uid || playerObj?.guid || '')
    };
  }

  function looksLikePlayer(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    const name = obj.fullName || obj.displayName || obj.shortName || obj.name;
    if (!name) return false;
    const id = obj.id || obj.uid || obj.guid;
    if (!id) return false;
    return Boolean(
      obj.fullName || obj.position || obj.jersey || obj.uniform || obj.headshot || obj.dateOfBirth ||
      obj.experience || obj.height || obj.weight || obj.birthPlace
    );
  }

  function roster(payload) {
    const players = [];
    const seen = new Set();
    let candidates = 0;
    const collectionKeys = ['items', 'athletes', 'players', 'roster', 'entries'];

    function add(raw, groupName = '') {
      if (!looksLikePlayer(raw)) return;
      candidates += 1;
      const normalized = player(raw, groupName);
      const key = normalized.id || `${normalized.name.toLowerCase()}|${normalized.jersey}`;
      if (seen.has(key)) return;
      seen.add(key);
      players.push(normalized);
    }

    function groupLabel(node, inherited = '') {
      if (!node || typeof node !== 'object') return inherited;
      if (typeof node.position === 'string') return node.position;
      if (node.position?.displayName || node.position?.name) return node.position.displayName || node.position.name;
      const hasChildren = collectionKeys.some(key => Array.isArray(node[key]));
      if (!hasChildren) return inherited;
      return node.displayName || node.name || inherited;
    }

    function process(node, inheritedGroup = '') {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(item => process(item, inheritedGroup));
        return;
      }
      if (typeof node !== 'object') return;

      if (looksLikePlayer(node)) {
        add(node, inheritedGroup);
        return;
      }
      if (looksLikePlayer(node.athlete)) add(node.athlete, inheritedGroup);
      if (looksLikePlayer(node.player)) add(node.player, inheritedGroup);

      const nextGroup = groupLabel(node, inheritedGroup);
      let traversed = false;
      collectionKeys.forEach(key => {
        if (!Array.isArray(node[key])) return;
        traversed = true;
        process(node[key], nextGroup);
      });

      if (!traversed) {
        Object.values(node).forEach(value => {
          if (!Array.isArray(value) || !value.length) return;
          const rosterish = value.some(item => {
            if (!item || typeof item !== 'object') return false;
            return looksLikePlayer(item) || looksLikePlayer(item.athlete) || looksLikePlayer(item.player) || collectionKeys.some(key => Array.isArray(item[key]));
          });
          if (rosterish) process(value, nextGroup);
        });
      }
    }

    const roots = [payload?.athletes, payload?.items, payload?.players, payload?.roster, payload?.entries].filter(Array.isArray);
    if (roots.length) roots.forEach(root => process(root));
    else process(payload);

    return {
      players,
      meta: {
        candidates,
        unique: players.length,
        duplicatesConsolidated: Math.max(0, candidates - players.length)
      }
    };
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
    const rawDetail = competition.status?.type?.shortDetail || event.status?.type?.shortDetail || '';
    const usefulDetail = eventState === 'pre' ? '' : rawDetail;
    return {
      id: event?.id || competition?.id || '',
      main,
      sub: [formatDate(dateValue(event)), usefulDetail].filter(Boolean).join(' · '),
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
    const visit = (node, ancestors = []) => {
      if (!node || typeof node !== 'object') return;
      const name = node.name || node.displayName || node.abbreviation || '';
      const path = name ? [...ancestors, name] : [...ancestors];
      const children = Array.isArray(node.children) ? node.children : [];
      if (Array.isArray(node?.standings?.entries) && node.standings.entries.length) {
        groups.push({
          name: name || 'Standings',
          parentName: ancestors[ancestors.length - 1] || '',
          path,
          entries: node.standings.entries,
          hasChildren: children.length > 0
        });
      }
      children.forEach(child => visit(child, path));
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

  function mlbTeamId(team) {
    if (team?.provider?.league !== 'mlb') return null;
    return MLB_TEAM_IDS[String(team?.provider?.team || '').toLowerCase()] || null;
  }

  function normalizeRosterName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function mlbRoster(payload) {
    const items = Array.isArray(payload?.roster) ? payload.roster : [];
    return items.map(item => ({
      name: item?.person?.fullName || item?.person?.name || 'Unnamed player',
      position: item?.position?.abbreviation || item?.position?.name || '',
      jersey: item?.jerseyNumber || '',
      id: item?.person?.id ? `mlb-${item.person.id}` : ''
    })).filter(item => item.name !== 'Unnamed player');
  }

  async function loadMlbRoster(team) {
    const id = mlbTeamId(team);
    if (!id) return [];
    const payload = await fetchJson(`${MLB_ROSTER}/${id}/roster?rosterType=active&hydrate=person`);
    return mlbRoster(payload);
  }

  function mergeRosters(primary, supplemental) {
    const merged = (Array.isArray(primary) ? primary : []).map(item => ({ ...item }));
    const byName = new Map();
    merged.forEach((item, index) => {
      const key = normalizeRosterName(item.name);
      if (key) byName.set(key, index);
    });

    (Array.isArray(supplemental) ? supplemental : []).forEach(item => {
      const key = normalizeRosterName(item.name);
      const index = key ? byName.get(key) : undefined;
      if (index === undefined) {
        merged.push({ ...item });
        if (key) byName.set(key, merged.length - 1);
        return;
      }

      const existing = merged[index];
      const currentPosition = String(existing.position || '').toUpperCase();
      const supplementalPosition = String(item.position || '').toUpperCase();
      const genericPosition = currentPosition === 'IF' || currentPosition === 'INF' || currentPosition === 'OF';
      if ((!currentPosition || genericPosition) && supplementalPosition) existing.position = item.position;
      if (!existing.jersey && item.jersey) existing.jersey = item.jersey;
    });

    return merged;
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
    const allStandingGroups = raw.standingsPayload ? standingGroups(raw.standingsPayload) : [];
    const rosterResult = raw.rosterPayload ? roster(raw.rosterPayload) : { players: [], meta: { candidates: 0, unique: 0, duplicatesConsolidated: 0 } };
    let supplementalRoster = [];
    if (team.provider?.league === 'mlb') {
      try { supplementalRoster = await loadMlbRoster(team); }
      catch { supplementalRoster = []; }
    }
    const mergedRoster = mergeRosters(rosterResult.players, supplementalRoster);
    const normalized = {
      raw,
      record: teamObj ? record(teamObj) : 'Unavailable',
      standingSummary: teamObj?.standingSummary || '',
      games: raw.schedulePayload ? games(raw.schedulePayload, providerTeamId, team.provider.team) : null,
      roster: mergedRoster,
      rosterMeta: {
        ...rosterResult.meta,
        supplemental: supplementalRoster.length,
        unique: mergedRoster.length
      },
      standingGroup: raw.standingsPayload ? standingGroup(raw.standingsPayload, team) : null,
      standingGroups: allStandingGroups,
      errors: raw.errors
    };
    if (normalized.record !== 'Unavailable' || normalized.games || normalized.roster.length || normalized.standingGroup) teamCache.set(team.id, normalized);
    return normalized;
  }

  window.ScoreboardData = Object.freeze({ load, standingRow });
})();
