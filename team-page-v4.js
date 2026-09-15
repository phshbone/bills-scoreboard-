(() => {
  'use strict';

  const modal = document.getElementById('data-modal');
  const title = document.getElementById('data-title');
  const kicker = document.getElementById('team-page-kicker');
  const grid = document.getElementById('data-grid');
  const status = document.getElementById('data-status');
  const statusDot = document.getElementById('data-status-dot');
  const statusText = document.getElementById('data-status-text');
  const back = document.getElementById('close-data');
  const retry = document.getElementById('retry-data');
  const overview = document.getElementById('team-overview-view');
  const detail = document.getElementById('team-detail-view');
  const detailKicker = document.getElementById('detail-kicker');
  const detailTitle = document.getElementById('detail-title');
  const detailContent = document.getElementById('detail-content');

  let currentTeam = null;
  let snapshot = null;
  let view = 'overview';
  let boardScrollY = 0;

  function el(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  function panel(label, value, sub = '', opts = {}) {
    const box = document.createElement(opts.action ? 'button' : 'section');
    box.className = `data-panel${opts.wide ? ' wide' : ''}${opts.action ? ' action-panel' : ''}`;
    if (opts.action) {
      box.type = 'button';
      box.addEventListener('click', opts.action);
      if (opts.actionLabel) box.setAttribute('aria-label', opts.actionLabel);
    }
    const row = el('div', 'data-label-row');
    row.appendChild(el('div', 'data-label', label));
    if (opts.badge) row.appendChild(el('span', 'data-badge', opts.badge));
    box.appendChild(row);
    box.appendChild(el('div', `data-value${opts.error ? ' data-error' : ''}`, value));
    if (sub) box.appendChild(el('div', 'data-sub', sub));
    if (opts.action) box.appendChild(el('div', 'panel-link', 'Open ›'));
    return box;
  }

  function showOverview() {
    view = 'overview';
    overview.hidden = false;
    detail.hidden = true;
    kicker.textContent = currentTeam?.league || 'scoreboard';
    title.textContent = currentTeam?.name || 'Team';
    document.querySelector('.team-page-shell')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function openDetail(kind) {
    if (!snapshot || !currentTeam) return;
    view = kind;
    overview.hidden = true;
    detail.hidden = false;
    detailKicker.textContent = currentTeam.name;
    detailContent.replaceChildren();
    if (kind === 'standings') renderStandings();
    if (kind === 'schedule') renderSchedule();
    if (kind === 'roster') renderRoster();
    document.querySelector('.team-page-shell')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function renderStandings() {
    detailTitle.textContent = 'Standings';
    const group = snapshot.standingGroup;
    if (!group) {
      detailContent.appendChild(panel('Standings', 'Unavailable', snapshot.errors.standings || 'No standings were returned for this league.', { wide: true, error: true }));
      return;
    }
    const wrap = el('div', 'standings-wrap');
    wrap.appendChild(el('div', 'detail-group-title', group.name));
    const table = document.createElement('table');
    table.className = 'standings-table';
    const thead = document.createElement('thead');
    const head = document.createElement('tr');
    ['Team', 'Record', 'Pct', 'GB'].forEach(name => head.appendChild(el('th', '', name)));
    thead.appendChild(head);
    const tbody = document.createElement('tbody');
    const key = String(currentTeam.provider.team).toLowerCase();
    group.entries.map(window.ScoreboardData.standingRow).forEach(row => {
      const tr = document.createElement('tr');
      if (row.id.toLowerCase() === key || row.abbreviation.toLowerCase() === key) tr.className = 'current-team-row';
      [row.name, row.record, row.pct || '—', row.gb || '—'].forEach(value => tr.appendChild(el('td', '', value)));
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    wrap.appendChild(table);
    detailContent.appendChild(wrap);
  }

  function renderSchedule() {
    detailTitle.textContent = 'Schedule';
    const games = snapshot.games;
    if (!games) {
      detailContent.appendChild(panel('Schedule', 'Unavailable', snapshot.errors.schedule || 'The schedule feed did not respond.', { wide: true, error: true }));
      return;
    }
    const list = el('div', 'game-list');
    const items = [...games.completed.slice(0, 6).reverse(), ...(games.live ? [games.live] : []), ...games.upcoming.slice(0, 8)];
    if (!items.length) list.appendChild(el('div', 'detail-empty', 'No recent or upcoming games were returned.'));
    items.forEach(game => {
      const row = el('article', `game-row ${game.state || ''}`);
      const text = el('div', 'game-row-text');
      text.append(el('div', 'game-row-main', game.main), el('div', 'game-row-sub', game.sub));
      row.appendChild(text);
      if (game.state === 'in') row.appendChild(el('span', 'live-pill', 'LIVE'));
      list.appendChild(row);
    });
    detailContent.appendChild(list);
  }

  function renderRoster() {
    detailTitle.textContent = 'Roster';
    if (!snapshot.roster.length) {
      detailContent.appendChild(panel('Roster', 'Unavailable', snapshot.errors.roster || 'No current players were returned.', { wide: true, error: true }));
      return;
    }
    const list = el('div', 'roster-list');
    snapshot.roster.forEach(player => {
      const row = el('div', 'roster-row');
      const identity = el('div', 'roster-identity');
      identity.appendChild(el('div', 'roster-name', player.name));
      const meta = [player.position, player.jersey ? `#${player.jersey}` : ''].filter(Boolean).join(' · ');
      if (meta) identity.appendChild(el('div', 'roster-meta', meta));
      row.appendChild(identity);
      list.appendChild(row);
    });
    detailContent.appendChild(list);
  }

  function renderOverview() {
    const nodes = [];
    nodes.push(panel('Record', snapshot.record, snapshot.standingSummary || snapshot.errors.team || '', {
      action: snapshot.standingGroup ? () => openDetail('standings') : null,
      actionLabel: snapshot.standingGroup ? `Open ${currentTeam.league} standings` : '',
      error: snapshot.record === 'Unavailable'
    }));
    if (snapshot.games?.live) nodes.push(panel('Live now', snapshot.games.live.main, snapshot.games.live.sub, { wide: true, badge: 'LIVE' }));
    nodes.push(panel('Last game', snapshot.games?.last?.main || 'Unavailable', snapshot.games?.last?.sub || snapshot.errors.schedule || ''));
    nodes.push(panel('Next game', snapshot.games?.next?.main || 'Unavailable', snapshot.games?.next?.sub || snapshot.errors.schedule || ''));
    nodes.push(panel('Schedule', snapshot.games ? 'Recent + upcoming games' : 'Unavailable', snapshot.games ? 'Open the current schedule.' : snapshot.errors.schedule || '', {
      action: snapshot.games ? () => openDetail('schedule') : null,
      actionLabel: snapshot.games ? `Open ${currentTeam.name} schedule` : '',
      error: !snapshot.games
    }));
    const rosterBox = panel('Roster', snapshot.roster.length ? `${snapshot.roster.length} players` : 'Unavailable', snapshot.roster.length ? 'Open the current roster.' : snapshot.errors.roster || '', {
      action: snapshot.roster.length ? () => openDetail('roster') : null,
      actionLabel: snapshot.roster.length ? `Open ${currentTeam.name} roster` : '',
      error: !snapshot.roster.length
    });
    if (snapshot.roster.length) {
      rosterBox.insertBefore(el('div', 'roster-preview', snapshot.roster.slice(0, 4).map(player => player.name).join(' · ')), rosterBox.querySelector('.panel-link'));
    }
    nodes.push(rosterBox);
    grid.replaceChildren(...nodes);

    const raw = snapshot.raw;
    const ok = [raw.teamPayload, raw.schedulePayload, raw.rosterPayload, raw.standingsPayload].filter(Boolean).length;
    if (ok === 4) status.hidden = true;
    else {
      status.hidden = false;
      statusDot.className = `status-dot ${ok ? '' : 'bad'}`;
      statusText.textContent = ok ? `${ok} of 4 data feeds responded. Available sections remain usable.` : 'Sports data is temporarily unavailable. Retry when connectivity returns.';
    }
  }

  async function openTeam(team, force = false) {
    if (!team) return;
    currentTeam = team;
    view = 'overview';
    boardScrollY = window.scrollY;
    kicker.textContent = team.league;
    title.textContent = team.name;
    overview.hidden = false;
    detail.hidden = true;
    grid.replaceChildren(panel('Connecting', 'Loading team data…', 'Record, games, schedule, roster, and standings are being checked.', { wide: true }));
    status.hidden = false;
    statusDot.className = 'status-dot';
    statusText.textContent = 'Connecting to sports data…';
    modal.hidden = false;
    document.body.classList.add('modal-open');
    document.querySelector('.team-page-shell')?.scrollTo({ top: 0 });
    back.focus();
    const result = await window.ScoreboardData.load(team, force);
    if (modal.hidden || currentTeam?.id !== team.id) return;
    snapshot = result;
    renderOverview();
  }

  function close() {
    if (view !== 'overview') return showOverview();
    const id = currentTeam?.id;
    modal.hidden = true;
    currentTeam = null;
    snapshot = null;
    document.body.classList.remove('modal-open');
    window.scrollTo({ top: boardScrollY });
    if (id) document.querySelector(`#team-grid [data-team-id="${id}"]`)?.focus();
  }

  back.addEventListener('click', close);
  retry.addEventListener('click', () => { if (currentTeam) openTeam(currentTeam, true); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) {
      event.stopPropagation();
      close();
    }
  });

  window.ScoreboardLive = Object.freeze({ open: openTeam, close, isOpen: () => !modal.hidden, getCurrentView: () => view });
})();
