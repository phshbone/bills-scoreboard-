(() => {
  'use strict';

  const detailContent = document.getElementById('detail-content');
  const detailTitle = document.getElementById('detail-title');
  const teamPage = document.getElementById('data-modal');
  if (!detailContent || !detailTitle || !teamPage) return;

  const aliases = Object.freeze({
    football: {
      QB: ['QB','QUARTERBACK'], RB: ['RB','HB','RUNNING BACK','HALFBACK'], FB: ['FB','FULLBACK'],
      WR: ['WR','WIDE RECEIVER'], TE: ['TE','TIGHT END'],
      LT: ['LT','LEFT TACKLE'], RT: ['RT','RIGHT TACKLE'], OT: ['OT','T','OFFENSIVE TACKLE','TACKLE'],
      LG: ['LG','LEFT GUARD'], RG: ['RG','RIGHT GUARD'], OG: ['OG','G','OFFENSIVE GUARD','GUARD'],
      C: ['C','CENTER'], OL: ['OL','OFFENSIVE LINE','OFFENSIVE LINEMAN'],
      DE: ['DE','DEFENSIVE END'], DT: ['DT','DEFENSIVE TACKLE'], NT: ['NT','NOSE TACKLE','NOSE GUARD'], DL: ['DL','DEFENSIVE LINE','DEFENSIVE LINEMAN'],
      EDGE: ['EDGE','EDGE RUSHER'], OLB: ['OLB','OUTSIDE LINEBACKER'], ILB: ['ILB','INSIDE LINEBACKER'], MLB: ['MLB','MIDDLE LINEBACKER'], LB: ['LB','LINEBACKER'],
      CB: ['CB','CORNERBACK'], FS: ['FS','FREE SAFETY'], SS: ['SS','STRONG SAFETY'], S: ['S','SAFETY'], DB: ['DB','DEFENSIVE BACK'],
      K: ['K','KICKER'], P: ['P','PUNTER'], LS: ['LS','LONG SNAPPER'], KR: ['KR','KICK RETURNER'], PR: ['PR','PUNT RETURNER'], RET: ['RET','RETURN SPECIALIST']
    },
    baseball: {
      SP: ['SP','STARTING PITCHER'], RP: ['RP','RELIEF PITCHER'], P: ['P','PITCHER'], C: ['C','CATCHER'],
      '1B': ['1B','FIRST BASE','FIRST BASEMAN'], '2B': ['2B','SECOND BASE','SECOND BASEMAN'], '3B': ['3B','THIRD BASE','THIRD BASEMAN'], SS: ['SS','SHORTSTOP'],
      IF: ['IF','INF','INFIELD','INFIELDER'], LF: ['LF','LEFT FIELD','LEFT FIELDER'], CF: ['CF','CENTER FIELD','CENTER FIELDER'], RF: ['RF','RIGHT FIELD','RIGHT FIELDER'], OF: ['OF','OUTFIELD','OUTFIELDER'],
      DH: ['DH','DESIGNATED HITTER'], UTIL: ['UTIL','UT','UTILITY','UTILITY PLAYER']
    },
    hockey: {
      G: ['G','GOALIE','GOALTENDER'], D: ['D','LD','RD','DEFENSE','DEFENSEMAN'], C: ['C','CENTER'], LW: ['LW','LEFT WING'], RW: ['RW','RIGHT WING'], F: ['F','FORWARD']
    },
    basketball: {
      PG: ['PG','POINT GUARD'], SG: ['SG','SHOOTING GUARD'], G: ['G','GUARD'], GF: ['G-F','F-G','GUARD-FORWARD','FORWARD-GUARD'],
      SF: ['SF','SMALL FORWARD'], PF: ['PF','POWER FORWARD'], F: ['F','FORWARD'], FC: ['F-C','C-F','FORWARD-CENTER','CENTER-FORWARD'], C: ['C','CENTER']
    }
  });

  const labels = Object.freeze({
    QB:'Quarterbacks', RB:'Running Backs', FB:'Fullbacks', WR:'Wide Receivers', TE:'Tight Ends', LT:'Left Tackles', RT:'Right Tackles', OT:'Offensive Tackles', LG:'Left Guards', RG:'Right Guards', OG:'Offensive Guards', C:'Centers', OL:'Offensive Line',
    DE:'Defensive Ends', DT:'Defensive Tackles', NT:'Nose Tackles', DL:'Defensive Line', EDGE:'Edge Rushers', OLB:'Outside Linebackers', ILB:'Inside Linebackers', MLB:'Middle Linebackers', LB:'Linebackers', CB:'Cornerbacks', FS:'Free Safeties', SS:'Strong Safeties', S:'Safeties', DB:'Defensive Backs', K:'Kickers', P:'Punters', LS:'Long Snappers', KR:'Kick Returners', PR:'Punt Returners', RET:'Return Specialists',
    SP:'Starting Pitchers', RP:'Relief Pitchers', P_BASEBALL:'Pitchers', C_BASEBALL:'Catchers', '1B':'First Basemen', '2B':'Second Basemen', '3B':'Third Basemen', SS_BASEBALL:'Shortstops', IF:'Infielders', LF:'Left Fielders', CF:'Center Fielders', RF:'Right Fielders', OF:'Outfielders', DH:'Designated Hitters', UTIL:'Utility Players',
    G_HOCKEY:'Goaltenders', D_HOCKEY:'Defensemen', C_HOCKEY:'Centers', LW:'Left Wings', RW:'Right Wings', F_HOCKEY:'Forwards',
    PG:'Point Guards', SG:'Shooting Guards', G_BASKETBALL:'Guards', GF:'Guard / Forwards', SF:'Small Forwards', PF:'Power Forwards', F_BASKETBALL:'Forwards', FC:'Forward / Centers', C_BASKETBALL:'Centers'
  });

  const order = Object.freeze({
    football: ['QB','RB','FB','WR','TE','LT','RT','OT','LG','RG','OG','C','OL','DE','DT','NT','DL','EDGE','OLB','ILB','MLB','LB','CB','FS','SS','S','DB','K','P','LS','KR','PR','RET'],
    baseball: ['SP','RP','P','C','1B','2B','3B','SS','IF','LF','CF','RF','OF','DH','UTIL'],
    hockey: ['G','D','C','LW','RW','F'],
    basketball: ['PG','SG','G','GF','SF','PF','F','FC','C']
  });

  function currentSport() {
    const id = teamPage.dataset.teamId;
    const teams = Array.isArray(window.SCOREBOARD_TEAMS) ? window.SCOREBOARD_TEAMS : [];
    return teams.find(team => team.id === id)?.sport || '';
  }

  function canonicalPosition(raw, sport) {
    const value = String(raw || '').trim().toUpperCase();
    if (!value) return 'OTHER';
    const map = aliases[sport] || {};
    for (const [key, values] of Object.entries(map)) if (values.includes(value)) return key;
    return value;
  }

  function labelFor(key, sport, original) {
    if (key === 'OTHER') return 'Other / Unassigned';
    if (sport === 'baseball' && key === 'P') return labels.P_BASEBALL;
    if (sport === 'baseball' && key === 'C') return labels.C_BASEBALL;
    if (sport === 'baseball' && key === 'SS') return labels.SS_BASEBALL;
    if (sport === 'hockey' && key === 'G') return labels.G_HOCKEY;
    if (sport === 'hockey' && key === 'D') return labels.D_HOCKEY;
    if (sport === 'hockey' && key === 'C') return labels.C_HOCKEY;
    if (sport === 'hockey' && key === 'F') return labels.F_HOCKEY;
    if (sport === 'basketball' && key === 'G') return labels.G_BASKETBALL;
    if (sport === 'basketball' && key === 'F') return labels.F_BASKETBALL;
    if (sport === 'basketball' && key === 'C') return labels.C_BASKETBALL;
    return labels[key] || original || 'Other / Unassigned';
  }

  function groupRoster() {
    if (detailTitle.textContent.trim() !== 'Roster') return;
    const list = detailContent.querySelector('.roster-list');
    if (!list || list.dataset.positionGrouped === 'true') return;
    const sport = currentSport();
    const rows = [...list.querySelectorAll(':scope > .roster-row')];
    if (!rows.length) return;

    const groups = new Map();
    rows.forEach(row => {
      const original = row.querySelector('.roster-meta')?.textContent.trim() || '';
      const key = canonicalPosition(original, sport);
      if (!groups.has(key)) groups.set(key, { key, original, rows: [] });
      groups.get(key).rows.push(row);
    });

    const preferred = order[sport] || [];
    const sorted = [...groups.values()].sort((a,b) => {
      const ai = preferred.indexOf(a.key), bi = preferred.indexOf(b.key);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return labelFor(a.key, sport, a.original).localeCompare(labelFor(b.key, sport, b.original));
    });

    const fragment = document.createDocumentFragment();
    sorted.forEach(group => {
      const section = document.createElement('section');
      section.className = 'roster-position-group';
      const heading = document.createElement('div');
      heading.className = 'roster-position-heading';
      const name = document.createElement('span');
      name.textContent = labelFor(group.key, sport, group.original);
      const count = document.createElement('span');
      count.className = 'roster-position-count';
      count.textContent = String(group.rows.length);
      heading.append(name, count);
      const rowsWrap = document.createElement('div');
      rowsWrap.className = 'roster-position-rows';
      group.rows.forEach(row => rowsWrap.appendChild(row));
      section.append(heading, rowsWrap);
      fragment.appendChild(section);
    });

    list.dataset.positionGrouped = 'true';
    list.replaceChildren(fragment);
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; groupRoster(); });
  }).observe(detailContent, { childList: true, subtree: true });
})();
