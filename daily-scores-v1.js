(() => {
  'use strict';

  const CBS = 'https://www.cbssports.com';
  const CACHE_MS = 45 * 1000;
  const REFRESH_MS = 60 * 1000;
  const content = document.getElementById('global-standings-content');
  const status = document.getElementById('global-standings-status');
  const retry = document.getElementById('global-standings-retry');
  if (!content || !status || !retry) return;

  const cache = new Map();
  let timer = null;
  let activeLeague = '';
  let activeTeams = [];
  let active = false;
  let token = 0;

  const el = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  };

  function clean(value) {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function compactDate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return String(y) + m + d;
  }

  function longDate(date = new Date()) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }

  function shortDate(date = new Date()) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function scheduleUrl(league, date = new Date()) {
    const day = compactDate(date);
    if (league === 'MLB') return CBS + '/mlb/schedule/' + day + '/';
    if (league === 'NHL') return CBS + '/nhl/schedule/' + day + '/';
    if (league === 'NBA') return CBS + '/nba/schedule/' + day + '/';
    if (league === 'WNBA') return CBS + '/wnba/schedule/' + day + '/';
    if (league === 'NFL') return CBS + '/nfl/schedule/';
    if (league === 'NCAA') return CBS + '/college-football/schedule/FBS/';
    return '';
  }

  async function fetchHtml(url, force = false) {
    const cached = cache.get(url);
    if (!force && cached && Date.now() - cached.loadedAt < CACHE_MS) return cached.html;
    const response = await fetch(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow'
    });
    if (!response.ok) throw new Error('CBS HTTP ' + response.status);
    const html = await response.text();
    cache.set(url, { loadedAt: Date.now(), html });
    return html;
  }

  function dateHeading(text) {
    return /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}$/i.test(clean(text));
  }

  function tableRows(table) {
    const rows = [...table.querySelectorAll('tr')];
    if (!rows.length) return [];
    const headerRow = table.querySelector('thead tr') || rows[0];
    const headers = [...headerRow.querySelectorAll('th,td')].map(cell => clean(cell.textContent));
    const key = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
    const indexOf = names => {
      const wanted = new Set(names.map(key));
      return headers.findIndex(label => wanted.has(key(label)));
    };

    const awayIndex = indexOf(['Away']);
    const homeIndex = indexOf(['Home']);
    const resultIndex = indexOf(['Result']);
    const timeIndex = indexOf(['Time / TV', 'Time/TV', 'Time']);
    const venueIndex = indexOf(['Venue']);
    if (awayIndex < 0 || homeIndex < 0) return [];

    return rows
      .filter(row => row !== headerRow)
      .map(row => [...row.querySelectorAll('th,td')].map(cell => clean(cell.textContent)))
      .filter(cells => cells.length > Math.max(awayIndex, homeIndex))
      .map(cells => {
        let result = resultIndex >= 0 ? (cells[resultIndex] || '') : '';
        let time = timeIndex >= 0 ? (cells[timeIndex] || '') : '';
        const liveScoreInTime = /\b[A-Z][A-Z0-9.]{1,7}\s+\d+.*\b[A-Z][A-Z0-9.]{1,7}\s+\d+/i.test(time);
        if (!result && liveScoreInTime) {
          result = time;
          time = '';
        }
        return {
          away: cells[awayIndex] || '',
          home: cells[homeIndex] || '',
          result,
          time,
          venue: venueIndex >= 0 ? (cells[venueIndex] || '') : ''
        };
      })
      .filter(game => game.away && game.home);
  }

  function parseSchedule(html, date = new Date()) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const targetDate = clean(longDate(date));
    const nodes = [...doc.querySelectorAll('h2,h3,h4,h5,h6,table')];
    let activeDate = '';
    const games = [];

    nodes.forEach(node => {
      if (node.tagName === 'TABLE') {
        if (activeDate === targetDate) games.push(...tableRows(node));
        return;
      }
      const text = clean(node.textContent);
      if (dateHeading(text)) activeDate = text;
    });

    if (games.length) return games;
    return [...doc.querySelectorAll('table')].flatMap(tableRows);
  }

  function stateFor(game) {
    const result = clean(game?.result);
    if (result && result !== '—') {
      const live = result.match(/(?:^|\s[-·,]\s)(1st|2nd|3rd|4th|OT|2OT|3OT|Half|Halftime|End\s+\d(?:st|nd|rd|th))\s*$/i);
      if (live) return { kind: 'live', label: 'LIVE · ' + live[1] };
      return { kind: 'final', label: 'FINAL' };
    }
    return { kind: 'upcoming', label: clean(game?.time) || 'UPCOMING' };
  }

  function teamAliases(team) {
    const aliases = new Set();
    const full = clean(team?.name).toLowerCase();
    if (full) {
      aliases.add(full);
      full.split(/[^a-z0-9]+/).filter(word => word.length >= 4 && !['new','york','philadelphia'].includes(word)).forEach(word => aliases.add(word));
    }
    const provider = clean(team?.provider?.team).toLowerCase();
    if (provider) aliases.add(provider);
    return [...aliases];
  }

  function sideMatchesMyTeam(name, game, teams) {
    const side = clean(name).toLowerCase();
    const result = clean(game?.result).toLowerCase();
    return teams.some(team => teamAliases(team).some(alias => {
      if (!alias) return false;
      return side.includes(alias) || alias.includes(side) || (alias.length <= 4 && result.includes(alias));
    }));
  }

  function renderGame(game, teams) {
    const card = el('section', 'daily-score-card');
    const awayMine = sideMatchesMyTeam(game.away, game, teams);
    const homeMine = sideMatchesMyTeam(game.home, game, teams);
    if (awayMine || homeMine) card.classList.add('my-team-daily-score');

    const state = stateFor(game);
    const top = el('div', 'daily-score-top');
    top.append(
      el('span', 'daily-score-state ' + state.kind, state.label),
      el('span', 'daily-score-source', 'CBS')
    );
    card.appendChild(top);

    const matchup = el('div', 'daily-score-matchup');
    const away = el('div', 'daily-score-team' + (awayMine ? ' my-team-score-name' : ''));
    away.append(el('span', 'daily-score-side-label', 'AWAY'), el('strong', '', game.away));
    if (awayMine) away.appendChild(el('span', 'daily-score-my-team', 'MY TEAM'));
    const home = el('div', 'daily-score-team' + (homeMine ? ' my-team-score-name' : ''));
    home.append(el('span', 'daily-score-side-label', 'HOME'), el('strong', '', game.home));
    if (homeMine) home.appendChild(el('span', 'daily-score-my-team', 'MY TEAM'));
    matchup.append(away, home);
    card.appendChild(matchup);

    const result = clean(game.result);
    if (result) card.appendChild(el('div', 'daily-score-result', result));
    else if (game.time) card.appendChild(el('div', 'daily-score-result upcoming', game.time));

    if (game.venue) card.appendChild(el('div', 'daily-score-venue', game.venue));
    return card;
  }

  function setStatus(message, state = '') {
    status.hidden = !message;
    status.className = 'global-standings-status' + (state ? ' ' + state : '');
    status.textContent = message;
  }

  function clearRefresh() {
    if (timer) window.clearTimeout(timer);
    timer = null;
  }

  function scheduleRefresh() {
    clearRefresh();
    if (!active) return;
    timer = window.setTimeout(() => {
      if (!active || !activeLeague) return;
      load(activeLeague, activeTeams, true);
    }, REFRESH_MS);
  }

  async function load(league, teams = [], force = false) {
    activeLeague = league;
    activeTeams = Array.isArray(teams) ? [...teams] : [];
    const url = scheduleUrl(league);
    if (!url) {
      content.replaceChildren(el('div', 'global-standings-empty', 'Daily ' + league + ' scores are not configured yet.'));
      setStatus('');
      retry.hidden = true;
      return;
    }

    const request = ++token;
    setStatus('Loading ' + league + ' scores for ' + shortDate() + '…', 'loading');
    retry.hidden = true;
    content.replaceChildren(el('div', 'global-standings-loading', 'Connecting to CBS daily scores…'));

    try {
      const games = parseSchedule(await fetchHtml(url, force));
      if (request !== token || !active) return;

      if (!games.length) {
        content.replaceChildren(el('div', 'global-standings-empty', 'No ' + league + ' games are listed for ' + shortDate() + '.'));
      } else {
        const grid = el('div', 'daily-score-grid');
        games.forEach(game => grid.appendChild(renderGame(game, activeTeams)));
        content.replaceChildren(grid);
      }

      setStatus(league + ' daily scoreboard · ' + shortDate() + ' · CBS · refreshes every minute', 'ok');
      retry.textContent = 'Refresh';
      retry.hidden = false;
      scheduleRefresh();
    } catch (error) {
      if (request !== token || !active) return;
      content.replaceChildren(el('div', 'global-standings-error', 'The CBS daily scoreboard is temporarily unavailable.'));
      setStatus(error?.message || 'CBS scoreboard unavailable.', 'bad');
      retry.textContent = 'Retry';
      retry.hidden = false;
      clearRefresh();
    }
  }

  function activate(league, teams = [], force = false) {
    active = true;
    return load(league, teams, force);
  }

  function stop() {
    active = false;
    activeLeague = '';
    activeTeams = [];
    ++token;
    clearRefresh();
  }

  window.ScoreboardDailyScores = Object.freeze({
    activate,
    load,
    stop,
    scheduleUrl,
    parseSchedule
  });
})();