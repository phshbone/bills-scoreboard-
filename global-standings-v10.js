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
  const nav = document.getElementById('primary-nav');
  const teamGrid = document.getElementById('team-grid');
  if (!pageTitle || !headerActions || !myTeamsScreen || !standingsScreen || !standingsTabs || !standingsContent || !standingsStatus || !standingsRetry || !nav || !teamGrid) return;

  let currentScreen = 'teams';
  let currentLeague = '';
  let loadToken = 0;

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

  function makeTable(group, teams) {
    const wrap = el('section', 'global-standings-group');
    wrap.appendChild(el('h3', 'global-standings-group-title', groupLabel(group)));
    const scroller = el('div', 'global-standings-table-wrap');
    const table = document.createElement('table');
    table.className = 'global-standings-table';
    const thead = document.createElement('thead');
    const head = document.createElement('tr');
    ['Team', 'Record', 'Pct', 'GB'].forEach(label => head.appendChild(el('th', '', label)));
    thead.appendChild(head);
    const tbody = document.createElement('tbody');
    const keys = currentTeamKeys(teams);
    (group.entries || []).map(window.ScoreboardData.standingRow).forEach(row => {
      const mine = rowMatches(row, keys);
      const tr = document.createElement('tr');
      if (mine) tr.className = 'my-team-standing';
      const nameCell = el('td', 'global-team-name', row.name || 'Team');
      if (mine) nameCell.appendChild(el('span', 'my-team-mark', 'MY TEAM'));
      tr.append(nameCell, el('td', '', row.record || '—'), el('td', '', row.pct || '—'), el('td', '', row.gb || '—'));
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    scroller.appendChild(table);
    wrap.appendChild(scroller);
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
      groupsToShow.forEach(group => fragment.appendChild(makeTable(group, teams)));
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

  function setNavState() {
    nav.querySelectorAll('[data-screen]').forEach(button => {
      const selected = button.dataset.screen === currentScreen;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function showScreen(screen) {
    currentScreen = screen === 'standings' ? 'standings' : 'teams';
    const standings = currentScreen === 'standings';
    myTeamsScreen.hidden = standings;
    standingsScreen.hidden = !standings;
    headerActions.hidden = standings;
    pageTitle.textContent = standings ? 'STANDINGS' : 'MY TEAMS';
    document.title = standings ? 'scoreboard · standings' : 'scoreboard · my teams';
    setNavState();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (standings) {
      renderTabs();
      loadCurrentLeague(false);
    }
  }

  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-screen]');
    if (!button || button.dataset.screen === currentScreen) return;
    showScreen(button.dataset.screen);
  });

  standingsRetry.addEventListener('click', () => loadCurrentLeague(true));

  new MutationObserver(() => {
    if (currentScreen !== 'standings') return;
    const previous = currentLeague;
    renderTabs();
    if (currentLeague !== previous || !standingsContent.children.length) loadCurrentLeague(false);
  }).observe(teamGrid, { childList: true });

  window.ScoreboardTopLevel = Object.freeze({ show: showScreen, current: () => currentScreen });
  showScreen('teams');
})();
