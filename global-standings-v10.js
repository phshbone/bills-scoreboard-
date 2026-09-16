(() => {
  'use strict';

  const pageTitle = document.getElementById('page-title');
  const headerActions = document.querySelector('.app > header .header-actions');
  const myTeamsScreen = document.getElementById('my-teams-screen');
  const standingsScreen = document.getElementById('standings-screen');
  const standingsTabs = document.getElementById('standings-league-tabs');
  const standingsContent = document.getElementById('global-standings-content');
  const standingsStatus = document.getElementById('global-standings-status');
  const standingsRetry = document.getElementById('global-standings-retry');
  const teamGrid = document.getElementById('team-grid');
  if (!pageTitle || !headerActions || !myTeamsScreen || !standingsScreen || !standingsTabs || !standingsContent || !standingsStatus || !standingsRetry || !teamGrid) return;

  let currentScreen = 'teams';
  let currentLeague = '';
  let loadToken = 0;
  const scrollByScreen = { teams: 0, standings: 0 };
  let touchStart = null;

  const el = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  };

  function activeTeams() {
    return Array.isArray(window.SCOREBOARD_ACTIVE_TEAMS) ? [...window.SCOREBOARD_ACTIVE_TEAMS] : [];
  }

  function leagueGroups() {
    const groups = new Map();
    activeTeams().forEach(team => {
      if (!team?.league) return;
      if (!groups.has(team.league)) groups.set(team.league, []);
      groups.get(team.league).push(team);
    });
    return groups;
  }

  function preferredLeague(groups) {
    if (currentLeague && groups.has(currentLeague)) return currentLeague;
    return groups.keys().next().value || '';
  }

  function currentTeamKeys(teams) {
    const keys = new Set();
    teams.forEach(team => keys.add(String(team.provider?.team || '').toLowerCase()));
    return keys;
  }

  function rowMatches(row, teamKeys) {
    return teamKeys.has(String(row?.id || '').toLowerCase()) || teamKeys.has(String(row?.abbreviation || '').toLowerCase());
  }

  function groupLabel(group) {
    const name = group?.name || 'Standings';
    const parent = group?.parentName || '';
    if (/^(east|central|west|north|south)$/i.test(name) && parent && !new RegExp(name, 'i').test(parent)) return `${parent} ${name}`;
    return name;
  }

  function displayGroups(snapshot, league) {
    const all = Array.isArray(snapshot?.standingGroups) ? snapshot.standingGroups : [];
    if (!all.length) return snapshot?.standingGroup ? [snapshot.standingGroup] : [];
    if (league === 'NCAA') return snapshot?.standingGroup ? [snapshot.standingGroup] : all.slice(0, 1);
    const leaves = all.filter(group => !group.hasChildren && Array.isArray(group.entries) && group.entries.length);
    const compact = leaves.filter(group => group.entries.length <= 12);
    if (compact.length >= 2) return compact;
    if (leaves.length) return leaves;
    return all.filter(group => Array.isArray(group.entries) && group.entries.length);
  }

  function keyName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function entryStat(entry, names) {
    const wanted = new Set(names.map(keyName));
    const stats = Array.isArray(entry?.stats) ? entry.stats : [];
    const found = stats.find(item => wanted.has(keyName(item?.name)) || wanted.has(keyName(item?.abbreviation)) || wanted.has(keyName(item?.displayName)));
    const value = found?.displayValue ?? found?.value;
    return value == null ? '' : String(value);
  }

  function firstValue(...values) {
    return values.find(value => value != null && String(value).trim() !== '') ?? '';
  }

  function extraValue(row, entry, key, aliases = []) {
    return String(firstValue(row?.extras?.[key], entryStat(entry, aliases)) || '');
  }

  function leagueRecord(league, row, entry) {
    if (league === 'NHL') {
      const w = entryStat(entry, ['wins', 'w']);
      const l = entryStat(entry, ['losses', 'l']);
      const ot = entryStat(entry, ['overtimelosses', 'otl', 'otlosses']);
      if (w !== '' && l !== '') return `${w}-${l}${ot !== '' ? `-${ot}` : ''}`;
    }
    return row.record || '—';
  }

  function primaryMetric(league, row, entry) {
    if (league === 'NHL') {
      const points = entryStat(entry, ['points', 'pts']);
      return { label: 'PTS', value: points || row.pct || '—' };
    }
    return { label: 'PCT', value: row.pct || '—' };
  }

  function secondaryParts(league, row, entry) {
    const parts = [];
    const add = (label, value) => {
      if (value == null || String(value).trim() === '' || String(value) === '—') return;
      parts.push(`${label} ${String(value)}`);
    };

    if (league === 'MLB') {
      add('GB', firstValue(row.gb, row?.extras?.gb));
      add('L10', extraValue(row, entry, 'lastTen', ['lasttengames', 'lastten', 'last10']));
      add('HOME', extraValue(row, entry, 'home', ['home', 'homerecord']));
      add('AWAY', extraValue(row, entry, 'away', ['road', 'away', 'roadrecord', 'awayrecord']));
      add('DIFF', extraValue(row, entry, 'diff', ['rundifferential', 'pointdifferential', 'diff']));
      add('STK', extraValue(row, entry, 'streak', ['streak']));
    } else if (league === 'NFL') {
      add('DIV', extraValue(row, entry, 'division', ['divisionrecord', 'vsdivision', 'division']));
      add('CONF', extraValue(row, entry, 'conference', ['conferencerecord', 'vsconference', 'conference']));
      add('PF', extraValue(row, entry, 'pointsFor', ['pointsfor', 'pf']));
      add('PA', extraValue(row, entry, 'pointsAgainst', ['pointsagainst', 'pa']));
      add('DIFF', extraValue(row, entry, 'diff', ['pointdifferential', 'differential', 'diff']));
      add('STK', extraValue(row, entry, 'streak', ['streak']));
    } else if (league === 'NHL') {
      add('GP', extraValue(row, entry, 'gamesPlayed', ['gamesplayed', 'gp']));
      add('DIFF', extraValue(row, entry, 'diff', ['pointdifferential', 'goaldifferential', 'diff']));
      add('HOME', extraValue(row, entry, 'home', ['home', 'homerecord']));
      add('AWAY', extraValue(row, entry, 'away', ['road', 'away', 'roadrecord', 'awayrecord']));
      add('STK', extraValue(row, entry, 'streak', ['streak']));
    } else if (league === 'WNBA') {
      add('GB', firstValue(row.gb, extraValue(row, entry, 'gb', ['gamesbehind', 'gb'])));
      add('HOME', extraValue(row, entry, 'home', ['home', 'homerecord']));
      add('AWAY', extraValue(row, entry, 'away', ['road', 'away', 'roadrecord', 'awayrecord']));
      add('L10', extraValue(row, entry, 'lastTen', ['lasttengames', 'lastten', 'last10']));
      add('STK', extraValue(row, entry, 'streak', ['streak']));
    } else if (league === 'NCAA') {
      add('CONF', extraValue(row, entry, 'conference', ['conferencerecord', 'conference']));
      add('HOME', extraValue(row, entry, 'home', ['home', 'homerecord']));
      add('AWAY', extraValue(row, entry, 'away', ['road', 'away', 'roadrecord', 'awayrecord']));
      add('STK', extraValue(row, entry, 'streak', ['streak']));
    }
    return parts;
  }

  function makeTable(group, teams, league) {
    const wrap = el('section', 'global-standings-group');
    wrap.appendChild(el('h3', 'global-standings-group-title', groupLabel(group)));
    const tableWrap = el('div', 'global-standings-table-wrap');
    const table = document.createElement('table');
    table.className = 'global-standings-table';
    const thead = document.createElement('thead');
    const head = document.createElement('tr');
    const metric = primaryMetric(league, {}, {});
    ['Team', 'Record', metric.label].forEach(label => head.appendChild(el('th', '', label)));
    thead.appendChild(head);
    const tbody = document.createElement('tbody');
    const keys = currentTeamKeys(teams);

    (group.entries || []).forEach(entry => {
      const row = window.ScoreboardData.standingRow(entry);
      const mine = rowMatches(row, keys);
      const tr = document.createElement('tr');
      if (mine) tr.className = 'my-team-standing';

      const nameCell = el('td', 'global-team-name');
      const nameLine = el('div', 'global-team-name-line');
      nameLine.appendChild(document.createTextNode(row.name || 'Team'));
      if (mine) nameLine.appendChild(el('span', 'my-team-mark', 'MY TEAM'));
      nameCell.appendChild(nameLine);

      const secondary = secondaryParts(league, row, entry);
      if (secondary.length) nameCell.appendChild(el('div', 'global-standing-secondary', secondary.join(' · ')));

      const liveMetric = primaryMetric(league, row, entry);
      tr.append(
        nameCell,
        el('td', 'global-standing-record', leagueRecord(league, row, entry)),
        el('td', 'global-standing-metric', liveMetric.value)
      );
      tbody.appendChild(tr);
    });

    table.append(thead, tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
    return wrap;
  }

  function setStatus(message, state = '') {
    standingsStatus.hidden = !message;
    standingsStatus.className = `global-standings-status${state ? ` ${state}` : ''}`;
    standingsStatus.textContent = message;
  }

  function renderTabs() {
    const groups = leagueGroups();
    currentLeague = preferredLeague(groups);
    const fragment = document.createDocumentFragment();
    groups.forEach((teams, league) => {
      const button = el('button', 'standings-league-tab', league);
      button.type = 'button';
      button.dataset.league = league;
      const selected = league === currentLeague;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.addEventListener('click', () => {
        if (currentLeague === league) return;
        currentLeague = league;
        renderTabs();
        loadCurrentLeague(false);
      });
      fragment.appendChild(button);
    });
    standingsTabs.replaceChildren(fragment);
    if (!groups.size) {
      standingsContent.replaceChildren(el('div', 'global-standings-empty', 'Add a team to My Teams to make league standings available.'));
      setStatus('');
    }
  }

  async function loadCurrentLeague(force = false) {
    const groups = leagueGroups();
    currentLeague = preferredLeague(groups);
    const teams = groups.get(currentLeague) || [];
    if (!currentLeague || !teams.length) return;
    const representative = teams[0];
    const token = ++loadToken;
    setStatus(`Loading ${currentLeague} standings…`, 'loading');
    standingsRetry.hidden = true;
    standingsContent.replaceChildren(el('div', 'global-standings-loading', 'Connecting to standings data…'));
    try {
      const snapshot = await window.ScoreboardData.load(representative, force);
      if (token !== loadToken || currentScreen !== 'standings') return;
      const groupsToShow = displayGroups(snapshot, currentLeague);
      if (!groupsToShow.length) throw new Error('No usable standings groups were returned.');
      const fragment = document.createDocumentFragment();
      groupsToShow.forEach(group => fragment.appendChild(makeTable(group, teams, currentLeague)));
      standingsContent.replaceChildren(fragment);
      setStatus(`${currentLeague} standings · ${teams.length} selected ${teams.length === 1 ? 'team' : 'teams'} highlighted`, 'ok');
      standingsRetry.hidden = true;
    } catch (error) {
      if (token !== loadToken || currentScreen !== 'standings') return;
      standingsContent.replaceChildren(el('div', 'global-standings-error', 'Standings are temporarily unavailable for this league.'));
      setStatus(error?.message || 'Standings feed unavailable.', 'bad');
      standingsRetry.hidden = false;
    }
  }

  function showScreen(screen) {
    const next = screen === 'standings' ? 'standings' : 'teams';
    if (next === currentScreen && ((next === 'teams' && !myTeamsScreen.hidden) || (next === 'standings' && !standingsScreen.hidden))) return;

    scrollByScreen[currentScreen] = window.scrollY;
    currentScreen = next;
    const standings = currentScreen === 'standings';
    myTeamsScreen.hidden = standings;
    standingsScreen.hidden = !standings;
    headerActions.hidden = standings;
    pageTitle.textContent = standings ? 'STANDINGS' : 'MY TEAMS';
    document.title = standings ? 'scoreboard · standings' : 'scoreboard · my teams';

    if (standings) {
      renderTabs();
      loadCurrentLeague(false);
    }

    requestAnimationFrame(() => window.scrollTo({ top: scrollByScreen[currentScreen] || 0, behavior: 'instant' }));
  }

  function topLevelBlocked(target) {
    if (document.body.classList.contains('editing') || document.body.classList.contains('modal-open')) return true;
    if (!document.getElementById('data-modal')?.hidden) return true;
    if (!document.getElementById('depth-chart-overlay')?.hidden) return true;
    let node = target instanceof Element ? target : null;
    while (node && node !== document.body) {
      if (node.matches('input, textarea, select, [contenteditable="true"], .standings-league-tabs, .global-standings-table-wrap')) return true;
      const style = getComputedStyle(node);
      if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 4) return true;
      node = node.parentElement;
    }
    return false;
  }

  function beginSwipe(event) {
    if (event.touches?.length !== 1 || topLevelBlocked(event.target)) {
      touchStart = null;
      return;
    }
    const touch = event.touches[0];
    const edge = 24;
    if (touch.clientX <= edge || touch.clientX >= window.innerWidth - edge) {
      touchStart = null;
      return;
    }
    touchStart = { x: touch.clientX, y: touch.clientY, at: Date.now() };
  }

  function finishSwipe(event) {
    if (!touchStart || event.changedTouches?.length !== 1) {
      touchStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const elapsed = Date.now() - touchStart.at;
    touchStart = null;
    if (elapsed > 1000 || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.35) return;

    if (currentScreen === 'teams' && dx < 0) showScreen('standings');
    else if (currentScreen === 'standings' && dx > 0) showScreen('teams');
    // Right-swipe from My Teams is intentionally reserved for the future Sports News screen.
  }

  standingsRetry.addEventListener('click', () => loadCurrentLeague(true));
  document.addEventListener('touchstart', beginSwipe, { passive: true });
  document.addEventListener('touchend', finishSwipe, { passive: true });
  document.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

  new MutationObserver(() => {
    if (currentScreen !== 'standings') return;
    const previous = currentLeague;
    renderTabs();
    if (currentLeague !== previous || !standingsContent.children.length) loadCurrentLeague(false);
  }).observe(teamGrid, { childList: true });

  window.ScoreboardTopLevel = Object.freeze({ show: showScreen, current: () => currentScreen });
  currentScreen = 'teams';
  myTeamsScreen.hidden = false;
  standingsScreen.hidden = true;
  headerActions.hidden = false;
})();
