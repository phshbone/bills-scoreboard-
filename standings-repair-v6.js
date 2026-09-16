(() => {
  'use strict';

  if (!window.ScoreboardData) return;

  const base = window.ScoreboardData;
  const mlbCache = new Map();
  const MLB_STANDINGS = 'https://statsapi.mlb.com/api/v1/standings';

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

  function normalizeMlbStandings(payload) {
    const groups = [];
    const records = Array.isArray(payload?.records) ? payload.records : [];
    records.forEach(record => {
      const divisionName = record?.division?.name || record?.division?.nameShort || 'MLB Division';
      const leagueName = record?.league?.name || (/American/i.test(divisionName) ? 'American League' : /National/i.test(divisionName) ? 'National League' : 'MLB');
      const entries = (record?.teamRecords || []).map(item => {
        const team = item?.team || {};
        return {
          __normalized: true,
          id: String(team.id || ''),
          abbreviation: mlbAbbreviation(team),
          name: team.name || team.teamName || team.clubName || 'Team',
          record: `${item?.wins ?? '—'}-${item?.losses ?? '—'}`,
          pct: item?.winningPercentage || '',
          gb: item?.gamesBack == null ? '' : String(item.gamesBack),
          extras: {
            gb: item?.gamesBack == null ? '' : String(item.gamesBack),
            lastTen: splitRecord(item, ['lastTen', 'last10']),
            home: splitRecord(item, ['home']),
            away: splitRecord(item, ['away']),
            streak: item?.streak?.streakCode || '',
            diff: item?.runDifferential == null ? '' : String(item.runDifferential),
            gamesPlayed: item?.gamesPlayed == null ? '' : String(item.gamesPlayed)
          }
        };
      });
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

  async function loadMlbGroups(snapshot, force) {
    const season = seasonFrom(snapshot);
    const key = String(season);
    if (!force && mlbCache.has(key)) return mlbCache.get(key);
    const url = `${MLB_STANDINGS}?leagueId=103,104&season=${encodeURIComponent(season)}&standingsTypes=regularSeason&hydrate=team,division,league`;
    const groups = normalizeMlbStandings(await fetchJson(url));
    if (groups.length) mlbCache.set(key, groups);
    return groups;
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
      const selected = teamGroup(groups, team);
      if (!groups.length || !selected) return snapshot;
      return {
        ...snapshot,
        standingGroups: groups,
        standingGroup: selected,
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
