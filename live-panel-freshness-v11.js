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

  function scoreText(game, team) {
    if (!game) return '';
    const mine = game.mineName || team?.name || 'Team';
    const other = game.otherName || 'Opponent';
    const mineScore = game.mineScore ?? '—';
    const otherScore = game.otherScore ?? '—';
    return `${mine} ${mineScore} · ${other} ${otherScore}`;
  }

  function createDirectLivePanel(game, team) {
    const panel = document.createElement('section');
    panel.className = 'data-panel wide';
    panel.dataset.liveDirect = 'true';

    const labelRow = document.createElement('div');
    labelRow.className = 'data-label-row';

    const label = document.createElement('div');
    label.className = 'data-label';
    label.textContent = 'Live now';

    const badge = document.createElement('span');
    badge.className = 'data-badge';
    badge.textContent = 'LIVE';

    const value = document.createElement('div');
    value.className = 'data-value';
    value.textContent = scoreText(game, team);

    const sub = document.createElement('div');
    sub.className = 'data-sub';
    sub.textContent = game?.detail || 'In progress';

    labelRow.append(label, badge);
    panel.append(labelRow, value, sub);

    const firstPanel = dataGrid.querySelector('.data-panel');
    if (firstPanel?.nextSibling) dataGrid.insertBefore(panel, firstPanel.nextSibling);
    else if (firstPanel) firstPanel.after(panel);
    else dataGrid.prepend(panel);

    return panel;
  }

  function ensureLivePanel(game, team) {
    return livePanel() || createDirectLivePanel(game, team);
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
    const team = currentTeam();
    if (!team) return;

    syncing = true;
    try {
      const game = typeof feed.fetchCurrentGame === 'function'
        ? await feed.fetchCurrentGame(team)
        : feed.parseEvent(liveEvent(await feed.fetchScoreboard(team), team), team);

      const existing = livePanel();
      if (!game || game.state !== 'in') {
        if (existing?.dataset.liveDirect === 'true') existing.remove();
        return;
      }

      const panel = ensureLivePanel(game, team);
      const value = panel.querySelector('.data-value');
      const sub = panel.querySelector('.data-sub');
      const nextValue = scoreText(game, team);
      if (value && nextValue && value.textContent !== nextValue) value.textContent = nextValue;

      if (sub) {
        const nextText = withFreshDetail(sub.textContent, game.detail || 'In progress');
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
    if (!teamPage.hidden) syncLivePanel();
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
