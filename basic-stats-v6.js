(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const teamPage = document.getElementById('data-modal');
  const dataGrid = document.getElementById('data-grid');
  const overview = document.getElementById('team-overview-view');
  if (!teamPage || !dataGrid || !overview) return;

  const cache = new Map();
  let requestToken = 0;

  const preferred = Object.freeze({
    football: ['passingyards','passing','rushingyards','rushing','receivingyards','receiving','tackles','sacks'],
    baseball: ['homeruns','rbis','rbi','battingaverage','avg','wins','era','strikeouts'],
    hockey: ['points','goals','assists','savepercentage','saves','goalsagainstaverage'],
    basketball: ['pointspergame','points','reboundspergame','rebounds','assistspergame','assists','steals','blocks']
  });

  function el(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  function currentTeam() {
    const id = teamPage.dataset.teamId;
    return Array.isArray(window.SCOREBOARD_TEAMS)
      ? window.SCOREBOARD_TEAMS.find(team => team.id === id) || null
      : null;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function leaderUrl(team, key = team.provider.team) {
    const p = team.provider;
    return `${SITE}/${p.sport}/${p.league}/teams/${encodeURIComponent(key)}/leaders`;
  }

  function teamUrl(team) {
    const p = team.provider;
    return `${SITE}/${p.sport}/${p.league}/teams/${encodeURIComponent(p.team)}`;
  }

  function compactKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function collectCategories(payload) {
    const out = [];
    const seenObjects = new Set();
    const walk = node => {
      if (!node || typeof node !== 'object' || seenObjects.has(node)) return;
      seenObjects.add(node);
      if (Array.isArray(node.leaders) && node.leaders.length && (node.name || node.displayName || node.shortDisplayName || node.abbreviation)) {
        out.push(node);
      }
      if (Array.isArray(node)) node.forEach(walk);
      else Object.values(node).forEach(walk);
    };
    walk(payload);
    return out;
  }

  function normalizeCategory(category) {
    const leader = Array.isArray(category?.leaders) ? category.leaders[0] : null;
    if (!leader) return null;
    const athlete = leader.athlete || leader.player || leader.person || {};
    const label = category.displayName || category.shortDisplayName || category.abbreviation || category.name || 'Stat';
    const value = leader.displayValue ?? leader.value ?? '';
    if (value === '') return null;
    return {
      key: compactKey(`${category.name || ''} ${category.displayName || ''} ${category.shortDisplayName || ''} ${category.abbreviation || ''}`),
      label,
      value: String(value),
      athlete: athlete.displayName || athlete.fullName || athlete.shortName || athlete.name || '',
      position: athlete.position?.abbreviation || athlete.position?.displayName || athlete.position || ''
    };
  }

  function chooseStats(payload, team) {
    const categories = collectCategories(payload).map(normalizeCategory).filter(Boolean);
    const unique = [];
    const seen = new Set();
    categories.forEach(item => {
      const identity = item.key || compactKey(item.label);
      if (!identity || seen.has(identity)) return;
      seen.add(identity);
      unique.push(item);
    });

    const order = preferred[team.sport] || [];
    const chosen = [];
    const used = new Set();
    order.forEach(pattern => {
      const index = unique.findIndex((item, i) => !used.has(i) && item.key.includes(pattern));
      if (index >= 0) {
        used.add(index);
        chosen.push(unique[index]);
      }
    });
    unique.forEach((item, index) => {
      if (chosen.length >= 6 || used.has(index)) return;
      used.add(index);
      chosen.push(item);
    });
    return chosen.slice(0, 6);
  }

  async function loadStats(team, force = false) {
    if (!force && cache.has(team.id)) return cache.get(team.id);
    let payload;
    try {
      payload = await fetchJson(leaderUrl(team));
    } catch {
      const teamPayload = await fetchJson(teamUrl(team));
      const numericId = teamPayload?.team?.id;
      if (!numericId) throw new Error('Team leaders unavailable');
      payload = await fetchJson(leaderUrl(team, numericId));
    }
    const stats = chooseStats(payload, team);
    if (stats.length) cache.set(team.id, stats);
    return stats;
  }

  function ensureOverlay() {
    let overlay = document.getElementById('basic-stats-overlay');
    if (overlay) return overlay;
    overlay = el('div', 'basic-stats-overlay');
    overlay.id = 'basic-stats-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'basic-stats-title');

    const shell = el('section', 'basic-stats-shell');
    const header = el('div', 'basic-stats-header');
    const heading = el('div');
    heading.append(el('div', 'basic-stats-kicker', 'basic stats'), el('h3', 'basic-stats-title', 'Team leaders'));
    heading.querySelector('h3').id = 'basic-stats-title';
    header.appendChild(heading);
    const body = el('div', 'basic-stats-body');
    body.id = 'basic-stats-body';
    const bottom = el('div', 'basic-stats-bottom');
    const close = el('button', 'button', '← Back to Team');
    close.type = 'button';
    close.id = 'basic-stats-close';
    bottom.appendChild(close);
    shell.append(header, body, bottom);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);
    close.addEventListener('click', closeOverlay);
    return overlay;
  }

  function renderStats(team, stats) {
    const overlay = ensureOverlay();
    overlay.querySelector('.basic-stats-title').textContent = team.name;
    const body = overlay.querySelector('#basic-stats-body');
    const intro = el('p', 'basic-stats-intro', 'A quick view of current team leaders. Full sortable player tables come in the later Full Stats build.');
    const grid = el('div', 'basic-stats-grid');
    stats.forEach(stat => {
      const card = el('article', 'basic-stat-card');
      card.append(el('div', 'basic-stat-label', stat.label), el('div', 'basic-stat-value', stat.value));
      if (stat.athlete) card.appendChild(el('div', 'basic-stat-player', [stat.athlete, stat.position].filter(Boolean).join(' · ')));
      grid.appendChild(card);
    });
    body.replaceChildren(intro, grid);
  }

  async function openOverlay() {
    const team = currentTeam();
    if (!team) return;
    const overlay = ensureOverlay();
    overlay.hidden = false;
    overlay.querySelector('#basic-stats-body').replaceChildren(el('div', 'basic-stats-loading', 'Loading current leaders…'));
    try {
      const stats = await loadStats(team);
      if (!stats.length) throw new Error('No team-leader categories were returned.');
      renderStats(team, stats);
    } catch (error) {
      overlay.querySelector('#basic-stats-body').replaceChildren(el('div', 'basic-stats-error', `Basic stats are temporarily unavailable. ${error.message}`));
    }
    overlay.querySelector('#basic-stats-close')?.focus();
  }

  function closeOverlay() {
    const overlay = document.getElementById('basic-stats-overlay');
    if (overlay) overlay.hidden = true;
    dataGrid.querySelector('.basic-stats-panel')?.focus();
  }

  function buildPanel(team, stats) {
    const box = el('button', 'data-panel action-panel basic-stats-panel');
    box.type = 'button';
    box.setAttribute('aria-label', `Open basic stats for ${team.name}`);
    const row = el('div', 'data-label-row');
    row.appendChild(el('div', 'data-label', 'Basic stats'));
    box.append(row, el('div', 'data-value', 'Team leaders'), el('div', 'data-sub', `${stats.length} key season categories`), el('div', 'panel-link', 'Open ›'));
    box.addEventListener('click', openOverlay);
    return box;
  }

  async function maybeAddPanel() {
    if (teamPage.hidden || overview.hidden || dataGrid.querySelector('.basic-stats-panel')) return;
    const labels = [...dataGrid.querySelectorAll('.data-label')].map(node => node.textContent.trim().toLowerCase());
    if (!labels.includes('record') || labels.includes('connecting')) return;
    const team = currentTeam();
    if (!team) return;
    const token = ++requestToken;
    try {
      const stats = await loadStats(team);
      if (token !== requestToken || teamPage.hidden || overview.hidden || currentTeam()?.id !== team.id || !stats.length || dataGrid.querySelector('.basic-stats-panel')) return;
      dataGrid.appendChild(buildPanel(team, stats));
    } catch {
      // Basic Stats stays hidden when the feed is not usable; no dead control is shown.
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(maybeAddPanel));
  observer.observe(dataGrid, { childList: true, subtree: true });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('basic-stats-overlay')?.hidden) {
      event.stopPropagation();
      closeOverlay();
    }
  });
})();
