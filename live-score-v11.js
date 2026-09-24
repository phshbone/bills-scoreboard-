(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const MLB_SCHEDULE = 'https://statsapi.mlb.com/api/v1/schedule';
  const MLB_CACHE_MS = 15000;
  const MLB_TEAM_IDS = Object.freeze({
    laa: 108, ari: 109, bal: 110, bos: 111, chc: 112, cin: 113, cle: 114, col: 115,
    det: 116, hou: 117, kc: 118, lad: 119, wsh: 120, nym: 121, ath: 133, pit: 134,
    sd: 135, sea: 136, sf: 137, stl: 138, tb: 139, tex: 140, tor: 141, min: 142,
    phi: 143, atl: 144, cws: 145, mia: 146, nyy: 147, mil: 158
  });
  const teamPage = document.getElementById('data-modal');
  const dataGrid = document.getElementById('data-grid');
  let refreshTimer = null;
  let activeTeam = null;
  let returnTrigger = null;
  let overlayMode = 'live';
  let mlbCache = { date: '', loadedAt: 0, payload: null };

  function el(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  function currentTeam() {
    const id = teamPage?.dataset?.teamId;
    return Array.isArray(window.SCOREBOARD_TEAMS)
      ? window.SCOREBOARD_TEAMS.find(team => team.id === id) || null
      : null;
  }

  function scoreboardUrl(team) {
    const p = team.provider;
    return `${SITE}/${p.sport}/${p.league}/scoreboard`;
  }

  function eventState(event) {
    const type = event?.competitions?.[0]?.status?.type || event?.status?.type || {};
    if (type.completed === true) return 'post';
    return type.state || '';
  }

  function competitorMatches(competitor, team) {
    const key = String(team.provider.team || '').toLowerCase();
    const id = String(competitor?.team?.id || '').toLowerCase();
    const abbr = String(competitor?.team?.abbreviation || '').toLowerCase();
    return id === key || abbr === key;
  }

  function containsTeam(event, team) {
    const competitors = event?.competitions?.[0]?.competitors || [];
    return competitors.some(competitor => competitorMatches(competitor, team));
  }

  function eventForTeam(payload, team) {
    const events = Array.isArray(payload?.events) ? payload.events.filter(event => containsTeam(event, team)) : [];
    return events.find(event => eventState(event) === 'in')
      || events.filter(event => eventState(event) === 'post').sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0))[0]
      || null;
  }

  function scoreValue(competitor) {
    const score = competitor?.score;
    return String(score?.displayValue ?? score?.value ?? score ?? '—');
  }

  function cleanDetail(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const bits = text.split(/\s*[·|]\s*/).map(bit => bit.trim()).filter(Boolean);
    if (bits.length <= 1) return text;
    const seen = new Set();
    const compact = [];
    bits.forEach(bit => {
      const key = bit.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      compact.push(bit);
    });
    return compact.join(' · ');
  }

  function periodLabel(team, index) {
    if (team?.sport === 'hockey') {
      if (index < 3) return String(index + 1);
      if (index === 3) return 'OT';
      return `${index - 2}OT`;
    }
    if (team?.sport === 'football' || team?.sport === 'basketball') {
      if (index < 4) return String(index + 1);
      if (index === 4) return 'OT';
      return `${index - 3}OT`;
    }
    return String(index + 1);
  }

  function lineScoreValue(entry) {
    return String(entry?.displayValue ?? entry?.value ?? entry ?? '—');
  }

  function periodBreakdown(team, mine, other) {
    if (team?.sport === 'baseball') return [];
    const mineLines = Array.isArray(mine?.linescores) ? mine.linescores : [];
    const otherLines = Array.isArray(other?.linescores) ? other.linescores : [];
    const count = Math.max(mineLines.length, otherLines.length);
    if (!count) return [];
    return Array.from({ length: count }, (_, index) => ({
      label: periodLabel(team, index),
      mine: lineScoreValue(mineLines[index]),
      other: lineScoreValue(otherLines[index])
    }));
  }

  function possessionName(competition, competitors) {
    const raw = competition?.situation?.possession
      ?? competition?.situation?.possessionTeam?.id
      ?? competition?.situation?.possessionTeam?.uid
      ?? '';
    const key = String(raw || '').toLowerCase();
    if (!key) return '';
    const found = competitors.find(competitor => {
      const ids = [
        competitor?.id,
        competitor?.uid,
        competitor?.team?.id,
        competitor?.team?.uid,
        competitor?.team?.abbreviation
      ].map(value => String(value || '').toLowerCase()).filter(Boolean);
      return ids.includes(key);
    });
    return found?.team?.shortDisplayName || found?.team?.displayName || found?.team?.abbreviation || '';
  }
  function baseballBattingSide(team, event, competitors, mine, detail) {
    if (team?.sport !== 'baseball' || eventState(event) !== 'in') return '';
    const state = String(detail || '').trim().toLowerCase();
    const half = /^top\b/.test(state) ? 'away' : /^(bot|bottom)\b/.test(state) ? 'home' : '';
    if (!half) return '';
    const batting = competitors.find(competitor => String(competitor?.homeAway || '').toLowerCase() === half);
    if (!batting) return '';
    return batting === mine || competitorMatches(batting, team) ? 'mine' : 'other';
  }

  function parseEvent(event, team) {
    if (!event) return null;
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const mine = competitors.find(competitor => competitorMatches(competitor, team));
    const other = competitors.find(competitor => competitor !== mine) || competitors[0];
    const statusType = competition.status?.type || event.status?.type || {};
    const detail = cleanDetail(statusType.shortDetail || statusType.detail || '');
    return {
      state: eventState(event),
      detail,
      mineName: mine?.team?.shortDisplayName || mine?.team?.displayName || team.name,
      mineScore: scoreValue(mine),
      otherName: other?.team?.shortDisplayName || other?.team?.displayName || other?.team?.abbreviation || 'Opponent',
      otherScore: scoreValue(other),
      battingSide: baseballBattingSide(team, event, competitors, mine, detail),
      possessionName: possessionName(competition, competitors),
      periods: periodBreakdown(team, mine, other),
      source: 'ESPN public JSON'
    };
  }

  async function fetchScoreboard(team) {
    const response = await fetch(scoreboardUrl(team), { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  function summaryUrl(team, eventId) {
    const p = team?.provider || {};
    return `${SITE}/${p.sport}/${p.league}/summary?event=${encodeURIComponent(String(eventId || ''))}`;
  }

  async function fetchEventSummary(team, eventId) {
    if (!eventId) throw new Error('Missing event id');
    const response = await fetch(summaryUrl(team, eventId), {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Summary HTTP ${response.status}`);
    return response.json();
  }

  function parseSummaryGame(payload, team) {
    const header = payload?.header;
    if (!header?.competitions?.length) return null;
    return parseEvent(header, team);
  }

  function localDateKey(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function mlbTeamId(team) {
    const key = String(team?.provider?.team || '').toLowerCase();
    return MLB_TEAM_IDS[key] || null;
  }

  function mlbState(game) {
    const abstract = String(game?.status?.abstractGameState || '').toLowerCase();
    if (abstract === 'live') return 'in';
    if (abstract === 'final') return 'post';
    return 'pre';
  }

  function mlbBattingSide(team, game, mineSide) {
    if (mlbState(game) !== 'in') return '';
    const state = String(game?.linescore?.inningState || '').toLowerCase();
    if (state === 'top') return mineSide === 'away' ? 'mine' : 'other';
    if (state === 'bottom') return mineSide === 'home' ? 'mine' : 'other';
    return '';
  }

  function mlbRhe(game, side) {
    const line = game?.linescore?.teams?.[side] || {};
    const score = game?.teams?.[side]?.score;
    return {
      r: String(line.runs ?? score ?? '—'),
      h: String(line.hits ?? '—'),
      e: String(line.errors ?? '—')
    };
  }
  function parseMlbGame(game, team) {
    if (!game) return null;
    const targetId = mlbTeamId(team);
    if (!targetId) return null;

    const away = game?.teams?.away || {};
    const home = game?.teams?.home || {};
    const awayId = Number(away?.team?.id);
    const homeId = Number(home?.team?.id);
    const mineSide = awayId === targetId ? 'away' : homeId === targetId ? 'home' : '';
    if (!mineSide) return null;

    const mine = mineSide === 'away' ? away : home;
    const other = mineSide === 'away' ? home : away;
    const state = mlbState(game);
    const inningState = String(game?.linescore?.inningState || '').trim();
    const inningOrdinal = String(game?.linescore?.currentInningOrdinal || '').trim();
    const outs = Number(game?.linescore?.outs);
    const detailParts = [];
    if (state === 'in') {
      if (inningState || inningOrdinal) detailParts.push([inningState, inningOrdinal].filter(Boolean).join(' '));
      if (Number.isFinite(outs)) detailParts.push(`${outs} ${outs === 1 ? 'out' : 'outs'}`);
    } else if (state === 'post') {
      detailParts.push(String(game?.status?.detailedState || 'Final'));
    } else {
      detailParts.push(String(game?.status?.detailedState || 'Scheduled'));
    }

    return {
      state,
      detail: cleanDetail(detailParts.filter(Boolean).join(' · ')),
      mineName: mine?.team?.name || team.name,
      mineScore: String(mine?.score ?? '—'),
      otherName: other?.team?.name || 'Opponent',
      otherScore: String(other?.score ?? '—'),
      battingSide: mlbBattingSide(team, game, mineSide),
      possessionName: '',
      periods: [],
      rhe: {
        mine: mlbRhe(game, mineSide),
        other: mlbRhe(game, mineSide === 'away' ? 'home' : 'away')
      },
      source: 'MLB StatsAPI'
    };
  }

  async function fetchMlbSchedule(date = localDateKey()) {
    if (mlbCache.payload && mlbCache.date === date && Date.now() - mlbCache.loadedAt < MLB_CACHE_MS) return mlbCache.payload;
    const url = `${MLB_SCHEDULE}?sportId=1&date=${encodeURIComponent(date)}&hydrate=linescore,team`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`MLB HTTP ${response.status}`);
    const payload = await response.json();
    mlbCache = { date, loadedAt: Date.now(), payload };
    return payload;
  }

  function mlbGameForTeam(payload, team) {
    const targetId = mlbTeamId(team);
    if (!targetId) return null;
    const games = (Array.isArray(payload?.dates) ? payload.dates : []).flatMap(date => Array.isArray(date?.games) ? date.games : []);
    const matches = games.filter(game => {
      const awayId = Number(game?.teams?.away?.team?.id);
      const homeId = Number(game?.teams?.home?.team?.id);
      return awayId === targetId || homeId === targetId;
    });
    return matches.find(game => mlbState(game) === 'in')
      || matches.find(game => mlbState(game) === 'post')
      || matches[0]
      || null;
  }

  async function fetchCurrentGame(team, espnPayload = null) {
    let primaryPayload = espnPayload;
    if (!primaryPayload) primaryPayload = await fetchScoreboard(team);
    const espnGame = parseEvent(eventForTeam(primaryPayload, team), team);
    if (espnGame?.state === 'in') return espnGame;

    if (team?.league === 'MLB' || team?.sport === 'baseball') {
      try {
        const mlbPayload = await fetchMlbSchedule();
        const fallback = parseMlbGame(mlbGameForTeam(mlbPayload, team), team);
        if (fallback?.state === 'in') return fallback;
      } catch {
        // ESPN remains usable if the MLB live fallback is unavailable.
      }
    }

    return espnGame;
  }

  function eventById(payload, id) {
    const key = String(id || '');
    if (!key || !Array.isArray(payload?.events)) return null;
    return payload.events.find(event => String(event?.id || event?.competitions?.[0]?.id || '') === key) || null;
  }

  function parseNormalizedLast(last, team) {
    if (!last) return null;
    const parts = String(last.main || '').split(/\s*·\s*/).filter(Boolean);
    const parseTeamScore = value => {
      const match = String(value || '').trim().match(/^(.*\S)\s+(-?\d+(?:\.\d+)?)$/);
      return match ? { name: match[1].trim(), score: match[2] } : null;
    };
    const mine = parseTeamScore(parts[0]);
    const other = parseTeamScore(parts[1]);
    if (!mine || !other) return null;
    return {
      state: 'post',
      detail: 'Final',
      mineName: mine.name || team.name,
      mineScore: mine.score,
      otherName: other.name || 'Opponent',
      otherScore: other.score,
      battingSide: '',
      possessionName: '',
      periods: [],
      source: 'Schedule'
    };
  }

  async function fetchFinalGame(team) {
    const snapshot = await window.ScoreboardData?.load?.(team, false);
    const last = snapshot?.games?.last || null;
    if (!last) return null;

    if (team?.league === 'MLB' || team?.sport === 'baseball') {
      try {
        const timestamp = Number(last.date);
        const date = Number.isFinite(timestamp) ? localDateKey(new Date(timestamp)) : localDateKey();
        const mlbPayload = await fetchMlbSchedule(date);
        const mlbGame = parseMlbGame(mlbGameForTeam(mlbPayload, team), team);
        if (mlbGame?.state === 'post') return mlbGame;
      } catch {
        // Fall through to the generic completed-event path.
      }
    }

    const rawEvent = eventById(snapshot?.raw?.schedulePayload, last.id);
    const scheduleGame = parseEvent(rawEvent, team);
    const baseGame = scheduleGame?.state === 'post' ? scheduleGame : parseNormalizedLast(last, team);

    if (last.id) {
      try {
        const summary = await fetchEventSummary(team, last.id);
        const hydrated = parseSummaryGame(summary, team);
        if (hydrated?.state === 'post' && hydrated.periods?.length) return hydrated;
      } catch {
        // A completed score still renders even if richer period data is unavailable.
      }
    }

    return baseGame;
  }
  function ensureOverlay() {
    let overlay = document.getElementById('live-score-overlay');
    if (overlay) return overlay;

    overlay = el('div', 'live-score-overlay');
    overlay.id = 'live-score-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'live-score-heading');

    const card = el('section', 'live-score-card');
    const top = el('div', 'live-score-top');
    const heading = el('h3', 'live-score-title', 'Scoreboard');
    heading.id = 'live-score-heading';
    const status = el('span', 'live-score-status', 'LIVE');
    status.id = 'live-score-status';
    top.append(heading, status);

    const body = el('div', 'live-score-body');
    body.id = 'live-score-body';
    const actions = el('div', 'live-score-actions');
    const refresh = el('button', 'button', 'Refresh');
    refresh.type = 'button';
    refresh.id = 'live-score-refresh';
    const close = el('button', 'button', 'Close');
    close.type = 'button';
    close.id = 'live-score-close';
    actions.append(refresh, close);
    card.append(top, body, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    close.addEventListener('click', closeOverlay);
    refresh.addEventListener('click', refreshScore);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeOverlay(); });
    return overlay;
  }

  function renderLoading(label = 'Updating scoreboard…') {
    const overlay = ensureOverlay();
    const body = overlay.querySelector('#live-score-body');
    const refresh = overlay.querySelector('#live-score-refresh');
    refresh.hidden = overlayMode !== 'live';
    body.replaceChildren(el('div', 'live-score-detail', label));
  }

  function batIcon() {
    const icon = el('span', 'live-score-bat');
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', 'Batting');
    icon.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g transform="rotate(-38 24 24)"><path d="M18.5 4.5C18.5 1.8 20.8 0 24 0s5.5 1.8 5.5 4.5v20.8c0 5.7-1.7 10.3-4.2 14.2l-.5 4h-1.6l-.5-4c-2.5-3.9-4.2-8.5-4.2-14.2V4.5Z" fill="currentColor"/><rect x="21.5" y="39" width="5" height="6" rx="2.5" fill="currentColor"/><rect x="18.5" y="44" width="11" height="3.5" rx="1.75" fill="currentColor"/></g></svg>';
    return icon;
  }

  function scoreLine(name, score, isBatting) {
    const line = el('div', 'live-score-line');
    if (isBatting) line.classList.add('live-score-batting');
    const team = el('div', 'live-score-team');
    team.appendChild(document.createTextNode(name));
    if (isBatting) team.appendChild(batIcon());
    line.append(team, el('div', 'live-score-number', score));
    return line;
  }

  function breakdownTable(game) {
    if (game?.rhe) {
      const wrap = el('div', 'live-score-breakdown-wrap');
      const table = el('table', 'live-score-breakdown live-score-rhe');
      table.setAttribute('aria-label', 'Runs hits and errors');
      const head = document.createElement('thead');
      const hr = document.createElement('tr');
      ['', 'R', 'H', 'E'].forEach(label => {
        const cell = document.createElement('th');
        cell.textContent = label;
        hr.appendChild(cell);
      });
      head.appendChild(hr);
      const body = document.createElement('tbody');
      [[game.mineName, game.rhe.mine], [game.otherName, game.rhe.other]].forEach(([name, stats]) => {
        const row = document.createElement('tr');
        [name, stats?.r ?? '—', stats?.h ?? '—', stats?.e ?? '—'].forEach((value, index) => {
          const cell = index === 0 ? document.createElement('th') : document.createElement('td');
          cell.textContent = value;
          row.appendChild(cell);
        });
        body.appendChild(row);
      });
      table.append(head, body);
      wrap.appendChild(table);
      return wrap;
    }

    if (!Array.isArray(game?.periods) || !game.periods.length) return null;
    const wrap = el('div', 'live-score-breakdown-wrap');
    const table = el('table', 'live-score-breakdown');
    table.setAttribute('aria-label', 'Scoring by period');
    const head = document.createElement('thead');
    const hr = document.createElement('tr');
    hr.appendChild(document.createElement('th'));
    game.periods.forEach(period => {
      const cell = document.createElement('th');
      cell.textContent = period.label;
      hr.appendChild(cell);
    });
    const totalHead = document.createElement('th');
    totalHead.textContent = 'T';
    hr.appendChild(totalHead);
    head.appendChild(hr);
    const body = document.createElement('tbody');
    [{ name: game.mineName, total: game.mineScore, side: 'mine' }, { name: game.otherName, total: game.otherScore, side: 'other' }].forEach(teamRow => {
      const row = document.createElement('tr');
      const name = document.createElement('th');
      name.textContent = teamRow.name;
      row.appendChild(name);
      game.periods.forEach(period => {
        const cell = document.createElement('td');
        cell.textContent = period[teamRow.side] ?? '—';
        row.appendChild(cell);
      });
      const total = document.createElement('td');
      total.className = 'live-score-total';
      total.textContent = teamRow.total;
      row.appendChild(total);
      body.appendChild(row);
    });
    table.append(head, body);
    wrap.appendChild(table);
    return wrap;
  }

  function renderGame(game) {
    const overlay = ensureOverlay();
    const body = overlay.querySelector('#live-score-body');
    const status = overlay.querySelector('#live-score-status');
    const heading = overlay.querySelector('#live-score-heading');
    const refresh = overlay.querySelector('#live-score-refresh');
    heading.textContent = activeTeam?.name || 'Scoreboard';

    if (!game) {
      status.textContent = '—';
      status.className = 'live-score-status is-final';
      refresh.hidden = true;
      body.replaceChildren(el('div', 'live-score-detail live-score-error', 'No game was returned.'));
      return;
    }

    const isLive = game.state === 'in';
    status.textContent = isLive ? 'LIVE' : 'FINAL';
    status.className = `live-score-status ${isLive ? 'is-live' : 'is-final'}`;
    refresh.hidden = !isLive;
    const nodes = [
      scoreLine(game.mineName, game.mineScore, game.battingSide === 'mine'),
      scoreLine(game.otherName, game.otherScore, game.battingSide === 'other'),
      el('div', 'live-score-detail', game.detail || (isLive ? 'In progress' : 'Final'))
    ];
    if (game.possessionName && isLive && activeTeam?.sport === 'football') {
      nodes.push(el('div', 'live-score-possession', `Possession: ${game.possessionName}`));
    }
    const breakdown = breakdownTable(game);
    if (breakdown) nodes.push(breakdown);
    if (isLive) {
      nodes.push(el('div', 'live-score-updated', `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date())}`));
    }
    body.replaceChildren(...nodes);
  }

  async function refreshScore() {
    if (!activeTeam) return;
    try {
      const game = await fetchCurrentGame(activeTeam);
      renderGame(game);
      if (game?.state !== 'in') stopTimer();
    } catch (error) {
      const body = ensureOverlay().querySelector('#live-score-body');
      body.replaceChildren(el('div', 'live-score-detail live-score-error', `Live score temporarily unavailable. ${error.message}`));
    }
  }

  async function loadFinalScore() {
    if (!activeTeam) return;
    try {
      renderGame(await fetchFinalGame(activeTeam));
    } catch (error) {
      const body = ensureOverlay().querySelector('#live-score-body');
      body.replaceChildren(el('div', 'live-score-detail live-score-error', `Final score temporarily unavailable. ${error.message}`));
    }
  }

  function startTimer() {
    stopTimer();
    refreshTimer = window.setInterval(refreshScore, 30000);
  }

  function stopTimer() {
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function showOverlay(trigger, mode) {
    activeTeam = currentTeam();
    if (!activeTeam) return false;
    returnTrigger = trigger instanceof HTMLElement ? trigger : null;
    overlayMode = mode;
    const overlay = ensureOverlay();
    overlay.hidden = false;
    overlay.querySelector('#live-score-heading').textContent = activeTeam.name;
    const status = overlay.querySelector('#live-score-status');
    status.textContent = mode === 'live' ? 'LIVE' : 'FINAL';
    status.className = `live-score-status ${mode === 'live' ? 'is-live' : 'is-final'}`;
    renderLoading(mode === 'live' ? 'Updating live scoreboard…' : 'Loading final scoreboard…');
    overlay.querySelector('#live-score-close')?.focus();
    return true;
  }

  function openLiveOverlay(event) {
    const trigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!showOverlay(trigger, 'live')) return;
    refreshScore();
    startTimer();
  }

  function openFinalOverlay(event) {
    const trigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!showOverlay(trigger, 'final')) return;
    stopTimer();
    loadFinalScore();
  }

  function closeOverlay() {
    stopTimer();
    const overlay = document.getElementById('live-score-overlay');
    if (overlay) overlay.hidden = true;
    activeTeam = null;
    overlayMode = 'live';
    const trigger = returnTrigger;
    returnTrigger = null;
    if (trigger?.isConnected) trigger.focus();
  }

  function bindPanel(panel, type) {
    const readyKey = type === 'live' ? 'liveScoreReady' : 'finalScoreReady';
    if (panel.dataset[readyKey] === 'true') return;
    panel.dataset[readyKey] = 'true';
    panel.classList.add(type === 'live' ? 'live-score-trigger' : 'final-score-trigger');
    panel.tabIndex = 0;
    panel.setAttribute('role', 'button');
    panel.setAttribute('aria-label', type === 'live' ? 'Open live scoreboard' : 'Open final scoreboard');
    const handler = type === 'live' ? openLiveOverlay : openFinalOverlay;
    panel.addEventListener('click', handler);
    panel.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handler(event);
      }
    });
  }

  function decorateScorePanels() {
    if (!dataGrid || teamPage?.hidden) return;
    dataGrid.querySelectorAll('.data-panel').forEach(panel => {
      const label = panel.querySelector('.data-label')?.textContent?.trim().toLowerCase();
      if (label === 'live now') bindPanel(panel, 'live');
      if (label === 'last game') {
        const value = panel.querySelector('.data-value')?.textContent?.trim().toLowerCase() || '';
        if (value && value !== 'unavailable') bindPanel(panel, 'final');
      }
    });
  }

  const observer = new MutationObserver(decorateScorePanels);
  if (dataGrid) observer.observe(dataGrid, { childList: true, subtree: true });
  decorateScorePanels();

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('live-score-overlay')?.hidden) {
      event.stopImmediatePropagation();
      closeOverlay();
    }
  });

  window.ScoreboardLiveFeed = Object.freeze({
    scoreboardUrl,
    eventState,
    containsTeam,
    parseEvent,
    parseMlbGame,
    summaryUrl,
    parseSummaryGame,
    fetchScoreboard,
    fetchEventSummary,
    fetchCurrentGame,
    fetchFinalGame
  });
})();
