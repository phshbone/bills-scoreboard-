(() => {
  'use strict';
  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const page = document.getElementById('data-modal');
  const grid = document.getElementById('data-grid');
  const overview = document.getElementById('team-overview-view');
  if (!page || !grid || !overview) return;

  const cache = new Map();
  let token = 0;
  const el = (tag, cls = '', text = '') => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== '') n.textContent = text;
    return n;
  };
  const teamNow = () => (window.SCOREBOARD_TEAMS || []).find(t => t.id === page.dataset.teamId) || null;
  const json = async url => {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  const root = (team, id = team.provider.team) => `${SITE}/${team.provider.sport}/${team.provider.league}/teams/${encodeURIComponent(id)}`;

  async function payload(team) {
    let id = String(team.provider.team);
    try { id = String((await json(root(team)))?.team?.id || id); } catch {}
    const ids = [...new Set([String(team.provider.team), id])];
    let last;
    for (const candidate of ids) {
      for (const suffix of ['depthcharts', 'depth-charts']) {
        try { return await json(`${root(team, candidate)}/${suffix}`); }
        catch (error) { last = error; }
      }
    }
    throw last || new Error('Depth chart feed unavailable');
  }

  function parseDepthChart(data) {
    const groupsRaw = data?.depthCharts || data?.depthcharts || data?.groups || data?.items || [];
    const groups = [];
    for (const [gi, group] of (Array.isArray(groupsRaw) ? groupsRaw : [groupsRaw]).entries()) {
      if (!group || typeof group !== 'object') continue;
      const raw = group.positions || group.depth || group.items || [];
      const positions = Array.isArray(raw) ? raw : Object.values(raw || {});
      const out = [];
      for (const [pi, pos] of positions.entries()) {
        if (!pos || typeof pos !== 'object') continue;
        const info = pos.position || pos.slot || {};
        const key = info.abbreviation || pos.abbreviation || pos.key || pos.name || `Position ${pi + 1}`;
        const name = info.displayName || info.name || pos.displayName || pos.name || key;
        const athletes = (pos.athletes || pos.players || pos.entries || pos.items || []).map((item, i) => {
          const a = item?.athlete || item?.player || item || {};
          const playerName = a.fullName || a.displayName || a.shortName || a.name || '';
          if (!playerName) return null;
          const rankRaw = item?.rank ?? item?.order ?? item?.depth ?? i + 1;
          const rank = Number.isFinite(Number(rankRaw)) ? Number(rankRaw) : i + 1;
          return { rank, name: playerName, jersey: a.jersey || a.uniform || '' };
        }).filter(Boolean).sort((a, b) => a.rank - b.rank);
        if (athletes.length) out.push({ key: String(key), name: String(name), athletes });
      }
      if (out.length) groups.push({ name: group.displayName || group.name || group.title || `Depth Chart ${gi + 1}`, positions: out });
    }
    return groups;
  }

  async function load(team, force = false) {
    if (!force && cache.has(team.id)) return cache.get(team.id);
    const groups = parseDepthChart(await payload(team));
    if (!groups.length) throw new Error('No usable depth-chart positions were returned.');
    cache.set(team.id, groups);
    return groups;
  }

  const role = rank => rank === 1 ? 'Starter' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
  function overlay() {
    let o = document.getElementById('depth-chart-overlay');
    if (o) return o;
    o = el('div', 'depth-chart-overlay');
    o.id = 'depth-chart-overlay';
    o.hidden = true;
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    const shell = el('section', 'depth-chart-shell');
    const header = el('div', 'depth-chart-header');
    header.append(el('div', 'depth-chart-kicker', 'baseball depth chart'));
    const title = el('h3', 'depth-chart-title', 'Depth Chart');
    title.id = 'depth-chart-title';
    header.append(title);
    const body = el('div', 'depth-chart-body');
    body.id = 'depth-chart-body';
    const bottom = el('div', 'depth-chart-bottom');
    const close = el('button', 'button', '← Back to Team');
    close.type = 'button';
    close.id = 'depth-chart-close';
    close.onclick = closeOverlay;
    bottom.append(close);
    shell.append(header, body, bottom);
    o.append(shell);
    document.body.append(o);
    return o;
  }

  function render(team, groups) {
    const o = overlay();
    o.querySelector('#depth-chart-title').textContent = team.name;
    const body = o.querySelector('#depth-chart-body');
    const note = el('p', 'depth-chart-note', 'Roster shows primary listed positions. This view shows field-position depth and provider starter/backup order.');
    const wrap = el('div', 'depth-chart-groups');
    groups.forEach(group => {
      const section = el('section', 'depth-chart-group');
      section.append(el('h4', 'depth-chart-group-title', group.name));
      group.positions.forEach(pos => {
        const card = el('section', 'depth-position-card');
        const head = el('div', 'depth-position-heading');
        head.append(el('span', 'depth-position-name', `${pos.key} · ${pos.name}`));
        card.append(head);
        pos.athletes.forEach(a => {
          const row = el('div', 'depth-athlete-row');
          row.append(el('span', 'depth-role', role(a.rank)), el('span', 'depth-athlete-name', a.name), el('span', 'depth-jersey', a.jersey ? `#${a.jersey}` : ''));
          card.append(row);
        });
        section.append(card);
      });
      wrap.append(section);
    });
    body.replaceChildren(note, wrap);
  }

  async function openOverlay() {
    const team = teamNow();
    if (!team || team.league !== 'MLB') return;
    const o = overlay();
    o.hidden = false;
    o.querySelector('#depth-chart-title').textContent = team.name;
    o.querySelector('#depth-chart-body').replaceChildren(el('p', 'depth-chart-note', 'Loading depth chart…'));
    try { render(team, await load(team)); }
    catch (e) { o.querySelector('#depth-chart-body').replaceChildren(el('div', 'depth-chart-error', `Depth chart is temporarily unavailable. ${e.message}`)); }
    o.querySelector('#depth-chart-close')?.focus();
  }

  function closeOverlay() {
    const o = document.getElementById('depth-chart-overlay');
    if (o) o.hidden = true;
    grid.querySelector('.depth-chart-panel')?.focus();
  }

  function panel(team) {
    const b = el('button', 'data-panel action-panel depth-chart-panel');
    b.type = 'button';
    b.setAttribute('aria-label', `Open ${team.name} depth chart`);
    const row = el('div', 'data-label-row');
    row.append(el('div', 'data-label', 'Depth chart'));
    b.append(row, el('div', 'data-value', 'Positions + order'), el('div', 'data-sub', 'Starter and backup depth by field position.'), el('div', 'panel-link', 'Open ›'));
    b.onclick = openOverlay;
    return b;
  }

  async function maybeAdd() {
    if (page.hidden || overview.hidden || grid.querySelector('.depth-chart-panel')) return;
    const team = teamNow();
    if (!team || team.league !== 'MLB') return;
    const labels = [...grid.querySelectorAll('.data-label')].map(n => n.textContent.trim().toLowerCase());
    if (!labels.includes('roster') || labels.includes('connecting')) return;
    const t = ++token;
    try {
      const groups = await load(team);
      if (groups.length && t === token && !page.hidden && !overview.hidden && teamNow()?.id === team.id && !grid.querySelector('.depth-chart-panel')) grid.append(panel(team));
    } catch {}
  }

  new MutationObserver(() => queueMicrotask(maybeAdd)).observe(grid, { childList: true, subtree: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('depth-chart-overlay')?.hidden) {
      e.stopPropagation();
      closeOverlay();
    }
  });
  window.ScoreboardMlbDepthChart = Object.freeze({ parseDepthChart, load });
})();
