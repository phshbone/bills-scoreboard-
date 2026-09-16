(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports';
  const teamPage = document.getElementById('data-modal');
  const dataGrid = document.getElementById('data-grid');
  const overview = document.getElementById('team-overview-view');
  if (!teamPage || !dataGrid || !overview) return;

  const teamCache = new Map();
  const playerCache = new Map();
  let probeToken = 0;
  let activeDataset = null;

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

  function rosterUrl(team) {
    const p = team.provider;
    return `${SITE}/${p.sport}/${p.league}/teams/${encodeURIComponent(p.team)}/roster`;
  }

  function statsUrl(team, playerId) {
    const p = team.provider;
    const season = new Date().getFullYear();
    return `${WEB}/${p.sport}/${p.league}/athletes/${encodeURIComponent(playerId)}/stats?season=${season}`;
  }

  function normalizeRoster(payload) {
    const source = payload?.athletes || payload?.items || [];
    const out = [];
    source.forEach(group => {
      const groupName = group?.position || group?.name || group?.displayName || '';
      const items = Array.isArray(group?.items) ? group.items : Array.isArray(group?.athletes) ? group.athletes : null;
      const add = player => {
        const id = String(player?.id || '');
        if (!id) return;
        out.push({
          id,
          name: player?.fullName || player?.displayName || player?.name || 'Unnamed player',
          position: player?.position?.abbreviation || player?.position?.displayName || player?.position?.name || groupName || '',
          jersey: player?.jersey || player?.uniform || ''
        });
      };
      if (items) items.forEach(add);
      else if (group?.id) add(group);
    });
    return out;
  }

  function statLabel(item, fallback = '') {
    return item?.abbreviation || item?.shortDisplayName || item?.displayName || item?.name || fallback;
  }

  function statValue(item) {
    if (item == null) return '';
    if (typeof item !== 'object') return String(item);
    const value = item.displayValue ?? item.value ?? item.statValue ?? item.amount;
    return value == null ? '' : String(value);
  }

  function parseStatCollection(raw) {
    const stats = new Map();
    if (!raw) return stats;
    if (Array.isArray(raw)) {
      raw.forEach((item, index) => {
        if (item == null) return;
        if (typeof item !== 'object') {
          stats.set(`Stat ${index + 1}`, String(item));
          return;
        }
        const label = statLabel(item, `Stat ${index + 1}`);
        const value = statValue(item);
        if (label && value !== '') stats.set(label, value);
      });
      return stats;
    }
    if (typeof raw === 'object') {
      Object.entries(raw).forEach(([key, value]) => {
        const v = statValue(value);
        if (v !== '') stats.set(key, v);
      });
    }
    return stats;
  }

  function parseCategories(payload) {
    const source = payload?.categories || payload?.statCategories || [];
    if (!Array.isArray(source)) return [];
    return source.map((category, index) => {
      const label = category?.displayName || category?.name || `Category ${index + 1}`;
      const stats = parseStatCollection(category?.stats || category?.statistics || category?.values);
      return stats.size ? { key: String(category?.name || label).toLowerCase(), label, stats } : null;
    }).filter(Boolean);
  }

  async function fetchPlayer(team, player) {
    const key = `${team.provider.sport}/${team.provider.league}/${player.id}/${new Date().getFullYear()}`;
    if (playerCache.has(key)) return playerCache.get(key);
    const promise = fetchJson(statsUrl(team, player.id))
      .then(payload => ({ ...player, categories: parseCategories(payload) }))
      .catch(() => ({ ...player, categories: [] }));
    playerCache.set(key, promise);
    return promise;
  }

  async function loadRoster(team) {
    let record = teamCache.get(team.id);
    if (record?.roster) return record.roster;
    const payload = await fetchJson(rosterUrl(team));
    const roster = normalizeRoster(payload);
    record = record || {};
    record.roster = roster;
    teamCache.set(team.id, record);
    return roster;
  }

  async function probe(team) {
    const roster = await loadRoster(team);
    if (!roster.length) return false;
    const sample = roster.slice(0, Math.min(4, roster.length));
    const results = await Promise.all(sample.map(player => fetchPlayer(team, player)));
    return results.some(player => player.categories.length);
  }

  async function mapWithConcurrency(items, limit, worker, progress) {
    const results = new Array(items.length);
    let cursor = 0;
    let completed = 0;
    const run = async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
        completed += 1;
        progress?.(completed, items.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
  }

  async function loadDataset(team, progress) {
    const cached = teamCache.get(team.id);
    if (cached?.dataset) return cached.dataset;
    const roster = await loadRoster(team);
    const players = await mapWithConcurrency(roster, 6, player => fetchPlayer(team, player), progress);
    const usable = players.filter(player => player.categories.length);
    if (!usable.length) throw new Error('No player season statistics were returned.');

    const categoryMap = new Map();
    usable.forEach(player => {
      player.categories.forEach(category => {
        const key = category.key || category.label.toLowerCase();
        if (!categoryMap.has(key)) categoryMap.set(key, { key, label: category.label, rows: [] });
        categoryMap.get(key).rows.push({ player, stats: category.stats });
      });
    });

    const categories = [...categoryMap.values()].filter(category => category.rows.length);
    if (!categories.length) throw new Error('No usable stat categories were returned.');
    const dataset = { players: usable, categories };
    const record = teamCache.get(team.id) || {};
    record.dataset = dataset;
    teamCache.set(team.id, record);
    return dataset;
  }

  function ensureOverlay() {
    let overlay = document.getElementById('full-stats-overlay');
    if (overlay) return overlay;
    overlay = el('div', 'full-stats-overlay');
    overlay.id = 'full-stats-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'full-stats-title');

    const shell = el('section', 'full-stats-shell');
    const header = el('div', 'full-stats-header');
    const kicker = el('div', 'full-stats-kicker', 'full stats');
    const title = el('h3', 'full-stats-title', 'Player stats');
    title.id = 'full-stats-title';
    header.append(kicker, title);
    const tabs = el('div', 'full-stats-tabs');
    tabs.id = 'full-stats-tabs';
    tabs.setAttribute('role', 'tablist');
    const body = el('div', 'full-stats-body');
    body.id = 'full-stats-body';
    const bottom = el('div', 'full-stats-bottom');
    const close = el('button', 'button', '← Back to Team');
    close.type = 'button';
    close.id = 'full-stats-close';
    bottom.appendChild(close);
    shell.append(header, tabs, body, bottom);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);
    close.addEventListener('click', closeOverlay);
    return overlay;
  }

  function columnsFor(category) {
    const columns = [];
    const seen = new Set();
    category.rows.forEach(row => {
      row.stats.forEach((_value, label) => {
        if (seen.has(label)) return;
        seen.add(label);
        columns.push(label);
      });
    });
    return columns.slice(0, 18);
  }

  function highlightColumn(table, index) {
    table.querySelectorAll('.active-stat-column').forEach(node => node.classList.remove('active-stat-column'));
    if (index <= 0) return;
    table.querySelectorAll('tr').forEach(row => row.children[index]?.classList.add('active-stat-column'));
  }

  function renderCategory(category) {
    const body = ensureOverlay().querySelector('#full-stats-body');
    const columns = columnsFor(category);
    if (!columns.length) {
      body.replaceChildren(el('div', 'full-stats-error', 'This category did not return usable columns.'));
      return;
    }

    const intro = el('p', 'full-stats-intro', 'Swipe the table horizontally. The player column and header stay fixed; tap a stat header to emphasize that column.');
    const wrap = el('div', 'full-stats-table-wrap');
    const table = document.createElement('table');
    table.className = 'full-stats-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const playerHead = el('th', '', 'Player');
    playerHead.addEventListener('click', () => highlightColumn(table, 0));
    headRow.appendChild(playerHead);
    columns.forEach((label, index) => {
      const th = el('th', '', label);
      th.addEventListener('click', () => highlightColumn(table, index + 1));
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    category.rows.forEach(({ player, stats }) => {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      name.appendChild(document.createTextNode(player.name));
      if (player.position) name.appendChild(el('span', 'full-stats-player-pos', player.position));
      tr.appendChild(name);
      columns.forEach(label => tr.appendChild(el('td', '', stats.get(label) ?? '—')));
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    wrap.appendChild(table);
    body.replaceChildren(intro, wrap);
  }

  function renderDataset(team, dataset) {
    const overlay = ensureOverlay();
    overlay.querySelector('.full-stats-title').textContent = team.name;
    const tabs = overlay.querySelector('#full-stats-tabs');
    tabs.replaceChildren();
    dataset.categories.forEach((category, index) => {
      const button = el('button', 'full-stats-tab', category.label);
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(index === 0));
      button.addEventListener('click', () => {
        tabs.querySelectorAll('.full-stats-tab').forEach(tab => tab.setAttribute('aria-selected', 'false'));
        button.setAttribute('aria-selected', 'true');
        renderCategory(category);
      });
      tabs.appendChild(button);
    });
    renderCategory(dataset.categories[0]);
  }

  async function openOverlay() {
    const team = currentTeam();
    if (!team) return;
    const overlay = ensureOverlay();
    overlay.hidden = false;
    overlay.querySelector('.full-stats-title').textContent = team.name;
    overlay.querySelector('#full-stats-tabs').replaceChildren();
    const body = overlay.querySelector('#full-stats-body');
    const loading = el('div', 'full-stats-loading', 'Loading player season statistics…');
    body.replaceChildren(loading);
    try {
      activeDataset = await loadDataset(team, (done, total) => { loading.textContent = `Loading player season statistics… ${done}/${total}`; });
      if (currentTeam()?.id !== team.id) return;
      renderDataset(team, activeDataset);
    } catch (error) {
      body.replaceChildren(el('div', 'full-stats-error', `Full stats are temporarily unavailable. ${error.message}`));
    }
    overlay.querySelector('#full-stats-close')?.focus();
  }

  function closeOverlay() {
    const overlay = document.getElementById('full-stats-overlay');
    if (overlay) overlay.hidden = true;
    activeDataset = null;
    dataGrid.querySelector('.full-stats-panel')?.focus();
  }

  function buildPanel(team) {
    const box = el('button', 'data-panel action-panel full-stats-panel');
    box.type = 'button';
    box.setAttribute('aria-label', `Open full player stats for ${team.name}`);
    const row = el('div', 'data-label-row');
    row.appendChild(el('div', 'data-label', 'Full stats'));
    box.append(row, el('div', 'data-value', 'Player tables'), el('div', 'data-sub', 'Season statistics by category'), el('div', 'panel-link', 'Open ›'));
    box.addEventListener('click', openOverlay);
    return box;
  }

  async function maybeAddPanel() {
    if (teamPage.hidden || overview.hidden || dataGrid.querySelector('.full-stats-panel')) return;
    const labels = [...dataGrid.querySelectorAll('.data-label')].map(node => node.textContent.trim().toLowerCase());
    if (!labels.includes('roster') || labels.includes('connecting')) return;
    const team = currentTeam();
    if (!team) return;
    const token = ++probeToken;
    try {
      const usable = await probe(team);
      if (!usable || token !== probeToken || teamPage.hidden || overview.hidden || currentTeam()?.id !== team.id || dataGrid.querySelector('.full-stats-panel')) return;
      dataGrid.appendChild(buildPanel(team));
    } catch {
      // No Full Stats control is shown unless a usable athlete-stats response is confirmed.
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(maybeAddPanel));
  observer.observe(dataGrid, { childList: true, subtree: true });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('full-stats-overlay')?.hidden) {
      event.stopPropagation();
      closeOverlay();
    }
  });

  window.ScoreboardFullStats = Object.freeze({ parseCategories, normalizeRoster });
})();
