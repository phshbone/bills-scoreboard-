(() => {
  'use strict';

  const teamPage = document.getElementById('data-modal');
  const dataGrid = document.getElementById('data-grid');
  const feed = window.ScoreboardLiveFeed;
  if (!teamPage || !dataGrid || !feed) return;

  const INTERVAL_MS = 30000;
  let syncing = false;

  function currentTeam() {
    const id = teamPage.dataset.teamId;
    return Array.isArray(window.SCOREBOARD_TEAMS)
      ? window.SCOREBOARD_TEAMS.find(team => team.id === id) || null
      : null;
  }

  function livePanel() {
    return [...dataGrid.querySelectorAll('.data-panel')].find(panel =>
      panel.querySelector('.data-label')?.textContent?.trim().toLowerCase() === 'live now'
    ) || null;
  }

  function liveEvent(payload, team) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    return events.find(event => feed.containsTeam(event, team) && feed.eventState(event) === 'in') || null;
  }

  function withFreshDetail(existing, detail) {
    const text = String(existing || '').trim();
    if (!text) return detail;
    const parts = text.split(' · ').filter(Boolean);
    if (parts.length > 1) parts[parts.length - 1] = detail;
    else parts.push(detail);
    return parts.join(' · ');
  }

  async function syncLivePanel() {
    if (syncing || teamPage.hidden) return;
    const panel = livePanel();
    const team = currentTeam();
    if (!panel || !team) return;

    syncing = true;
    try {
      const game = typeof feed.fetchCurrentGame === 'function'
        ? await feed.fetchCurrentGame(team)
        : feed.parseEvent(liveEvent(await feed.fetchScoreboard(team), team), team);
      if (!game || game.state !== 'in' || !game.detail) return;

      const sub = panel.querySelector('.data-sub');
      if (sub) {
        const nextText = withFreshDetail(sub.textContent, game.detail);
        if (sub.textContent !== nextText) sub.textContent = nextText;
      }
      panel.dataset.liveStateUpdatedAt = String(Date.now());
    } catch {
      // Keep the existing team-page snapshot if the direct live refresh fails.
    } finally {
      syncing = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (!teamPage.hidden && livePanel()) syncLivePanel();
  });
  observer.observe(dataGrid, { childList: true, subtree: true });

  window.setInterval(() => {
    if (!document.hidden) syncLivePanel();
  }, INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncLivePanel();
  });

  syncLivePanel();
})();
