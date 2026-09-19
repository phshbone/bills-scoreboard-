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
  const shell = document.querySelector('.team-page-shell');

  let currentTeam = null;
  let snapshot = null;
  let view = 'overview';
  let boardScrollY = 0;
  let returnFocusTarget = null;
  let rosterObserver = null;
  let rosterReturnScrollTop = 0;
  let activePlayerKey = '';

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

  function updateBackLabel() {
    if (view === 'overview') back.textContent = '← Back to My Teams';
    else if (view === 'player') back.textContent = '← Back to Roster';
    else back.textContent = '← Back to Team';
  }

  function stopRosterObserver() {
    if (rosterObserver) rosterObserver.disconnect();
    rosterObserver = null;
  }

  function richRosterSport() {
    return ['baseball', 'basketball', 'hockey', 'football'].includes(currentTeam?.sport || '');
  }

  function playerKey(player) {
    return String(player?.id || player?.name || '');
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  function imageTile(className, src, alt, fallbackText = '') {
    const wrap = el('div', className);
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => {
        img.remove();
        if (fallbackText) wrap.textContent = fallbackText;
        else wrap.hidden = true;
      }, { once: true });
      wrap.appendChild(img);
    } else if (fallbackText) {
      wrap.textContent = fallbackText;
    } else {
      wrap.hidden = true;
    }
    return wrap;
  }

  function renderCoreStats(target, core) {
    target.replaceChildren();
    const useful = Array.isArray(core) && core.some(item => {
      const value = String(item?.value ?? '').trim();
      return value && value !== '—' && value !== '--';
    });
    if (!useful) {
      target.classList.add('roster-season-stats-unavailable');
      target.textContent = 'Stats unavailable';
      return;
    }
    target.classList.remove('roster-season-stats-unavailable');
    core.forEach(item => {
      const stat = el('div', 'roster-stat');
      stat.append(
        el('strong', 'roster-stat-value', item.value || '—'),
        el('span', 'roster-stat-label', item.label || '')
      );
      target.appendChild(stat);
    });
  }

  function statKey(item) {
    return String(item?.label || item?.name || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9%/+\-]/g, '');
  }

  const STAT_EXPLANATIONS = Object.freeze({
    WHIP: 'Walks + hits allowed per inning pitched',
    HLD: 'Holds',
    BLSV: 'Blown saves',
    GIDP: 'Grounded into double plays',
    ISO: 'Isolated power',
    ISOP: 'Isolated power',
    'RC/27': 'Runs created per 27 outs',
    SECA: 'Secondary average',
    'GO/FO': 'Ground outs to fly outs',
    DD2: 'Double-doubles',
    TD3: 'Triple-doubles',
    'AST/TO': 'Assist-to-turnover ratio',
    GAA: 'Goals-against average',
    'SV%': 'Save percentage',
    OTL: 'Overtime losses',
    QBR: 'Total quarterback rating',
    RTG: 'Passer rating',
    TGT: 'Targets',
    IN20: 'Punts inside the 20-yard line'
  });

  const FOOTBALL_STAT_EXPLANATIONS = Object.freeze({
    Usage: Object.freeze({
      GP: 'Games played',
      GS: 'Games started',
      SNAP: 'Snaps',
      SNAPS: 'Snaps'
    }),
    Passing: Object.freeze({
      GP: 'Games played',
      CMP: 'Completions',
      ATT: 'Passing attempts',
      'CMP%': 'Completion percentage',
      YDS: 'Passing yards',
      AVG: 'Yards per attempt',
      TD: 'Passing touchdowns',
      INT: 'Interceptions thrown',
      LNG: 'Longest completion',
      SACK: 'Times sacked',
      RTG: 'Passer rating',
      QBR: 'Total quarterback rating'
    }),
    Rushing: Object.freeze({
      GP: 'Games played',
      CAR: 'Rushing attempts',
      ATT: 'Rushing attempts',
      YDS: 'Rushing yards',
      AVG: 'Yards per carry',
      TD: 'Rushing touchdowns',
      LNG: 'Longest rush',
      FD: 'Rushing first downs',
      FUM: 'Fumbles',
      LST: 'Fumbles lost'
    }),
    Receiving: Object.freeze({
      GP: 'Games played',
      REC: 'Receptions',
      TGT: 'Receiving targets',
      YDS: 'Receiving yards',
      AVG: 'Yards per reception',
      TD: 'Receiving touchdowns',
      LNG: 'Longest reception',
      FD: 'Receiving first downs',
      FUM: 'Fumbles',
      LST: 'Fumbles lost'
    }),
    Tackling: Object.freeze({
      TKL: 'Tackles',
      TOT: 'Total tackles',
      SOLO: 'Solo tackles',
      AST: 'Assisted tackles',
      TFL: 'Tackles for loss'
    }),
    'Pressure & turnovers': Object.freeze({
      SACK: 'Sacks',
      QBHT: 'Quarterback hits',
      HUR: 'Quarterback hurries',
      FF: 'Forced fumbles',
      FR: 'Fumble recoveries'
    }),
    'Pass defense': Object.freeze({
      INT: 'Interceptions',
      PD: 'Passes defended',
      PDEF: 'Passes defended',
      DEFL: 'Deflections'
    }),
    Kicking: Object.freeze({
      FG: 'Field goals made',
      FGM: 'Field goals made',
      FGA: 'Field goal attempts',
      'FG%': 'Field goal percentage',
      XP: 'Extra points made',
      XPM: 'Extra points made',
      XPA: 'Extra point attempts',
      PTS: 'Points'
    }),
    Punting: Object.freeze({
      PUNT: 'Punts',
      PUNTS: 'Punts',
      AVG: 'Punt average',
      LNG: 'Longest punt',
      IN20: 'Punts inside the 20-yard line',
      TB: 'Touchbacks'
    })
  });

  function bucketForStat(sport, player, item, categoryName = '') {
    const key = statKey(item);
    const category = String(categoryName || '').toLowerCase();
    const inSet = (...values) => values.includes(key);

    if (sport === 'baseball') {
      const pitcher = /^(SP|RP|P|CP|CL)$/i.test(String(player?.position || '').trim()) || /pitch/i.test(category);
      if (pitcher) {
        if (inSet('GP','GS','W','L','W%','SV','HLD','BLSV')) return 'Record & role';
        if (inSet('ERA','WHIP','R','ER','H','HR','HBP','WP','BK')) return 'Run prevention';
        if (inSet('IP','K','SO','BB','K/BB','K9','K/9','BB9','BB/9','BF')) return 'Command & workload';
        if (inSet('P','P/PA','P/GS','GO','FO','GO/FO')) return 'Contact & efficiency';
        if (/advanced/i.test(category) || inSet('WAR','FIP','XFIP')) return 'Advanced';
        return 'Other pitching';
      }
      if (inSet('GP','PA','AB')) return 'Playing time';
      if (inSet('H','AVG','OBP','SLG','OPS')) return 'Core batting';
      if (inSet('R','HR','RBI','2B','3B','XBH','TB')) return 'Power & production';
      if (inSet('BB','SO','K','HBP','IBB','BB/K','BB/PA','AB/HR')) return 'Plate discipline';
      if (inSet('SB','CS','SB%')) return 'Baserunning';
      if (inSet('GIDP','SH','SF')) return 'Situational';
      if (/advanced/i.test(category) || inSet('WAR','OWAR','RC','RC/27','ISO','ISOP','SECA','GO','FO','GO/FO')) return 'Advanced';
      return 'Other batting';
    }

    if (sport === 'basketball') {
      if (inSet('GP','GS','MIN')) return 'Usage';
      if (inSet('PTS','FG','FG%','3PT','3P%','FT','FT%')) return 'Scoring';
      if (inSet('OR','DR','REB')) return 'Rebounding';
      if (inSet('AST','TO','AST/TO')) return 'Playmaking';
      if (inSet('STL','BLK')) return 'Defense';
      if (inSet('DD2','TD3')) return 'Milestones';
      if (inSet('PF','TECH','FLAG','DQ','EJECT')) return 'Fouls & discipline';
      if (inSet('STL/TO','SC-EFF','SH-EFF')) return 'Efficiency';
      return 'Other';
    }

    if (sport === 'hockey') {
      const goalie = /^G$/i.test(String(player?.position || '').trim()) || /goal/i.test(category);
      if (goalie) {
        if (inSet('GP','GS','W','L','OTL','SO')) return 'Record';
        if (inSet('GAA','SV%','SV','GA')) return 'Goaltending';
        if (inSet('SA','MIN','TOI')) return 'Workload';
        return 'Other goaltending';
      }
      if (inSet('GP','TOI','ATOI','MIN')) return 'Usage';
      if (inSet('G','A','PTS','+/-')) return 'Scoring';
      if (inSet('S','SOG','SH%','PPG','SHG','GWG')) return 'Shooting & special teams';
      if (inSet('PIM','HIT','HITS','BLK','BLOCKS')) return 'Physical & discipline';
      if (inSet('FOW','FOL','FO%')) return 'Faceoffs';
      return 'Other';
    }

    if (sport === 'football') {
      // Generic labels such as YDS, TD, ATT and AVG mean different things in
      // different football categories. Use the provider's category first, then
      // use abbreviations only for the category-specific refinements.
      if (inSet('GP','GS','SNAP','SNAPS')) return 'Usage';
      if (/receiv/i.test(category)) return 'Receiving';
      if (/rush/i.test(category)) return 'Rushing';
      if (/pass/i.test(category)) return 'Passing';
      if (/punt/i.test(category)) return 'Punting';
      if (/kick|field goal|extra point/i.test(category)) return 'Kicking';
      if (/interception|pass defen|deflection/i.test(category)) return 'Pass defense';
      if (/sack|pressure|fumble/i.test(category)) return 'Pressure & turnovers';
      if (/defen|tack/i.test(category)) {
        if (inSet('INT','PD','PDEF','DEFL')) return 'Pass defense';
        if (inSet('SACK','QBHT','HUR','FF','FR')) return 'Pressure & turnovers';
        return 'Tackling';
      }

      if (inSet('CMP','CMP%','QBR','RTG','Y/A','AY/A')) return 'Passing';
      if (inSet('CAR','RUSH','RUSHYDS','YPC','RUSHTD')) return 'Rushing';
      if (inSet('REC','TGT','RECYDS','YPR','RECTD')) return 'Receiving';
      if (inSet('TOT','TKL','SOLO','AST','TFL')) return 'Tackling';
      if (inSet('SACK','QBHT','HUR','FF','FR')) return 'Pressure & turnovers';
      if (inSet('PD','PDEF','DEFL')) return 'Pass defense';
      if (inSet('FG','FGM','FGA','FG%','XP','XPM','XPA')) return 'Kicking';
      if (inSet('PUNT','PUNTS','IN20')) return 'Punting';
      return 'Other';
    }

    return 'Other';
  }

  function bucketPriority(sport, player) {
    if (sport === 'baseball') {
      const pitcher = /^(SP|RP|P|CP|CL)$/i.test(String(player?.position || '').trim());
      return pitcher
        ? ['Record & role','Run prevention','Command & workload','Contact & efficiency','Advanced','Other pitching']
        : ['Playing time','Core batting','Power & production','Plate discipline','Baserunning','Situational','Advanced','Other batting'];
    }
    if (sport === 'basketball') return ['Usage','Scoring','Playmaking','Rebounding','Defense','Milestones','Efficiency','Fouls & discipline','Other'];
    if (sport === 'hockey') {
      return /^G$/i.test(String(player?.position || '').trim())
        ? ['Record','Goaltending','Workload','Other goaltending']
        : ['Usage','Scoring','Shooting & special teams','Physical & discipline','Faceoffs','Other'];
    }
    if (sport === 'football') return ['Usage','Passing','Rushing','Receiving','Tackling','Pressure & turnovers','Pass defense','Kicking','Punting','Other'];
    return ['Other'];
  }

  function statHasActivity(item) {
    const text = String(item?.value ?? '').trim();
    if (!text || text === '—' || text === '--' || text === '-') return false;
    const numbers = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g);
    if (!numbers?.length) return true;
    return numbers.some(value => Number(value) !== 0);
  }

  function semanticGroups(player, category) {
    const groups = new Map();
    (category?.stats || []).forEach(item => {
      const bucket = bucketForStat(currentTeam?.sport || '', player, item, category?.name || '');
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket).push(item);
    });
    const priority = bucketPriority(currentTeam?.sport || '', player);
    return [...groups.entries()]
      .sort((a, b) => {
        const ai = priority.indexOf(a[0]);
        const bi = priority.indexOf(b[0]);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
      .map(([title, stats]) => ({ title, stats }))
      .filter(group => currentTeam?.sport !== 'football' || group.stats.some(statHasActivity));
  }

  function statExplanation(item, glossary = {}, groupTitle = '') {
    const key = statKey(item);
    if (currentTeam?.sport === 'football') {
      const local = FOOTBALL_STAT_EXPLANATIONS[groupTitle]?.[key];
      if (local) return local;
    }
    return glossary[key] || STAT_EXPLANATIONS[key] || '';
  }

  function renderSemanticCategory(player, category, glossary = {}, seenFootballStats = null) {
    const fragment = document.createDocumentFragment();
    semanticGroups(player, category).forEach(groupData => {
      let stats = groupData.stats;

      // Football feeds repeat GP/GS and can repeat other values across offense,
      // defense and special-team categories. Show each semantic stat once.
      if (currentTeam?.sport === 'football' && seenFootballStats) {
        stats = stats.filter(item => {
          const key = `${groupData.title}:${statKey(item)}`;
          if (seenFootballStats.has(key)) return false;
          seenFootballStats.add(key);
          return true;
        });
        if (!stats.some(statHasActivity)) return;
      }

      const group = el('section', 'player-stat-group');
      const head = el('div', 'player-stat-group-head');
      const scope = groupData.title === category?.name ? '' : (category?.name || 'Statistics');
      const heading = el('div', 'detail-group-title', groupData.title);
      head.appendChild(heading);
      if (scope) head.appendChild(el('div', 'player-stat-scope', scope));
      group.appendChild(head);

      const grid = el('div', 'player-semantic-stat-grid');
      stats.forEach(item => {
        const stat = el('div', 'player-semantic-stat');
        const value = el('strong', 'player-semantic-value', item.value || '—');
        const label = el('span', 'player-semantic-label', item.label || item.name || '');
        stat.append(value, label);
        grid.appendChild(stat);
      });
      group.appendChild(grid);

      const explanations = [];
      stats.forEach(item => {
        const description = statExplanation(item, glossary, groupData.title);
        const key = statKey(item);
        if (description && key && !explanations.some(entry => entry.key === key)) {
          explanations.push({ key, description });
        }
      });
      if (explanations.length) {
        const keyLine = el('div', 'player-stat-key');
        explanations.slice(0, 3).forEach((entry, index) => {
          if (index) keyLine.appendChild(document.createTextNode(' · '));
          keyLine.appendChild(el('span', '', `${entry.key}: ${entry.description}`));
        });
        group.appendChild(keyLine);
      }

      fragment.appendChild(group);
    });
    return fragment;
  }

  async function hydrateRosterCard(row, player) {
    if (!row?.isConnected || row.dataset.statsState === 'loading' || row.dataset.statsState === 'ready') return;
    row.dataset.statsState = 'loading';
    const season = row.querySelector('.roster-season-stats');
    const context = row.querySelector('.roster-stats-context');
    const recent = row.querySelector('.roster-last-line');
    const trend = row.querySelector('.roster-trend-line');

    try {
      const details = await window.ScoreboardData.loadPlayerCard(currentTeam, player);
      if (!row.isConnected) return;
      renderCoreStats(season, details.core);
      if (context) {
        const career = details.coreContext === 'Career';
        context.hidden = !career;
        context.textContent = career ? 'Career snapshot' : '';
      }
      if (details.lastAppearance) {
        recent.hidden = false;
        recent.replaceChildren(
          el('strong', '', `${details.lastAppearance.label}:`),
          document.createTextNode(` ${details.lastAppearance.text}`)
        );
      } else {
        recent.hidden = true;
      }
      if (details.trend) {
        trend.hidden = false;
        trend.textContent = details.trend;
        row.classList.add('has-trend');
      } else {
        trend.hidden = true;
        row.classList.remove('has-trend');
      }
      row.dataset.statsState = 'ready';
    } catch {
      if (!row.isConnected) return;
      renderCoreStats(season, []);
      recent.hidden = true;
      trend.hidden = true;
      row.classList.remove('has-trend');
      row.dataset.statsState = 'error';
    }
  }

  function startRosterHydration(rows) {
    stopRosterObserver();
    const candidates = rows.filter(row => row.classList.contains('rich-roster-card'));
    if (!candidates.length) return;
    if (!('IntersectionObserver' in window)) {
      candidates.forEach(row => hydrateRosterCard(row, row.__scoreboardPlayer));
      return;
    }
    rosterObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        rosterObserver?.unobserve(entry.target);
        hydrateRosterCard(entry.target, entry.target.__scoreboardPlayer);
      });
    }, { root: shell, rootMargin: '320px 0px', threshold: 0.01 });
    candidates.forEach(row => rosterObserver.observe(row));
  }

  function renderPlayerHero(player) {
    const hero = el('section', 'player-detail-hero');
    const logo = imageTile('player-detail-team-logo', snapshot?.teamLogo || '', `${currentTeam.name} logo`);
    const badge = el('div', 'jersey-badge player-detail-number', player.jersey || '—');
    const headshot = imageTile('player-detail-headshot', player.headshot || '', `${player.name} headshot`, initials(player.name));
    const identity = el('div', 'player-detail-identity');
    identity.append(
      el('div', 'player-detail-name', player.name),
      el('div', 'player-detail-position', player.position || 'Position unavailable')
    );
    hero.append(logo, badge, headshot, identity);
    return hero;
  }

  function renderPlayerDetail(player, details) {
    detailContent.replaceChildren();
    detailContent.appendChild(renderPlayerHero(player));

    if (Array.isArray(details.core) && details.core.length) {
      const core = el('section', 'player-core-panel');
      const context = details.coreContext === 'Career' ? 'Career snapshot' : 'Current season snapshot';
      core.appendChild(el('div', 'detail-group-title', context));
      const grid = el('div', 'player-core-stats');
      renderCoreStats(grid, details.core);
      core.appendChild(grid);
      detailContent.appendChild(core);
    }

    if (details.lastAppearance || details.trend) {
      const recent = el('section', 'player-recent-panel');
      recent.appendChild(el('div', 'detail-group-title', 'Recent'));
      if (details.lastAppearance) {
        const line = el('div', 'player-recent-line');
        line.append(
          el('strong', '', `${details.lastAppearance.label}:`),
          document.createTextNode(` ${details.lastAppearance.text}`)
        );
        recent.appendChild(line);
      }
      if (details.trend) recent.appendChild(el('div', 'player-trend-line', details.trend));
      detailContent.appendChild(recent);
    }

    if (Array.isArray(details.categories) && details.categories.length) {
      const groups = el('div', 'player-season-groups player-semantic-groups');
      const seenFootballStats = currentTeam?.sport === 'football' ? new Set() : null;
      details.categories.forEach(category => {
        groups.appendChild(renderSemanticCategory(player, category, details.glossary || {}, seenFootballStats));
      });
      if (groups.childNodes.length) detailContent.appendChild(groups);
    }

    if (!details.core?.length && !details.categories?.length) {
      detailContent.appendChild(panel(
        'Player stats',
        'Unavailable',
        details.errors?.stats || details.errors?.player || 'No detailed statistics were returned for this player.',
        { wide: true, error: true }
      ));
    }
  }

  async function openPlayer(player) {
    if (!player || !currentTeam) return;
    rosterReturnScrollTop = shell?.scrollTop || 0;
    activePlayerKey = playerKey(player);
    stopRosterObserver();
    view = 'player';
    overview.hidden = true;
    detail.hidden = false;
    detailKicker.textContent = currentTeam.name;
    detailTitle.textContent = player.name;
    detailContent.replaceChildren(
      renderPlayerHero(player),
      panel('Player stats', 'Loading…', 'Fetching current season and recent-game data.', { wide: true })
    );
    updateBackLabel();
    shell?.scrollTo({ top: 0, behavior: 'instant' });

    try {
      const details = await window.ScoreboardData.loadPlayerDetails(currentTeam, player);
      if (view !== 'player' || activePlayerKey !== playerKey(player)) return;
      renderPlayerDetail(player, details);
    } catch (error) {
      if (view !== 'player' || activePlayerKey !== playerKey(player)) return;
      detailContent.replaceChildren(
        renderPlayerHero(player),
        panel('Player stats', 'Unavailable', error?.message || 'The player feed did not respond.', { wide: true, error: true })
      );
    }
  }

  function returnToRoster() {
    const restoreTop = rosterReturnScrollTop;
    activePlayerKey = '';
    openDetail('roster');
    requestAnimationFrame(() => shell?.scrollTo({ top: restoreTop, behavior: 'instant' }));
  }

  function showOverview() {
    stopRosterObserver();
    activePlayerKey = '';
    view = 'overview';
    overview.hidden = false;
    detail.hidden = true;
    kicker.textContent = currentTeam?.league || 'scoreboard';
    title.textContent = currentTeam?.name || 'Team';
    updateBackLabel();
    document.querySelector('.team-page-shell')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function openDetail(kind) {
    if (!snapshot || !currentTeam) return;
    if (kind !== 'roster') stopRosterObserver();
    activePlayerKey = '';
    view = kind;
    overview.hidden = true;
    detail.hidden = false;
    detailKicker.textContent = currentTeam.name;
    detailContent.replaceChildren();
    if (kind === 'standings') renderStandings();
    if (kind === 'schedule') renderSchedule();
    if (kind === 'roster') renderRoster();
    if (kind === 'news') renderTeamNews();
    updateBackLabel();
    document.querySelector('.team-page-shell')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function currentTeamMatches(row) {
    const key = String(currentTeam.provider.team).toLowerCase();
    return row.id.toLowerCase() === key || row.abbreviation.toLowerCase() === key;
  }

  function displayStandingGroups() {
    const all = Array.isArray(snapshot.standingGroups) ? snapshot.standingGroups : [];
    if (!all.length) return snapshot.standingGroup ? [snapshot.standingGroup] : [];
    if (currentTeam.league === 'NCAA') return snapshot.standingGroup ? [snapshot.standingGroup] : all.slice(0, 1);
    const leaves = all.filter(group => !group.hasChildren);
    const compactLeaves = leaves.filter(group => group.entries.length <= 10);
    if (compactLeaves.length >= 2) return compactLeaves;
    if (leaves.length) return leaves;
    return all;
  }

  function standingGroupLabel(group) {
    const name = group?.name || 'Standings';
    const parent = group?.parentName || '';
    if (/^(east|central|west|north|south)$/i.test(name) && parent && !new RegExp(name, 'i').test(parent)) return `${parent} ${name}`;
    return name;
  }

  function renderStandings() {
    detailTitle.textContent = 'Standings';
    const groups = displayStandingGroups();
    if (!groups.length) {
      detailContent.appendChild(panel('Standings', 'Unavailable', snapshot.errors.standings || 'No standings were returned for this league.', { wide: true, error: true }));
      return;
    }

    const groupsWrap = el('div', 'standings-groups');
    groups.forEach(group => {
      const wrap = el('section', 'standings-wrap');
      wrap.appendChild(el('div', 'detail-group-title', standingGroupLabel(group)));
      const table = document.createElement('table');
      table.className = 'standings-table';
      const thead = document.createElement('thead');
      const head = document.createElement('tr');
      ['Team', 'Record', 'Pct', 'GB'].forEach(name => head.appendChild(el('th', '', name)));
      thead.appendChild(head);
      const tbody = document.createElement('tbody');
      group.entries.map(window.ScoreboardData.standingRow).forEach(row => {
        const tr = document.createElement('tr');
        if (currentTeamMatches(row)) tr.className = 'current-team-row';
        [row.name, row.record, row.pct || '—', row.gb || '—'].forEach(value => tr.appendChild(el('td', '', value)));
        tbody.appendChild(tr);
      });
      table.append(thead, tbody);
      wrap.appendChild(table);
      groupsWrap.appendChild(wrap);
    });
    detailContent.appendChild(groupsWrap);
  }

  function renderGameRow(game) {
    const row = el('article', `game-row ${game.state || ''}`);
    const text = el('div', 'game-row-text');
    text.append(el('div', 'game-row-main', game.main), el('div', 'game-row-sub', game.sub));
    row.appendChild(text);
    if (game.state === 'in') row.appendChild(el('span', 'live-pill', 'LIVE'));
    return row;
  }

  function renderSchedule() {
    detailTitle.textContent = 'Schedule';
    const games = snapshot.games;
    if (!games) {
      detailContent.appendChild(panel('Schedule', 'Unavailable', snapshot.errors.schedule || 'The schedule feed did not respond.', { wide: true, error: true }));
      return;
    }

    const list = el('div', 'game-list');
    const recent = games.completed.slice(0, 6).reverse();
    const football = currentTeam.sport === 'football';
    const step = 12;
    let shownUpcoming = football ? games.upcoming.length : Math.min(step, games.upcoming.length);

    function draw() {
      list.replaceChildren();
      const items = [...recent, ...(games.live ? [games.live] : []), ...games.upcoming.slice(0, shownUpcoming)];
      if (!items.length) {
        list.appendChild(el('div', 'detail-empty', 'No recent or upcoming games were returned.'));
        return;
      }
      items.forEach(game => list.appendChild(renderGameRow(game)));

      if (football && games.upcoming.length) {
        list.appendChild(el('div', 'schedule-window-note', `${games.upcoming.length} remaining scheduled ${games.upcoming.length === 1 ? 'game' : 'games'} shown.`));
      } else if (shownUpcoming < games.upcoming.length) {
        const remaining = games.upcoming.length - shownUpcoming;
        const row = el('div', 'schedule-more-row');
        const button = el('button', 'button schedule-more-button', `Show next ${Math.min(step, remaining)} games`);
        button.type = 'button';
        button.addEventListener('click', () => {
          shownUpcoming = Math.min(games.upcoming.length, shownUpcoming + step);
          draw();
          list.querySelector('.schedule-more-button')?.focus();
        });
        row.append(button, el('span', 'schedule-window-note', `Showing ${shownUpcoming} of ${games.upcoming.length} upcoming games.`));
        list.appendChild(row);
      } else if (games.upcoming.length) {
        list.appendChild(el('div', 'schedule-window-note', `Showing all ${games.upcoming.length} upcoming games returned by the schedule feed.`));
      }
    }

    draw();
    detailContent.appendChild(list);
  }

  async function renderTeamNews(force = false) {
    detailTitle.textContent = 'News';
    const team = currentTeam;
    const teamId = team?.id;
    if (!team || !window.ScoreboardNews?.teamStories || !window.ScoreboardNews?.storyCard) {
      detailContent.replaceChildren(el('div', 'sports-news-error', 'Team news is temporarily unavailable.'));
      return;
    }

    const loading = el('div', 'sports-news-loading', `Loading ${team.name} news…`);
    detailContent.replaceChildren(loading);

    try {
      const providerTeamId = snapshot?.raw?.teamPayload?.team?.id || team.provider?.team || '';
      const stories = await window.ScoreboardNews.teamStories(team, force, providerTeamId);
      if (view !== 'news' || currentTeam?.id !== teamId) return;

      if (!stories.length) {
        detailContent.replaceChildren(el('div', 'sports-news-empty', `No current ${team.name} stories were returned.`));
        return;
      }

      const list = el('div', 'team-news-list sports-news-content');
      stories.forEach(story => list.appendChild(window.ScoreboardNews.storyCard(story)));
      detailContent.replaceChildren(list);
    } catch (error) {
      if (view !== 'news' || currentTeam?.id !== teamId) return;
      const errorBox = el('div', 'sports-news-error', 'Team news is temporarily unavailable.');
      const actions = el('div', 'sports-news-actions');
      const button = el('button', 'button', 'Retry');
      button.type = 'button';
      button.addEventListener('click', () => renderTeamNews(true));
      actions.appendChild(button);
      detailContent.replaceChildren(errorBox, actions);
    }
  }

  function renderRoster() {
    detailTitle.textContent = 'Roster';
    stopRosterObserver();
    if (!snapshot.roster.length) {
      detailContent.appendChild(panel('Roster', 'Unavailable', snapshot.errors.roster || 'No current players were returned.', { wide: true, error: true }));
      return;
    }

    const duplicateNote = snapshot.rosterMeta?.duplicatesConsolidated
      ? ` · ${snapshot.rosterMeta.duplicatesConsolidated} duplicate feed ${snapshot.rosterMeta.duplicatesConsolidated === 1 ? 'entry' : 'entries'} consolidated`
      : '';
    detailContent.appendChild(el(
      'div',
      'roster-completeness-note',
      `${snapshot.roster.length} unique players shown · grouped by the primary position supplied by the roster feed · empty position groups are not shown${duplicateNote}.`
    ));

    const list = el('div', 'roster-list');
    const renderedRows = [];
    snapshot.roster.forEach(player => {
      if (!richRosterSport()) {
        const row = el('div', 'roster-row');
        const badge = el('div', 'jersey-badge', player.jersey || '—');
        badge.setAttribute('aria-label', player.jersey ? `Number ${player.jersey}` : 'Jersey number unavailable');
        const identity = el('div', 'roster-identity');
        identity.appendChild(el('div', 'roster-name', player.name));
        identity.appendChild(el('div', 'roster-meta', player.position || 'Unassigned'));
        row.append(badge, identity);
        list.appendChild(row);
        renderedRows.push(row);
        return;
      }

      const row = el('button', 'roster-row rich-roster-card');
      row.type = 'button';
      row.dataset.playerId = player.id || '';
      row.dataset.position = player.position || '';
      row.setAttribute('aria-label', `Open statistics for ${player.name}`);
      row.__scoreboardPlayer = player;

      const top = el('div', 'roster-card-top');
      const teamLogo = imageTile('roster-team-logo', snapshot.teamLogo || '', `${currentTeam.name} logo`);
      const badge = el('div', 'jersey-badge', player.jersey || '—');
      badge.setAttribute('aria-label', player.jersey ? `Number ${player.jersey}` : 'Jersey number unavailable');
      const headshot = imageTile('roster-headshot', player.headshot || '', `${player.name} headshot`, initials(player.name));
      const identity = el('div', 'roster-identity');
      identity.append(
        el('div', 'roster-name', player.name),
        el('div', 'roster-meta', player.position || 'Unassigned')
      );
      top.append(teamLogo, badge, headshot, identity);

      const context = el('div', 'roster-stats-context');
      context.hidden = true;
      const season = el('div', 'roster-season-stats roster-season-stats-unavailable', 'Loading season stats…');
      const recent = el('div', 'roster-last-line');
      recent.hidden = true;
      const trend = el('div', 'roster-trend-line');
      trend.hidden = true;
      const chevron = el('span', 'roster-card-chevron', '›');
      chevron.setAttribute('aria-hidden', 'true');

      row.append(top, context, season, recent, trend, chevron);
      row.addEventListener('click', () => openPlayer(player));
      list.appendChild(row);
      renderedRows.push(row);
    });
    detailContent.appendChild(list);
    startRosterHydration(renderedRows);
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
    nodes.push(panel('News', 'Latest team stories', `Open current ${currentTeam.name} news.`, {
      action: () => openDetail('news'),
      actionLabel: `Open ${currentTeam.name} news`
    }));
    const rosterBox = panel('Roster', snapshot.roster.length ? `${snapshot.roster.length} players` : 'Unavailable', snapshot.roster.length ? 'Open the current roster.' : snapshot.errors.roster || '', {
      action: snapshot.roster.length ? () => openDetail('roster') : null,
      actionLabel: snapshot.roster.length ? `Open ${currentTeam.name} roster` : '',
      error: !snapshot.roster.length
    });
    if (snapshot.roster.length) rosterBox.insertBefore(el('div', 'roster-preview', snapshot.roster.slice(0, 4).map(player => player.name).join(' · ')), rosterBox.querySelector('.panel-link'));
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

  async function openTeam(team, force = false, returnTarget = null) {
    if (!team) return;
    const openingNewContext = modal.hidden || currentTeam?.id !== team.id;
    currentTeam = team;
    view = 'overview';
    if (openingNewContext) {
      boardScrollY = window.scrollY;
      returnFocusTarget = returnTarget instanceof HTMLElement ? returnTarget : null;
    }
    modal.dataset.teamId = team.id;
    kicker.textContent = team.league;
    title.textContent = team.name;
    overview.hidden = false;
    detail.hidden = true;
    grid.replaceChildren(panel('Connecting', 'Loading team data…', 'Record, games, schedule, roster, and standings are being checked.', { wide: true }));
    status.hidden = false;
    statusDot.className = 'status-dot';
    statusText.textContent = 'Connecting to sports data…';
    modal.hidden = false;
    document.documentElement.classList.add('team-page-open');
    document.body.classList.add('modal-open', 'team-page-open');
    updateBackLabel();
    document.querySelector('.team-page-shell')?.scrollTo({ top: 0 });
    back.focus();
    const result = await window.ScoreboardData.load(team, force);
    if (modal.hidden || currentTeam?.id !== team.id) return;
    snapshot = result;
    renderOverview();
  }

  function close() {
    if (view === 'player') return returnToRoster();
    if (view !== 'overview') return showOverview();
    const id = currentTeam?.id;
    const focusTarget = returnFocusTarget;
    modal.hidden = true;
    delete modal.dataset.teamId;
    currentTeam = null;
    snapshot = null;
    returnFocusTarget = null;
    document.documentElement.classList.remove('team-page-open');
    document.body.classList.remove('modal-open', 'team-page-open');
    window.scrollTo({ top: boardScrollY });
    if (focusTarget?.isConnected) focusTarget.focus();
    else if (id) document.querySelector(`#team-grid [data-team-id="${id}"]`)?.focus();
  }

  // iOS can still elastically move an internal scroller at its exact edges even
  // when scroll chaining is disabled. Cancel only the outward edge gesture so
  // normal team-page scrolling remains native and the Back rail cannot be
  // dragged away from the viewport.
  let touchY = null;
  if (shell) {
    shell.addEventListener('touchstart', event => {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
    }, { passive: true });

    shell.addEventListener('touchmove', event => {
      if (touchY === null || event.touches.length !== 1) return;
      const nextY = event.touches[0].clientY;
      const deltaY = nextY - touchY;
      const maxScroll = Math.max(0, shell.scrollHeight - shell.clientHeight);
      const atTop = shell.scrollTop <= 0;
      const atBottom = shell.scrollTop >= maxScroll - 1;

      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault();
      }
      touchY = nextY;
    }, { passive: false });

    const clearTouch = () => { touchY = null; };
    shell.addEventListener('touchend', clearTouch, { passive: true });
    shell.addEventListener('touchcancel', clearTouch, { passive: true });
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
