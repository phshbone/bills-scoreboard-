(() => {
  'use strict';

  if (!window.ScoreboardData) return;

  const base = window.ScoreboardData;
  const cache = new Map();
  const NFL_STANDINGS = 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3';

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function groupsFrom(payload) {
    const groups = [];

    function visit(node, ancestors = []) {
      if (!node || typeof node !== 'object') return;
      const name = node.name || node.displayName || node.abbreviation || '';
      const path = name ? [...ancestors, name] : [...ancestors];
      const children = Array.isArray(node.children) ? node.children : [];
      const entries = Array.isArray(node?.standings?.entries) ? node.standings.entries : [];

      if (entries.length) {
        groups.push({
          name: name || 'Standings',
          parentName: ancestors[ancestors.length - 1] || '',
          path,
          entries,
          hasChildren: children.length > 0,
          source: 'ESPN division standings'
        });
      }

      children.forEach(child => visit(child, path));
    }

    visit(payload);
    return groups;
  }

  function groupContainsTeam(group, team) {
    const key = String(team?.provider?.team || '').toLowerCase();
    return group.entries.some(entry => {
      const id = String(entry?.team?.id || '').toLowerCase();
      const abbr = String(entry?.team?.abbreviation || '').toLowerCase();
      return id === key || abbr === key;
    });
  }

  async function fetchGroups(force) {
    if (!force && cache.has('nfl')) return cache.get('nfl');
    const groups = groupsFrom(await fetchJson(NFL_STANDINGS));
    const leaves = groups.filter(group => !group.hasChildren && group.entries.length);
    const usable = leaves.length >= 4 ? leaves : groups.filter(group => group.entries.length);
    if (usable.length) cache.set('nfl', usable);
    return usable;
  }

  async function load(team, force = false) {
    const snapshot = await base.load(team, force);
    if (team?.league !== 'NFL') return snapshot;

    try {
      const groups = await fetchGroups(force);
      const selected = groups.find(group => groupContainsTeam(group, team)) || null;
      if (!groups.length || !selected) return snapshot;
      return {
        ...snapshot,
        standingGroups: groups,
        standingGroup: selected,
        standingsSource: 'ESPN division standings'
      };
    } catch {
      return snapshot;
    }
  }

  window.ScoreboardData = Object.freeze({ ...base, load });
  window.ScoreboardNflStandingsRepair = Object.freeze({ groupsFrom });
})();
