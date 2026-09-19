(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
  const MLB_ROSTER = 'https://statsapi.mlb.com/api/v1/teams';
  const PLAYER_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports';
  const MLB_TEAM_IDS = Object.freeze({ nyy: 147, nym: 121, phi: 143 });
  const teamCache = new Map();
  const standingsCache = new Map();
  const playerCardCache = new Map();
  const playerDetailCache = new Map();

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
    const headshot = playerObj?.headshot?.href
      || playerObj?.headshot?.url
      || (Array.isArray(playerObj?.headshots) ? playerObj.headshots[0]?.href : '')
      || '';
    return {
      name: playerObj?.fullName || playerObj?.displayName || playerObj?.shortName || playerObj?.name || 'Unnamed player',
      position: playerObj?.position?.abbreviation || playerObj?.position?.displayName || playerObj?.position?.name || (typeof playerObj?.position === 'string' ? playerObj.position : '') || groupName || '',
      jersey: playerObj?.jersey || playerObj?.uniform || '',
      id: String(playerObj?.id || playerObj?.uid || playerObj?.guid || ''),
      headshot
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
      id: item?.person?.id ? `mlb-${item.person.id}` : '',
      headshot: ''
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

  function espnPlayerId(player) {
    const id = String(player?.id || '');
    return /^\d+$/.test(id) ? id : '';
  }

  function seasonForTeam(team, date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const league = String(team?.provider?.league || '').toLowerCase();

    // ESPN identifies NBA/NHL seasons by the year in which that season ends.
    if ((league === 'nba' || league === 'nhl') && month >= 7) return year + 1;
    return year;
  }

  function playerEndpoint(team, player, resource, options = {}) {
    const id = espnPlayerId(player);
    if (!id || !team?.provider?.sport || !team?.provider?.league) return '';
    const params = [];
    if (options.season) params.push(`season=${encodeURIComponent(options.season)}`);
    if (options.seasontype) params.push(`seasontype=${encodeURIComponent(options.seasontype)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return `${PLAYER_WEB}/${team.provider.sport}/${team.provider.league}/athletes/${id}/${resource}${query}`;
  }

  function statCategories(payload) {
    const candidates = [];
    if (Array.isArray(payload?.categories)) candidates.push(...payload.categories);
    if (Array.isArray(payload?.statistics?.categories)) candidates.push(...payload.statistics.categories);
    return candidates.filter(category => Array.isArray(category?.labels) && Array.isArray(category?.totals));
  }

  function categoryPairs(category) {
    const labels = category?.labels || [];
    const names = category?.names || [];
    const totals = category?.totals || [];
    return totals.map((value, index) => ({
      label: String(labels[index] || names[index] || '').trim(),
      name: String(names[index] || '').trim(),
      value: value == null || value === '' ? '—' : String(value)
    })).filter(item => item.label || item.name);
  }

  function statLookup(categories) {
    const map = new Map();
    categories.forEach(category => {
      categoryPairs(category).forEach(item => {
        [item.label, item.name].filter(Boolean).forEach(key => {
          const normalized = String(key).trim().toUpperCase().replace(/\s+/g, '');
          if (normalized && !map.has(normalized)) map.set(normalized, item.value);
        });
      });
    });
    return map;
  }

  function pickStat(map, aliases) {
    for (const alias of aliases) {
      const key = String(alias).trim().toUpperCase().replace(/\s+/g, '');
      if (map.has(key)) return map.get(key);
    }
    return '';
  }

  function isBaseballPitcher(player) {
    return /^(SP|RP|P|CP|CL)$/i.test(String(player?.position || '').trim());
  }

  function isHockeyGoalie(player) {
    return /^G$/i.test(String(player?.position || '').trim());
  }

  function footballRole(player) {
    const position = String(player?.position || '').toUpperCase();
    if (['QB'].includes(position)) return 'qb';
    if (['RB','HB','FB'].includes(position)) return 'rusher';
    if (['WR','TE'].includes(position)) return 'receiver';
    if (['K','PK'].includes(position)) return 'kicker';
    if (['P'].includes(position)) return 'punter';
    if (['LT','RT','OT','LG','RG','OG','G','C','OL'].includes(position)) return 'offensive-line';
    return 'defense';
  }

  function meaningfulCore(core) {
    return Array.isArray(core) && core.some(item => {
      const value = String(item?.value ?? '').trim();
      return value && value !== '—' && value !== '--';
    });
  }

  function coreStats(team, player, categories) {
    const map = statLookup(categories);
    const missing = value => value === '' || value == null ? '—' : String(value);

    if (team?.sport === 'baseball') {
      if (isBaseballPitcher(player)) {
        const wins = pickStat(map, ['W', 'WINS']);
        const losses = pickStat(map, ['L', 'LOSSES']);
        const record = wins && losses ? `${wins}-${losses}` : pickStat(map, ['W-L', 'W/L', 'RECORD']);
        const position = String(player?.position || '').toUpperCase();
        if (position === 'SP') {
          return [
            { label: 'W-L', value: missing(record) },
            { label: 'ERA', value: missing(pickStat(map, ['ERA'])) },
            { label: 'WHIP', value: missing(pickStat(map, ['WHIP'])) },
            { label: 'K', value: missing(pickStat(map, ['SO', 'K', 'STRIKEOUTS'])) }
          ];
        }
        const saves = pickStat(map, ['SV', 'SAVES']);
        return [
          { label: 'ERA', value: missing(pickStat(map, ['ERA'])) },
          { label: 'WHIP', value: missing(pickStat(map, ['WHIP'])) },
          { label: 'K', value: missing(pickStat(map, ['SO', 'K', 'STRIKEOUTS'])) },
          saves ? { label: 'SV', value: missing(saves) } : { label: 'W-L', value: missing(record) }
        ];
      }
      return [
        { label: 'AVG', value: missing(pickStat(map, ['AVG', 'BA', 'BATTINGAVERAGE'])) },
        { label: 'HR', value: missing(pickStat(map, ['HR', 'HOMERUNS'])) },
        { label: 'RBI', value: missing(pickStat(map, ['RBI'])) },
        { label: 'OPS', value: missing(pickStat(map, ['OPS'])) }
      ];
    }

    if (team?.sport === 'basketball') {
      const fieldGoalPct = pickStat(map, ['FG%', 'FGP', 'FIELDGOALPCT', 'FIELDGOALPERCENTAGE']);
      const gamesPlayed = pickStat(map, ['GP', 'GAMESPLAYED']);
      return [
        { label: 'PTS', value: missing(pickStat(map, ['PTS', 'POINTS', 'AVGPOINTS'])) },
        { label: 'REB', value: missing(pickStat(map, ['REB', 'REBOUNDS', 'AVGREBOUNDS'])) },
        { label: 'AST', value: missing(pickStat(map, ['AST', 'ASSISTS', 'AVGASSISTS'])) },
        fieldGoalPct
          ? { label: 'FG%', value: missing(fieldGoalPct) }
          : { label: 'GP', value: missing(gamesPlayed) }
      ];
    }

    if (team?.sport === 'hockey') {
      if (isHockeyGoalie(player)) {
        const wins = pickStat(map, ['W', 'WINS']);
        const losses = pickStat(map, ['L', 'LOSSES']);
        const otl = pickStat(map, ['OTL', 'OTLOSSES', 'OVERTIMELOSSES']);
        const record = wins && losses ? [wins, losses, otl].filter(value => value !== '').join('-') : '';
        return [
          { label: 'W-L-OTL', value: missing(record) },
          { label: 'GAA', value: missing(pickStat(map, ['GAA', 'GOALSAGAINSTAVERAGE'])) },
          { label: 'SV%', value: missing(pickStat(map, ['SV%', 'SAVEPERCENTAGE', 'SAVEPCT'])) },
          { label: 'SO', value: missing(pickStat(map, ['SO', 'SHUTOUTS'])) }
        ];
      }
      return [
        { label: 'G', value: missing(pickStat(map, ['G', 'GOALS'])) },
        { label: 'A', value: missing(pickStat(map, ['A', 'ASSISTS'])) },
        { label: 'PTS', value: missing(pickStat(map, ['PTS', 'POINTS'])) },
        { label: '+/-', value: missing(pickStat(map, ['+/-', 'PLUSMINUS'])) }
      ];
    }

    if (team?.sport === 'football') {
      const role = footballRole(player);
      if (role === 'qb') {
        return [
          { label: 'YDS', value: missing(pickStat(map, ['YDS', 'PASSYDS', 'PASSINGYARDS'])) },
          { label: 'TD', value: missing(pickStat(map, ['TD', 'PASSTD', 'PASSINGTOUCHDOWNS'])) },
          { label: 'INT', value: missing(pickStat(map, ['INT', 'INTERCEPTIONS'])) },
          { label: 'QBR', value: missing(pickStat(map, ['QBR', 'RTG', 'PASSERRATING'])) }
        ];
      }
      if (role === 'rusher') {
        return [
          { label: 'CAR', value: missing(pickStat(map, ['CAR', 'ATT', 'RUSHATT', 'RUSHINGATTEMPTS'])) },
          { label: 'YDS', value: missing(pickStat(map, ['RUSHYDS', 'RUSHINGYARDS', 'YDS'])) },
          { label: 'TD', value: missing(pickStat(map, ['RUSHTD', 'RUSHINGTOUCHDOWNS', 'TD'])) },
          { label: 'REC', value: missing(pickStat(map, ['REC', 'RECEPTIONS'])) }
        ];
      }
      if (role === 'receiver') {
        return [
          { label: 'REC', value: missing(pickStat(map, ['REC', 'RECEPTIONS'])) },
          { label: 'YDS', value: missing(pickStat(map, ['RECYDS', 'RECEIVINGYARDS', 'YDS'])) },
          { label: 'TD', value: missing(pickStat(map, ['RECTD', 'RECEIVINGTOUCHDOWNS', 'TD'])) },
          { label: 'TGT', value: missing(pickStat(map, ['TGT', 'TARGETS'])) }
        ];
      }
      if (role === 'kicker') {
        return [
          { label: 'FG%', value: missing(pickStat(map, ['FG%', 'FGPCT', 'FIELDGOALPERCENTAGE'])) },
          { label: 'FG', value: missing(pickStat(map, ['FG', 'FGM', 'FIELDGOALSMADE'])) },
          { label: 'XP', value: missing(pickStat(map, ['XP', 'XPM', 'EXTRAPOINTSMADE'])) },
          { label: 'PTS', value: missing(pickStat(map, ['PTS', 'POINTS'])) }
        ];
      }
      if (role === 'punter') {
        return [
          { label: 'PUNT', value: missing(pickStat(map, ['PUNT', 'PUNTS'])) },
          { label: 'AVG', value: missing(pickStat(map, ['AVG', 'PUNTAVG', 'PUNTAVERAGE'])) },
          { label: 'LNG', value: missing(pickStat(map, ['LNG', 'LONG'])) },
          { label: 'IN20', value: missing(pickStat(map, ['IN20', 'INSIDE20'])) }
        ];
      }
      if (role === 'offensive-line') {
        return [
          { label: 'GP', value: missing(pickStat(map, ['GP', 'GAMESPLAYED'])) },
          { label: 'GS', value: missing(pickStat(map, ['GS', 'GAMESSTARTED'])) },
          { label: 'SNAP', value: missing(pickStat(map, ['SNAP', 'SNAPS'])) },
          { label: 'PEN', value: missing(pickStat(map, ['PEN', 'PENALTIES'])) }
        ];
      }
      return [
        { label: 'TKL', value: missing(pickStat(map, ['TOT', 'TKL', 'TACKLES', 'TOTALTACKLES'])) },
        { label: 'SACK', value: missing(pickStat(map, ['SACK', 'SACKS'])) },
        { label: 'INT', value: missing(pickStat(map, ['INT', 'INTERCEPTIONS'])) },
        { label: 'FF', value: missing(pickStat(map, ['FF', 'FORCEDFUMBLES'])) }
      ];
    }

    return [];
  }

  function gamelogEvents(payload) {
    const rawEvents = Array.isArray(payload?.events)
      ? payload.events
      : (payload?.events && typeof payload.events === 'object' ? Object.values(payload.events) : []);
    const labels = Array.isArray(payload?.labels) ? payload.labels : [];
    const names = Array.isArray(payload?.names) ? payload.names : [];

    return rawEvents.map((event, sourceIndex) => {
      const values = Array.isArray(event?.stats) ? event.stats : [];
      const eventLabels = labels.length >= values.length ? labels.slice(labels.length - values.length) : labels;
      const eventNames = names.length >= values.length ? names.slice(names.length - values.length) : names;
      const stats = new Map();
      values.forEach((value, index) => {
        [eventLabels[index], eventNames[index]].filter(Boolean).forEach(key => {
          stats.set(String(key).trim().toUpperCase().replace(/\s+/g, ''), String(value ?? ''));
        });
      });
      const parsedDate = Date.parse(event?.date || '');
      return {
        id: String(event?.id || ''),
        date: Number.isFinite(parsedDate) ? parsedDate : NaN,
        sourceIndex,
        opponent: event?.opponent?.abbreviation || event?.opponent?.shortDisplayName || event?.opponent?.displayName || '',
        result: event?.gameResult || event?.result || '',
        stats
      };
    }).sort((a, b) => {
      if (Number.isFinite(a.date) && Number.isFinite(b.date)) return b.date - a.date;
      return a.sourceIndex - b.sourceIndex;
    });
  }

  function eventStat(event, aliases) {
    for (const alias of aliases) {
      const key = String(alias).trim().toUpperCase().replace(/\s+/g, '');
      if (event?.stats?.has(key)) return event.stats.get(key);
    }
    return '';
  }

  function numberValue(value) {
    const n = Number.parseFloat(String(value || '').replace('%', ''));
    return Number.isFinite(n) ? n : NaN;
  }

  function appearanceSummary(team, player, event) {
    if (!event) return null;
    const pieces = [];

    if (team?.sport === 'baseball') {
      if (isBaseballPitcher(player)) {
        const ip = eventStat(event, ['IP', 'INNINGSPITCHED']);
        const er = eventStat(event, ['ER', 'EARNEDRUNS']);
        const k = eventStat(event, ['SO', 'K', 'STRIKEOUTS']);
        if (ip) pieces.push(`${ip} IP`);
        if (er) pieces.push(`${er} ER`);
        if (k) pieces.push(`${k} K`);
        const label = /^SP$/i.test(String(player?.position || '').trim()) ? 'Last start' : 'Last appearance';
        return pieces.length ? { label, text: pieces.join(' · ') } : null;
      }
      const hits = eventStat(event, ['H', 'HITS']);
      const atBats = eventStat(event, ['AB', 'ATBATS']);
      const hr = eventStat(event, ['HR', 'HOMERUNS']);
      const rbi = eventStat(event, ['RBI']);
      if (hits && atBats) pieces.push(`${hits}-for-${atBats}`);
      const hrNum = numberValue(hr);
      if (Number.isFinite(hrNum) && hrNum > 0) pieces.push(hrNum === 1 ? 'HR' : `${hrNum} HR`);
      const rbiNum = numberValue(rbi);
      if (Number.isFinite(rbiNum) && rbiNum > 0) pieces.push(`${rbiNum} RBI`);
      return pieces.length ? { label: 'Last game', text: pieces.join(' · ') } : null;
    }

    if (team?.sport === 'basketball') {
      const pts = eventStat(event, ['PTS', 'POINTS']);
      const reb = eventStat(event, ['REB', 'REBOUNDS']);
      const ast = eventStat(event, ['AST', 'ASSISTS']);
      if (pts) pieces.push(`${pts} PTS`);
      if (reb) pieces.push(`${reb} REB`);
      if (ast) pieces.push(`${ast} AST`);
      return pieces.length ? { label: 'Last game', text: pieces.join(' · ') } : null;
    }

    if (team?.sport === 'hockey') {
      if (isHockeyGoalie(player)) {
        const sv = eventStat(event, ['SV', 'SAVES']);
        const ga = eventStat(event, ['GA', 'GOALSAGAINST']);
        const svp = eventStat(event, ['SV%', 'SAVEPERCENTAGE', 'SAVEPCT']);
        if (sv) pieces.push(`${sv} SV`);
        if (ga) pieces.push(`${ga} GA`);
        if (svp) pieces.push(`${svp} SV%`);
        return pieces.length ? { label: 'Last appearance', text: pieces.join(' · ') } : null;
      }
      const goals = eventStat(event, ['G', 'GOALS']);
      const assists = eventStat(event, ['A', 'ASSISTS']);
      const sog = eventStat(event, ['SOG', 'SHOTS', 'SHOTSONGOAL']);
      if (goals) pieces.push(`${goals} G`);
      if (assists) pieces.push(`${assists} A`);
      if (sog) pieces.push(`${sog} SOG`);
      return pieces.length ? { label: 'Last game', text: pieces.join(' · ') } : null;
    }

    if (team?.sport === 'football') {
      const role = footballRole(player);
      if (role === 'qb') {
        const cmp = eventStat(event, ['PASSINGCOMPLETIONS', 'CMP']);
        const att = eventStat(event, ['PASSINGATTEMPTS', 'ATT']);
        const yds = eventStat(event, ['PASSINGYARDS', 'PASSYDS']);
        const td = eventStat(event, ['PASSINGTOUCHDOWNS', 'PASSTD']);
        const interceptions = eventStat(event, ['INTERCEPTIONS', 'INT']);
        if (cmp && att) pieces.push(`${cmp}/${att}`);
        if (yds) pieces.push(`${yds} YDS`);
        if (td) pieces.push(`${td} TD`);
        if (interceptions) pieces.push(`${interceptions} INT`);
      } else if (role === 'rusher') {
        const yds = eventStat(event, ['RUSHINGYARDS', 'RUSHYDS']);
        const td = eventStat(event, ['RUSHINGTOUCHDOWNS', 'RUSHTD']);
        const rec = eventStat(event, ['RECEPTIONS', 'REC']);
        if (yds) pieces.push(`${yds} RUSH YDS`);
        if (td) pieces.push(`${td} TD`);
        if (rec) pieces.push(`${rec} REC`);
      } else if (role === 'receiver') {
        const rec = eventStat(event, ['RECEPTIONS', 'REC']);
        const yds = eventStat(event, ['RECEIVINGYARDS', 'RECYDS']);
        const td = eventStat(event, ['RECEIVINGTOUCHDOWNS', 'RECTD']);
        if (rec) pieces.push(`${rec} REC`);
        if (yds) pieces.push(`${yds} YDS`);
        if (td) pieces.push(`${td} TD`);
      } else if (role === 'kicker') {
        const fgm = eventStat(event, ['FIELDGOALSMADE', 'FGM']);
        const fga = eventStat(event, ['FIELDGOALATTEMPTS', 'FGA']);
        const xpm = eventStat(event, ['EXTRAPOINTSMADE', 'XPM']);
        if (fgm && fga) pieces.push(`${fgm}/${fga} FG`);
        if (xpm) pieces.push(`${xpm} XP`);
      } else if (role === 'punter') {
        const punts = eventStat(event, ['PUNTS', 'PUNT']);
        const avg = eventStat(event, ['PUNTAVERAGE', 'PUNTAVG', 'AVG']);
        if (punts) pieces.push(`${punts} PUNTS`);
        if (avg) pieces.push(`${avg} AVG`);
      } else {
        const tackles = eventStat(event, ['TOTALTACKLES', 'TACKLES', 'TOT', 'TKL']);
        const sacks = eventStat(event, ['SACKS', 'SACK']);
        const interceptions = eventStat(event, ['INTERCEPTIONS', 'INT']);
        if (tackles) pieces.push(`${tackles} TKL`);
        if (sacks) pieces.push(`${sacks} SACK`);
        if (interceptions) pieces.push(`${interceptions} INT`);
      }
      return pieces.length ? { label: 'Last game', text: pieces.join(' · ') } : null;
    }

    return null;
  }

  function trendSummary(team, player, events) {
    const recent = events.slice(0, 5);
    if (!recent.length) return '';

    if (team?.sport === 'basketball') {
      const lastFour = recent.slice(0, 4);
      const tripleDoubles = lastFour.filter(event => {
        const values = [
          numberValue(eventStat(event, ['PTS', 'POINTS'])),
          numberValue(eventStat(event, ['REB', 'REBOUNDS'])),
          numberValue(eventStat(event, ['AST', 'ASSISTS']))
        ];
        return values.filter(value => Number.isFinite(value) && value >= 10).length >= 3;
      }).length;
      if (tripleDoubles >= 2) return `${tripleDoubles} triple-doubles in last ${lastFour.length} games`;
      if (tripleDoubles === 1 && lastFour[0]) {
        const first = lastFour[0];
        const values = [
          numberValue(eventStat(first, ['PTS', 'POINTS'])),
          numberValue(eventStat(first, ['REB', 'REBOUNDS'])),
          numberValue(eventStat(first, ['AST', 'ASSISTS']))
        ];
        if (values.filter(value => Number.isFinite(value) && value >= 10).length >= 3) return 'Triple-double last game';
      }
      const doubleDoubles = lastFour.filter(event => {
        const values = [
          numberValue(eventStat(event, ['PTS', 'POINTS'])),
          numberValue(eventStat(event, ['REB', 'REBOUNDS'])),
          numberValue(eventStat(event, ['AST', 'ASSISTS']))
        ];
        return values.filter(value => Number.isFinite(value) && value >= 10).length >= 2;
      }).length;
      if (doubleDoubles >= 3) return `${doubleDoubles} double-doubles in last ${lastFour.length} games`;
    }

    if (team?.sport === 'baseball') {
      if (/^SP$/i.test(String(player?.position || '').trim())) {
        const lastThree = recent.slice(0, 3);
        if (lastThree.length === 3) {
          const qualityStarts = lastThree.filter(event => {
            const ip = numberValue(eventStat(event, ['IP', 'INNINGSPITCHED']));
            const er = numberValue(eventStat(event, ['ER', 'EARNEDRUNS']));
            return Number.isFinite(ip) && Number.isFinite(er) && ip >= 6 && er <= 3;
          }).length;
          if (qualityStarts >= 2) return `${qualityStarts} quality starts in last 3`;
        }
      } else {
        let hrStreak = 0;
        for (const event of recent) {
          const hr = numberValue(eventStat(event, ['HR', 'HOMERUNS']));
          if (!Number.isFinite(hr) || hr <= 0) break;
          hrStreak += 1;
        }
        if (hrStreak >= 2) return `HR in ${hrStreak} straight games`;

        let hitStreak = 0;
        for (const event of recent) {
          const hits = numberValue(eventStat(event, ['H', 'HITS']));
          if (!Number.isFinite(hits) || hits <= 0) break;
          hitStreak += 1;
        }
        if (hitStreak >= 5) return `${hitStreak}-game hitting streak`;
      }
    }

    if (team?.sport === 'hockey') {
      if (isHockeyGoalie(player)) {
        let strongAppearances = 0;
        for (const event of recent) {
          let svp = numberValue(eventStat(event, ['SV%', 'SAVEPERCENTAGE', 'SAVEPCT']));
          if (Number.isFinite(svp) && svp > 1) svp /= 100;
          if (!Number.isFinite(svp) || svp < .92) break;
          strongAppearances += 1;
        }
        if (strongAppearances >= 3) return `${strongAppearances} straight appearances at .920+ SV%`;
      } else {
        let pointStreak = 0;
        for (const event of recent) {
          const goals = numberValue(eventStat(event, ['G', 'GOALS']));
          const assists = numberValue(eventStat(event, ['A', 'ASSISTS']));
          if ((!Number.isFinite(goals) ? 0 : goals) + (!Number.isFinite(assists) ? 0 : assists) <= 0) break;
          pointStreak += 1;
        }
        if (pointStreak >= 3) return `${pointStreak}-game point streak`;
      }
    }

    if (team?.sport === 'football') {
      const role = footballRole(player);
      let streak = 0;
      for (const event of recent) {
        let value = NaN;
        if (role === 'qb') value = numberValue(eventStat(event, ['PASSINGTOUCHDOWNS', 'PASSTD']));
        else if (role === 'rusher') value = numberValue(eventStat(event, ['RUSHINGTOUCHDOWNS', 'RUSHTD']));
        else if (role === 'receiver') value = numberValue(eventStat(event, ['RECEIVINGTOUCHDOWNS', 'RECTD']));
        else if (role === 'defense') value = numberValue(eventStat(event, ['SACKS', 'SACK']));
        else break;
        if (!Number.isFinite(value) || value <= 0) break;
        streak += 1;
      }
      if (streak >= 2) {
        if (role === 'qb') return `Passing TD in ${streak} straight games`;
        if (role === 'rusher' || role === 'receiver') return `TD in ${streak} straight games`;
        if (role === 'defense') return `Sack in ${streak} straight games`;
      }
    }

    return '';
  }

  function overviewCategories(payload) {
    const statistics = payload?.statistics || {};
    const labels = Array.isArray(statistics.labels) ? statistics.labels : [];
    const names = Array.isArray(statistics.names) ? statistics.names : [];
    const totals = Array.isArray(statistics.displayValues)
      ? statistics.displayValues
      : (Array.isArray(statistics.totals) ? statistics.totals : []);
    if (labels.length && totals.length) {
      return [{
        name: 'overview',
        displayName: 'Season',
        labels,
        names,
        totals
      }];
    }
    return statCategories(payload);
  }

  async function loadPlayerCard(team, player, force = false) {
    const id = espnPlayerId(player);
    if (!id) {
      return {
        supported: false,
        core: [],
        coreContext: '',
        lastAppearance: null,
        trend: '',
        errors: { player: 'Detailed ESPN player data is unavailable for this roster-only entry.' }
      };
    }

    const key = `${team.provider.sport}/${team.provider.league}/${id}`;
    if (!force && playerCardCache.has(key)) return playerCardCache.get(key);

    const promise = (async () => {
      const season = seasonForTeam(team);
      let core = [];
      let coreContext = 'Current season';
      let events = [];
      let lastAppearance = null;
      const errors = {};

      try {
        const overview = await fetchJson(playerEndpoint(team, player, 'overview'));
        core = coreStats(team, player, overviewCategories(overview));
        events = gamelogEvents(overview?.gameLog || overview?.gamelog || {});
        lastAppearance = appearanceSummary(team, player, events[0]);
      } catch (error) {
        errors.overview = error.message;
      }

      // Basketball and hockey overview responses can carry the player shell but
      // omit the stat snapshot. Fall back to the season-scoped stats endpoint.
      if (!meaningfulCore(core)) {
        try {
          const seasonStats = await fetchJson(playerEndpoint(team, player, 'stats', { season, seasontype: 2 }));
          core = coreStats(team, player, statCategories(seasonStats));
        } catch (error) {
          errors.stats = error.message;
        }
      }

      // If the current season has not started yet, a labeled career fallback is
      // more useful than four dashes and is never presented as season data.
      if (!meaningfulCore(core)) {
        try {
          const allStats = await fetchJson(playerEndpoint(team, player, 'stats'));
          const allCategories = statCategories(allStats);
          core = coreStats(team, player, allCategories);
          if (meaningfulCore(core)) coreContext = 'Career';
        } catch (error) {
          errors.career = error.message;
        }
      }

      if (!lastAppearance) {
        try {
          const gamelog = await fetchJson(playerEndpoint(team, player, 'gamelog', { season }));
          events = gamelogEvents(gamelog);
          lastAppearance = appearanceSummary(team, player, events[0]);
        } catch (error) {
          errors.gamelog = error.message;
        }
      }

      return {
        supported: true,
        core,
        coreContext,
        lastAppearance,
        trend: trendSummary(team, player, events),
        errors
      };
    })();

    playerCardCache.set(key, promise);
    const data = await promise;
    playerCardCache.set(key, Promise.resolve(data));
    return data;
  }

  async function loadPlayerDetails(team, player, force = false) {
    const id = espnPlayerId(player);
    if (!id) {
      return {
        supported: false,
        categories: [],
        core: [],
        coreContext: '',
        events: [],
        lastAppearance: null,
        trend: '',
        glossary: {},
        errors: { player: 'Detailed ESPN player data is unavailable for this roster-only entry.' }
      };
    }

    const key = `${team.provider.sport}/${team.provider.league}/${id}`;
    if (!force && playerDetailCache.has(key)) return playerDetailCache.get(key);

    const promise = (async () => {
      const season = seasonForTeam(team);
      const requests = [
        ['stats', playerEndpoint(team, player, 'stats')],
        ['seasonStats', playerEndpoint(team, player, 'stats', { season, seasontype: 2 })],
        ['gamelog', playerEndpoint(team, player, 'gamelog', { season })]
      ];
      const results = await Promise.all(requests.map(async ([resource, url]) => {
        try { return [resource, await fetchJson(url), null]; }
        catch (error) { return [resource, null, error.message]; }
      }));
      const payloads = Object.fromEntries(results.map(([resource, payload]) => [resource, payload]));
      const errors = Object.fromEntries(results.filter(([, , error]) => error).map(([resource, , error]) => [resource, error]));

      const comprehensiveCategories = statCategories(payloads.stats);
      const seasonCategories = statCategories(payloads.seasonStats);
      const categories = comprehensiveCategories.length ? comprehensiveCategories : seasonCategories;
      let core = coreStats(team, player, seasonCategories);
      let coreContext = 'Current season';
      if (!meaningfulCore(core)) {
        core = coreStats(team, player, categories);
        if (meaningfulCore(core)) coreContext = 'Career';
      }

      const glossaryItems = [
        ...(Array.isArray(payloads.stats?.glossary) ? payloads.stats.glossary : []),
        ...(Array.isArray(payloads.seasonStats?.glossary) ? payloads.seasonStats.glossary : [])
      ];
      const glossary = {};
      glossaryItems.forEach(item => {
        const keyName = String(item?.abbreviation || item?.name || '').trim().toUpperCase();
        const displayName = item?.displayName || item?.description || '';
        if (keyName && displayName && !glossary[keyName]) glossary[keyName] = displayName;
      });

      const events = gamelogEvents(payloads.gamelog);
      return {
        supported: true,
        categories: categories.map(category => ({
          name: category?.displayName || category?.name || 'Statistics',
          stats: categoryPairs(category)
        })).filter(category => category.stats.length),
        core,
        coreContext,
        events,
        lastAppearance: appearanceSummary(team, player, events[0]),
        trend: trendSummary(team, player, events),
        glossary,
        errors
      };
    })();

    playerDetailCache.set(key, promise);
    try {
      const data = await promise;
      playerDetailCache.set(key, Promise.resolve(data));
      return data;
    } catch (error) {
      playerDetailCache.delete(key);
      throw error;
    }
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
      teamLogo: teamObj?.logos?.[0]?.href || teamObj?.logo || '',
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

  window.ScoreboardData = Object.freeze({ load, standingRow, loadPlayerCard, loadPlayerDetails });
})();
