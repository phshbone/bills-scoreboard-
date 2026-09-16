(() => {
  'use strict';

  if (!window.ScoreboardData) return;
  const base = window.ScoreboardData;
  const loadedAt = new Map();
  const MAX_AGE_MS = 2 * 60 * 1000;

  async function load(team, force = false) {
    const age = Date.now() - (loadedAt.get(team.id) || 0);
    const stale = age >= MAX_AGE_MS;
    const snapshot = await base.load(team, force || stale);
    loadedAt.set(team.id, Date.now());
    return snapshot;
  }

  window.ScoreboardData = Object.freeze({ ...base, load });
})();
