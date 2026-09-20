(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
  const MLB_ROSTER = 'https://statsapi.mlb.com/api/v1/teams';
  const PLAYER_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports';
  const PLAYER_CORE = 'https://sports.core.api.espn.com/v2/sports';
  const MLB_TEAM_IDS = Object.freeze({ nyy: 147, nym: 121, phi: 143 });
  const teamCache = new Map();
  const standingsCache = new Map();
  const playoffStandingsCache = new Map();
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

  function playerExperienceYears(playerObj) {
    const experience = playerObj?.experience;
    const candidates = [
      experience?.years,
      experience?.year,
      experience?.value,
      experience?.displayValue,
      experience
    ];

    for (const candidate of candidates) {
      if (candidate == null || typeof candidate === 'object') continue;
      const text = String(candidate).trim();
      if (!text) continue;
      if (/rookie/i.test(text)) return 0;
      const match = text.match(/\d+/);
      if (!match) continue;
      const years = Number.parseInt(match[0], 10);
      if (Number.isFinite(years) && years >= 0 && years < 40) return years;
    }
    return null;
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
      headshot,
      experienceYears: playerExperienceYears(playerObj)
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
    const broadcast = Array.isArray(competition?.broadcasts)
      ? [...new Set(
          competition.broadcasts
            .flatMap(item => item?.names || [])
            .map(name => String(name || '').trim())
            .filter(Boolean)
        )]
      : [];
    return {
      venue: competition?.venue?.fullName || event?.venue?.fullName || '',
      attendance,
      capacity: null,
      weather: null,
      broadcast
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

  function standingStatKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function statItem(entry, names) {
    const stats = Array.isArray(entry?.stats) ? entry.stats : [];
    const wanted = new Set(names.map(standingStatKey));
    return stats.find(item =>
      wanted.has(standingStatKey(item?.name))
      || wanted.has(standingStatKey(item?.abbreviation))
      || wanted.has(standingStatKey(item?.displayName))
      || wanted.has(standingStatKey(item?.type))
    ) || null;
  }

  function stat(entry, names) {
    const found = statItem(entry, names);
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

  function standingPlayoff(entry) {
    const rawSeed = String(stat(entry, ['playoffseed', 'seed']) ?? '').trim();
    const seed = /^(?:0|-|—|none|null)$/i.test(rawSeed) ? '' : rawSeed;
    const clincher = statItem(entry, ['clincher', 'clinch']);
    const rawSymbol = String(clincher?.displayValue ?? clincher?.value ?? '').trim();
    const symbol = /^(?:0|-|—|none|null)$/i.test(rawSymbol) ? '' : rawSymbol;
    // Use the provider's actual description, not the generic displayName
    // "Clincher", which can exist even when a team has not clinched anything.
    const description = String(clincher?.description || '').trim();
    const eliminated = /^e$/i.test(symbol) || /eliminat/i.test(description);
    const clinched = !eliminated && (
      Boolean(symbol)
      || /clinch/i.test(description)
    );

    if (!seed && !symbol && !description) return null;

    let label = '';
    let status = description;
    if (eliminated) {
      label = 'OUT';
      if (!status) status = 'Eliminated';
    } else if (clinched) {
      label = symbol ? `${symbol} · IN` : 'IN';
      if (!status) status = 'Clinched playoff berth';
    } else if (!status && seed) {
      status = `Playoff seed ${seed}`;
    }

    return {
      label,
      status,
      seed,
      clinched,
      eliminated
    };
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
      record: summary || '—',
      pct: pct === '' ? '' : String(pct),
      gb: gb === '' ? '' : String(gb),
      playoff: standingPlayoff(entry)
    };
  }

  async function loadStandings(team, force) {
    const key = `${team.provider.sport}/${team.provider.league}`;
    if (!force && standingsCache.has(key)) return standingsCache.get(key);
    const payload = await fetchJson(endpoint(team, 'standings'));
    standingsCache.set(key, payload);
    return payload;
  }

  function supportsPlayoffStandings(team) {
    return ['nfl', 'nba', 'wnba', 'nhl'].includes(String(team?.provider?.league || '').toLowerCase());
  }

  function playoffStandingsUrl(team, level) {
    const base = endpoint(team, 'standings');
    return `${base}?type=0&level=${encodeURIComponent(level)}&sort=playoffseed%3Aasc`;
  }

  function broadPlayoffGroups(payload, preferConference = false) {
    const candidates = standingGroups(payload)
      .filter(group => Array.isArray(group?.entries) && group.entries.length);
    if (!candidates.length) return [];

    const conferenceLike = /conference|eastern|western|\bafc\b|\bnfc\b|american football|national football/i;
    const conferenceGroups = candidates.filter(group => {
      const label = `${group.name || ''} ${group.parentName || ''}`;
      return conferenceLike.test(label) && group.entries.length >= 4;
    });

    const maxEntries = Math.max(...candidates.map(group => group.entries.length));
    const broadBySize = candidates.filter(group => {
      const count = group.entries.length;
      return count === maxEntries;
    });

    // At conference scope prefer actual conference groups even if the response
    // also includes a larger league-wide parent table. Otherwise keep the
    // broadest table returned by the provider.
    const selected = preferConference && conferenceGroups.length
      ? conferenceGroups
      : broadBySize;

    const seen = new Set();
    return selected.filter(group => {
      const signature = group.entries
        .map(entry => String(entry?.team?.id || entry?.team?.abbreviation || ''))
        .filter(Boolean)
        .sort()
        .join('|');
      if (!signature || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    }).map(group => ({ ...group, playoff: true }));
  }

  async function loadPlayoffStandings(team, force) {
    if (!supportsPlayoffStandings(team)) return { payload: null, groups: [] };

    const key = `${team.provider.sport}/${team.provider.league}`;
    if (!force && playoffStandingsCache.has(key)) return playoffStandingsCache.get(key);

    const league = String(team?.provider?.league || '').toLowerCase();
    // WNBA playoff seeds are league-wide; NFL/NBA/NHL are better represented
    // by the provider's conference-level standings first.
    const levels = league === 'wnba' ? [1, 2] : [2, 1];

    let lastError = null;
    for (const level of levels) {
      try {
        const payload = await fetchJson(playoffStandingsUrl(team, level));
        const groups = broadPlayoffGroups(payload, level === 2 && league !== 'wnba');
        if (groups.length) {
          const result = { payload, groups, level };
          playoffStandingsCache.set(key, result);
          return result;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) throw lastError;
    return { payload: null, groups: [] };
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

  function playerCoreStatsEndpoint(team, player, season) {
    const id = espnPlayerId(player);
    if (!id || team?.sport !== 'football' || !team?.provider?.league || !season) return '';
    return `${PLAYER_CORE}/football/leagues/${team.provider.league}/seasons/${encodeURIComponent(season)}/types/2/athletes/${id}/statistics`;
  }

  function statCategories(payload) {
    const candidates = [];
    if (Array.isArray(payload?.categories)) candidates.push(...payload.categories);
    if (Array.isArray(payload?.statistics?.categories)) candidates.push(...payload.statistics.categories);
    if (Array.isArray(payload?.splits?.categories)) candidates.push(...payload.splits.categories);

    return candidates.map(category => {
      if (Array.isArray(category?.labels) && Array.isArray(category?.totals)) return category;
      if (!Array.isArray(category?.stats) || !category.stats.length) return null;

      return {
        ...category,
        labels: category.stats.map(item =>
          item?.abbreviation || item?.shortDisplayName || item?.displayName || item?.name || ''
        ),
        names: category.stats.map(item => item?.name || item?.displayName || item?.abbreviation || ''),
        totals: category.stats.map(item => {
          const value = item?.displayValue ?? item?.value;
          return value == null || value === '' ? '—' : String(value);
        })
      };
    }).filter(category =>
      category && Array.isArray(category.labels) && Array.isArray(category.totals)
    );
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

  function footballSeasonCategoryLooksCareer(category) {
    const name = String(category?.displayName || category?.name || '').toLowerCase();
    if (/career|postseason|playoff/.test(name)) return true;

    const values = new Map(categoryPairs(category).map(item => [
      String(item.label || item.name || '').trim().toUpperCase().replace(/\s+/g, ''),
      Number.parseFloat(String(item.value || '').replace(/,/g, ''))
    ]));
    const value = (...keys) => {
      for (const key of keys) {
        const n = values.get(key);
        if (Number.isFinite(n)) return n;
      }
      return NaN;
    };

    const gp = value('GP','GAMESPLAYED');
    if (Number.isFinite(gp) && gp > 25) return true;

    if (/pass/.test(name)) {
      const yds = value('YDS','PASSYDS','PASSINGYARDS');
      const td = value('TD','PASSTD','PASSINGTOUCHDOWNS');
      const cmp = value('CMP','COMPLETIONS');
      const att = value('ATT','PASSINGATTEMPTS');
      if ((Number.isFinite(yds) && yds > 8000)
        || (Number.isFinite(td) && td > 80)
        || (Number.isFinite(cmp) && cmp > 800)
        || (Number.isFinite(att) && att > 1200)) return true;
    }

    if (/rush/.test(name)) {
      const yds = value('YDS','RUSHYDS','RUSHINGYARDS');
      const td = value('TD','RUSHTD','RUSHINGTOUCHDOWNS');
      if ((Number.isFinite(yds) && yds > 3500)
        || (Number.isFinite(td) && td > 40)) return true;
    }

    if (/receiv/.test(name)) {
      const yds = value('YDS','RECYDS','RECEIVINGYARDS');
      const td = value('TD','RECTD','RECEIVINGTOUCHDOWNS');
      const rec = value('REC','RECEPTIONS');
      if ((Number.isFinite(yds) && yds > 3500)
        || (Number.isFinite(td) && td > 40)
        || (Number.isFinite(rec) && rec > 250)) return true;
    }

    return false;
  }

  function seasonSnapshotCategories(team, payload) {
    const categories = statCategories(payload);
    if (team?.sport !== 'football') return categories;
    return categories.filter(category => !footballSeasonCategoryLooksCareer(category));
  }

  function meaningfulCore(core) {
    return Array.isArray(core) && core.some(item => {
      const value = String(item?.value ?? '').trim();
      return value && value !== '—' && value !== '--';
    });
  }

  function scopedStatLookup(categories, pattern) {
    const scoped = (categories || []).filter(category => pattern.test(String(category?.displayName || category?.name || '')));
    return statLookup(scoped.length ? scoped : categories);
  }

  function usableStatValue(value) {
    const text = String(value ?? '').trim();
    return text !== '' && text !== '—' && text !== '--' && text !== '-';
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
        const passing = scopedStatLookup(categories, /pass/i);
        const qbr = pickStat(passing, ['QBR', 'TOTALQBR']);
        const rating = pickStat(passing, ['RTG', 'PASSERRATING', 'RATING']);
        const ratingStat = usableStatValue(qbr)
          ? { label: 'QBR', value: qbr }
          : { label: 'RTG', value: missing(rating) };
        return [
          { label: 'YDS', value: missing(pickStat(passing, ['PASSYDS', 'PASSINGYARDS', 'YDS'])) },
          { label: 'TD', value: missing(pickStat(passing, ['PASSTD', 'PASSINGTOUCHDOWNS', 'TD'])) },
          { label: 'INT', value: missing(pickStat(passing, ['INT', 'INTERCEPTIONS'])) },
          ratingStat
        ];
      }
      if (role === 'rusher') {
        const rushing = scopedStatLookup(categories, /rush/i);
        const receiving = scopedStatLookup(categories, /receiv/i);
        return [
          { label: 'CAR', value: missing(pickStat(rushing, ['CAR', 'RUSHATT', 'RUSHINGATTEMPTS', 'ATT'])) },
          { label: 'YDS', value: missing(pickStat(rushing, ['RUSHYDS', 'RUSHINGYARDS', 'YDS'])) },
          { label: 'TD', value: missing(pickStat(rushing, ['RUSHTD', 'RUSHINGTOUCHDOWNS', 'TD'])) },
          { label: 'REC', value: missing(pickStat(receiving, ['REC', 'RECEPTIONS'])) }
        ];
      }
      if (role === 'receiver') {
        const receiving = scopedStatLookup(categories, /receiv/i);
        return [
          { label: 'REC', value: missing(pickStat(receiving, ['REC', 'RECEPTIONS'])) },
          { label: 'YDS', value: missing(pickStat(receiving, ['RECYDS', 'RECEIVINGYARDS', 'YDS'])) },
          { label: 'TD', value: missing(pickStat(receiving, ['RECTD', 'RECEIVINGTOUCHDOWNS', 'TD'])) },
          { label: 'TGT', value: missing(pickStat(receiving, ['TGT', 'TARGETS'])) }
        ];
      }
      if (role === 'kicker') {
        const kicking = scopedStatLookup(categories, /kick|field goal/i);
        return [
          { label: 'FG%', value: missing(pickStat(kicking, ['FG%', 'FGPCT', 'FIELDGOALPERCENTAGE'])) },
          { label: 'FG', value: missing(pickStat(kicking, ['FG', 'FGM', 'FIELDGOALSMADE'])) },
          { label: 'XP', value: missing(pickStat(kicking, ['XP', 'XPM', 'EXTRAPOINTSMADE'])) },
          { label: 'PTS', value: missing(pickStat(kicking, ['PTS', 'POINTS'])) }
        ];
      }
      if (role === 'punter') {
        const punting = scopedStatLookup(categories, /punt/i);
        return [
          { label: 'PUNT', value: missing(pickStat(punting, ['PUNT', 'PUNTS'])) },
          { label: 'AVG', value: missing(pickStat(punting, ['AVG', 'PUNTAVG', 'PUNTAVERAGE'])) },
          { label: 'LNG', value: missing(pickStat(punting, ['LNG', 'LONG'])) },
          { label: 'IN20', value: missing(pickStat(punting, ['IN20', 'INSIDE20'])) }
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
      const defense = scopedStatLookup(categories, /defen|tack|sack|interception/i);
      return [
        { label: 'TKL', value: missing(pickStat(defense, ['TOT', 'TKL', 'TACKLES', 'TOTALTACKLES'])) },
        { label: 'SACK', value: missing(pickStat(defense, ['SACK', 'SACKS'])) },
        { label: 'INT', value: missing(pickStat(defense, ['INT', 'INTERCEPTIONS'])) },
        { label: 'FF', value: missing(pickStat(defense, ['FF', 'FORCEDFUMBLES'])) }
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

  function footballGameLogCore(player, events) {
    const recent = Array.isArray(events) ? events : [];
    if (!recent.length) return [];

    const sum = aliases => recent.reduce((total, event) => {
      const value = numberValue(eventStat(event, aliases));
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);

    const max = aliases => {
      const values = recent
        .map(event => numberValue(eventStat(event, aliases)))
        .filter(Number.isFinite);
      return values.length ? Math.max(...values) : NaN;
    };

    const any = aliases => recent.some(event => {
      const raw = eventStat(event, aliases);
      return raw !== '' && raw != null;
    });

    const format = value => Number.isFinite(value)
      ? String(Number.isInteger(value) ? value : Math.round(value * 10) / 10)
      : '—';

    const role = footballRole(player);

    if (role === 'qb') {
      const yds = sum(['PASSINGYARDS','PASSYDS','YDS']);
      const td = sum(['PASSINGTOUCHDOWNS','PASSTD','TD']);
      const interceptions = sum(['INTERCEPTIONS','INT']);
      const cmp = sum(['PASSINGCOMPLETIONS','CMP']);
      const att = sum(['PASSINGATTEMPTS','ATT']);
      const pct = att > 0 ? (cmp / att) * 100 : NaN;
      if (![yds, td, interceptions, cmp, att].some(value => value > 0) && !any(['INT','INTERCEPTIONS'])) return [];
      return [
        { label: 'YDS', value: format(yds) },
        { label: 'TD', value: format(td) },
        { label: 'INT', value: format(interceptions) },
        { label: 'CMP%', value: Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '—' }
      ];
    }

    if (role === 'rusher') {
      const car = sum(['RUSHINGATTEMPTS','RUSHATT','CAR','ATT']);
      const yds = sum(['RUSHINGYARDS','RUSHYDS','YDS']);
      const td = sum(['RUSHINGTOUCHDOWNS','RUSHTD','TD']);
      const rec = sum(['RECEPTIONS','REC']);
      if (![car, yds, td, rec].some(value => value > 0)) return [];
      return [
        { label: 'CAR', value: format(car) },
        { label: 'YDS', value: format(yds) },
        { label: 'TD', value: format(td) },
        { label: 'REC', value: format(rec) }
      ];
    }

    if (role === 'receiver') {
      const rec = sum(['RECEPTIONS','REC']);
      const yds = sum(['RECEIVINGYARDS','RECYDS','YDS']);
      const td = sum(['RECEIVINGTOUCHDOWNS','RECTD','TD']);
      const tgt = sum(['TARGETS','TGT']);
      if (![rec, yds, td, tgt].some(value => value > 0)) return [];
      return [
        { label: 'REC', value: format(rec) },
        { label: 'YDS', value: format(yds) },
        { label: 'TD', value: format(td) },
        { label: 'TGT', value: format(tgt) }
      ];
    }

    if (role === 'kicker') {
      const fgm = sum(['FIELDGOALSMADE','FGM','FG']);
      const fga = sum(['FIELDGOALATTEMPTS','FGA']);
      const xpm = sum(['EXTRAPOINTSMADE','XPM','XP']);
      const pct = fga > 0 ? (fgm / fga) * 100 : NaN;
      const points = fgm * 3 + xpm;
      if (![fgm, fga, xpm, points].some(value => value > 0)) return [];
      return [
        { label: 'FG%', value: Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '—' },
        { label: 'FG', value: format(fgm) },
        { label: 'XP', value: format(xpm) },
        { label: 'PTS', value: format(points) }
      ];
    }

    if (role === 'punter') {
      const punts = sum(['PUNTS','PUNT']);
      const yards = sum(['PUNTYARDS','PUNTINGYARDS']);
      const lng = max(['LONG','LNG']);
      const in20 = sum(['INSIDE20','IN20']);
      const avg = punts > 0 && yards > 0 ? yards / punts : NaN;
      if (![punts, yards, in20].some(value => value > 0) && !Number.isFinite(lng)) return [];
      return [
        { label: 'PUNT', value: format(punts) },
        { label: 'AVG', value: Number.isFinite(avg) ? avg.toFixed(1) : '—' },
        { label: 'LNG', value: format(lng) },
        { label: 'IN20', value: format(in20) }
      ];
    }

    if (role === 'offensive-line') {
      // ESPN frequently does not publish useful individual line stats. Count
      // only game-log rows that actually contain player stat values.
      const appearances = recent.filter(event => event?.stats instanceof Map && event.stats.size > 0).length;
      return appearances > 0 ? [{ label: 'GP', value: String(appearances) }] : [];
    }

    const tackles = sum(['TOTALTACKLES','TACKLES','TOT','TKL']);
    const sacks = sum(['SACKS','SACK']);
    const interceptions = sum(['INTERCEPTIONS','INT']);
    const ff = sum(['FORCEDFUMBLES','FF']);
    if (![tackles, sacks, interceptions, ff].some(value => value > 0)
      && !any(['INT','INTERCEPTIONS','SACK','SACKS','FF','FORCEDFUMBLES'])) return [];
    return [
      { label: 'TKL', value: format(tackles) },
      { label: 'SACK', value: format(sacks) },
      { label: 'INT', value: format(interceptions) },
      { label: 'FF', value: format(ff) }
    ];
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
        // Football athlete overviews can expose career totals even while the
        // app is asking for a current-season card. Use overview only for recent
        // game context; current-season football core stats must come from the
        // season-scoped stats request below.
        if (team?.sport !== 'football') {
          core = coreStats(team, player, overviewCategories(overview));
        }
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
          core = coreStats(team, player, seasonSnapshotCategories(team, seasonStats));
        } catch (error) {
          errors.stats = error.message;
        }
      }

      // NFL common/v3 athlete endpoints are inconsistent for some roster
      // entries. Before falling back to game-log aggregation, try ESPN's
      // season-scoped Core athlete statistics endpoint.
      if (team?.sport === 'football' && !meaningfulCore(core)) {
        try {
          const coreSeasonStats = await fetchJson(playerCoreStatsEndpoint(team, player, season));
          const coreCategories = seasonSnapshotCategories(team, coreSeasonStats);
          const resolved = coreStats(team, player, coreCategories);
          if (meaningfulCore(resolved)) {
            core = resolved;
            coreContext = 'Current season';
          }
        } catch (error) {
          errors.coreStats = error.message;
        }
      }

      // Never substitute career totals into a football season card. For other
      // sports retain the explicitly labeled career fallback used previously.
      if (!meaningfulCore(core) && team?.sport !== 'football') {
        try {
          const allStats = await fetchJson(playerEndpoint(team, player, 'stats'));
          const allCategories = statCategories(allStats);
          core = coreStats(team, player, allCategories);
          if (meaningfulCore(core)) coreContext = 'Career';
        } catch (error) {
          errors.career = error.message;
        }
      }

      if (!lastAppearance || (team?.sport === 'football' && !meaningfulCore(core))) {
        try {
          const gamelog = await fetchJson(playerEndpoint(team, player, 'gamelog', { season }));
          events = gamelogEvents(gamelog);
          if (!lastAppearance) lastAppearance = appearanceSummary(team, player, events[0]);
          if (team?.sport === 'football' && !meaningfulCore(core)) {
            core = footballGameLogCore(player, events);
            if (meaningfulCore(core)) coreContext = 'Current season · game log';
          }
        } catch (error) {
          errors.gamelog = error.message;
        }
      }

      return {
        supported: true,
        core,
        coreContext,
        coreUnavailable: team?.sport === 'football' && !meaningfulCore(core),
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
      if (team?.sport === 'football') {
        requests.push(['coreSeasonStats', playerCoreStatsEndpoint(team, player, season)]);
      }
      const results = await Promise.all(requests.map(async ([resource, url]) => {
        try { return [resource, await fetchJson(url), null]; }
        catch (error) { return [resource, null, error.message]; }
      }));
      const payloads = Object.fromEntries(results.map(([resource, payload]) => [resource, payload]));
      const errors = Object.fromEntries(results.filter(([, , error]) => error).map(([resource, , error]) => [resource, error]));

      const comprehensiveCategories = statCategories(payloads.stats);
      const webSeasonCategories = seasonSnapshotCategories(team, payloads.seasonStats);
      const coreSeasonCategories = seasonSnapshotCategories(team, payloads.coreSeasonStats);
      let seasonCategories = webSeasonCategories;
      let core = coreStats(team, player, seasonCategories);
      let coreContext = 'Current season';

      if (team?.sport === 'football' && !meaningfulCore(core) && coreSeasonCategories.length) {
        const resolved = coreStats(team, player, coreSeasonCategories);
        if (meaningfulCore(resolved)) {
          core = resolved;
          seasonCategories = coreSeasonCategories;
        }
      }

      const categories = comprehensiveCategories.length ? comprehensiveCategories : seasonCategories;
      if (!meaningfulCore(core) && team?.sport !== 'football') {
        core = coreStats(team, player, categories);
        if (meaningfulCore(core)) coreContext = 'Career';
      }

      const glossaryItems = [
        ...(Array.isArray(payloads.stats?.glossary) ? payloads.stats.glossary : []),
        ...(Array.isArray(payloads.seasonStats?.glossary) ? payloads.seasonStats.glossary : []),
        ...((payloads.coreSeasonStats?.splits?.categories || []).flatMap(category =>
          Array.isArray(category?.stats) ? category.stats : []
        ))
      ];
      const glossary = {};
      glossaryItems.forEach(item => {
        const keyName = String(item?.abbreviation || item?.name || '').trim().toUpperCase();
        const displayName = item?.displayName || item?.description || '';
        if (keyName && displayName && !glossary[keyName]) glossary[keyName] = displayName;
      });

      const events = gamelogEvents(payloads.gamelog);
      if (team?.sport === 'football' && !meaningfulCore(core)) {
        core = footballGameLogCore(player, events);
        if (meaningfulCore(core)) coreContext = 'Current season · game log';
      }
      const resolvedCoreUnavailable = team?.sport === 'football' && !meaningfulCore(core);

      return {
        supported: true,
        categories: categories.map(category => {
          const rawName = category?.displayName || category?.name || 'Statistics';
          const name = team?.sport === 'football'
            && comprehensiveCategories.includes(category)
            && !/career|postseason|playoff/i.test(rawName)
              ? `Career ${rawName}`
              : rawName;
          return { name, stats: categoryPairs(category) };
        }).filter(category => category.stats.length),
        core,
        coreContext,
        coreUnavailable: resolvedCoreUnavailable,
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

    let playoffStandingsPayload = null;
    let playoffGroups = [];
    let playoffStandingsLevel = null;
    try {
      const playoff = await loadPlayoffStandings(team, force);
      playoffStandingsPayload = playoff.payload;
      playoffGroups = playoff.groups;
      playoffStandingsLevel = playoff.level || null;
    } catch {
      // Playoff context is supplemental; ordinary standings remain fully usable.
    }

    const raw = {
      teamPayload: null,
      schedulePayload: null,
      rosterPayload: null,
      standingsPayload,
      playoffStandingsPayload,
      errors: {}
    };
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
      playoffGroups,
      playoffStandingsLevel,
      errors: raw.errors
    };
    if (normalized.record !== 'Unavailable' || normalized.games || normalized.roster.length || normalized.standingGroup) teamCache.set(team.id, normalized);
    return normalized;
  }

  window.ScoreboardData = Object.freeze({ load, standingRow, loadPlayerCard, loadPlayerDetails });
})();
