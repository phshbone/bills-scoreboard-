(() => {
  'use strict';

  if (!window.ScoreboardData) return;

  const base = window.ScoreboardData;
  const mlbCache = new Map();
  const MLB_STANDINGS = 'https://statsapi.mlb.com/api/v1/standings';
  const AL_ABBREVIATIONS = new Set([
    'BAL','BOS','NYY','TB','TOR','CWS','CHW','CLE','DET','KC','MIN',
    'HOU','LAA','ATH','OAK','SEA','TEX'
  ]);

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function seasonFrom(snapshot) {
    const raw = snapshot?.raw?.teamPayload;
    return raw?.season?.year || raw?.team?.season?.year || new Date().getFullYear();
  }

  function mlbAbbreviation(teamObj) {
    const direct = teamObj?.abbreviation || teamObj?.teamCode || teamObj?.fileCode;
    if (direct) return String(direct).toUpperCase();
    const id = Number(teamObj?.id);
    const known = {
      108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL',
      116: 'DET', 117: 'HOU', 118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT',
      135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL', 139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN',
      143: 'PHI', 144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL'
    };
    return known[id] || '';
  }

  function splitRecord(item, names) {
    const wanted = new Set(names.map(name => String(name).toLowerCase().replace(/[^a-z0-9]/g, '')));
    const records = Array.isArray(item?.records?.splitRecords) ? item.records.splitRecords : [];
    const found = records.find(record => wanted.has(String(record?.type || record?.description || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
    if (!found || found.wins == null || found.losses == null) return '';
    return `${found.wins}-${found.losses}`;
  }

  function leagueNameFor(record, team) {
    const direct = record?.league?.name || team?.league?.name || '';
    if (direct) return direct;
    const divisionId = Number(record?.division?.id || team?.division?.id);
    if ([200,201,202].includes(divisionId)) return 'American League';
    if ([203,204,205].includes(divisionId)) return 'National League';
    return AL_ABBREVIATIONS.has(mlbAbbreviation(team)) ? 'American League' : 'National League';
  }

  function normalizedEntry(item, playoff = false) {
    const team = item?.team || {};
    const abbreviation = mlbAbbreviation(team);
    const wcRank = item?.wildCardRank == null ? '' : String(item.wildCardRank);
    const wcgb = item?.wildCardGamesBack == null ? '' : String(item.wildCardGamesBack);
    const divisionRank = item?.divisionRank == null ? '' : String(item.divisionRank);
    const clinchIndicator = String(item?.clinchIndicator || '').trim();
    const eliminated = /^(e|E)$/.test(clinchIndicator)
      || String(item?.eliminationNumber || '').toUpperCase() === 'E'
      || String(item?.wildCardEliminationNumber || '').toUpperCase() === 'E';

    let status = '';
    let label = '';
    if (item?.divisionChamp) {
      status = 'Clinched division';
      label = clinchIndicator ? `${clinchIndicator} · DIV` : 'DIV';
    } else if (item?.clinched) {
      status = 'Clinched playoff berth';
      label = clinchIndicator ? `${clinchIndicator} · IN` : 'IN';
    } else if (eliminated) {
      status = 'Eliminated';
      label = 'OUT';
    } else if (item?.divisionLeader || divisionRank === '1') {
      status = 'Division leader';
      label = 'DIV LEADER';
    } else if (wcRank) {
      const rank = Number.parseInt(wcRank, 10);
      status = Number.isFinite(rank) && rank <= 3 ? 'Wild Card spot' : 'Wild Card race';
      label = Number.isFinite(rank) ? `WC${rank}` : `WC ${wcRank}`;
    }

    const playoffInfo = playoff ? {
      label,
      status,
      clinched: Boolean(item?.clinched || item?.divisionChamp),
      eliminated,
      divisionLeader: Boolean(item?.divisionLeader || divisionRank === '1'),
      wildCardRank: wcRank,
      wildCardGamesBack: wcgb,
      cutAfter: wcRank === '3'
    } : null;

    return {
      __normalized: true,
      id: String(team.id || ''),
      abbreviation,
      name: team.name || team.teamName || team.clubName || 'Team',
      record: `${item?.wins ?? '—'}-${item?.losses ?? '—'}`,
      pct: item?.winningPercentage || item?.leagueRecord?.pct || '',
      gb: item?.gamesBack == null ? '' : String(item.gamesBack),
      playoff: playoffInfo,
      extras: {
        gb: item?.gamesBack == null ? '' : String(item.gamesBack),
        wcgb,
        wcRank,
        divisionRank,
        lastTen: splitRecord(item, ['lastTen', 'last10']),
        home: splitRecord(item, ['home']),
        away: splitRecord(item, ['away']),
        streak: item?.streak?.streakCode || '',
        diff: item?.runDifferential == null ? '' : String(item.runDifferential),
        gamesPlayed: item?.gamesPlayed == null ? '' : String(item.gamesPlayed),
        magicNumber: item?.magicNumber == null ? '' : String(item.magicNumber),
        eliminationNumber: item?.eliminationNumber == null ? '' : String(item.eliminationNumber),
        wildCardEliminationNumber: item?.wildCardEliminationNumber == null ? '' : String(item.wildCardEliminationNumber),
        clinchIndicator,
        playoffStatus: status
      }
    };
  }

  function normalizeMlbStandings(payload) {
    const groups = [];
    const records = Array.isArray(payload?.records) ? payload.records : [];
    records.forEach(record => {
      const divisionName = record?.division?.name || record?.division?.nameShort || 'MLB Division';
      const teamSample = record?.teamRecords?.[0]?.team || {};
      const leagueName = leagueNameFor(record, teamSample);
      const entries = (record?.teamRecords || []).map(item => normalizedEntry(item, false));
      if (entries.length) {
        groups.push({
          name: divisionName,
          parentName: leagueName,
          path: [leagueName, divisionName],
          entries,
          hasChildren: false,
          source: 'MLB StatsAPI'
        });
      }
    });
    return groups;
  }

  function normalizeMlbPlayoff(payload) {
    const byLeague = new Map();
    const records = Array.isArray(payload?.records) ? payload.records : [];

    records.forEach(record => {
      (record?.teamRecords || []).forEach(item => {
        const leagueName = leagueNameFor(record, item?.team || {});
        if (!byLeague.has(leagueName)) byLeague.set(leagueName, []);
        byLeague.get(leagueName).push(normalizedEntry(item, true));
      });
    });

    return [...byLeague.entries()].map(([leagueName, entries]) => {
      const deduped = [];
      const seen = new Set();
      entries.forEach(entry => {
        const key = entry.id || entry.abbreviation || entry.name;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(entry);
      });

      return {
        name: `${leagueName} Playoff Picture`,
        parentName: leagueName,
        path: [leagueName, 'Playoff Picture'],
        entries: deduped,
        hasChildren: false,
        source: 'MLB StatsAPI',
        playoff: true
      };
    }).filter(group => group.entries.length);
  }

  async function loadMlbGroups(snapshot, force) {
    const season = seasonFrom(snapshot);
    const key = String(season);
    if (!force && mlbCache.has(key)) return mlbCache.get(key);

    const regularUrl = `${MLB_STANDINGS}?leagueId=103,104&season=${encodeURIComponent(season)}&standingsTypes=regularSeason&hydrate=team,division,league`;
    const playoffUrl = `${MLB_STANDINGS}?leagueId=103,104&season=${encodeURIComponent(season)}&standingsTypes=wildCardWithLeaders&hydrate=team,division,league`;

    const [regularPayload, playoffPayload] = await Promise.all([
      fetchJson(regularUrl),
      fetchJson(playoffUrl).catch(() => null)
    ]);

    const result = {
      regular: normalizeMlbStandings(regularPayload),
      playoff: playoffPayload ? normalizeMlbPlayoff(playoffPayload) : []
    };
    if (result.regular.length) mlbCache.set(key, result);
    return result;
  }

  function teamGroup(groups, team) {
    const key = String(team?.provider?.team || '').toUpperCase();
    return groups.find(group => group.entries.some(entry => String(entry.abbreviation || '').toUpperCase() === key)) || null;
  }

  async function load(team, force = false) {
    const snapshot = await base.load(team, force);
    if (team?.league !== 'MLB') return snapshot;

    try {
      const groups = await loadMlbGroups(snapshot, force);
      const selected = teamGroup(groups.regular, team);
      if (!groups.regular.length || !selected) return snapshot;
      return {
        ...snapshot,
        standingGroups: groups.regular,
        standingGroup: selected,
        playoffGroups: groups.playoff,
        standingsSource: 'MLB StatsAPI'
      };
    } catch {
      return snapshot;
    }
  }

  function standingRow(entry) {
    if (entry?.__normalized) return entry;
    return base.standingRow(entry);
  }

  window.ScoreboardData = Object.freeze({ ...base, load, standingRow });
})();
