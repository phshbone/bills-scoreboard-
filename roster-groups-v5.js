(() => {
  'use strict';

  const detailContent = document.getElementById('detail-content');
  const detailTitle = document.getElementById('detail-title');
  const teamPage = document.getElementById('data-modal');
  if (!detailContent || !detailTitle || !teamPage) return;

  const sportByTeam = Object.freeze({
    giants: 'football', jets: 'football', army: 'football',
    yankees: 'baseball', mets: 'baseball',
    rangers: 'hockey', fever: 'basketball'
  });

  const aliases = Object.freeze({
    football: {
      QB: ['QB', 'QUARTERBACK'], RB: ['RB', 'HB', 'RUNNING BACK', 'HALFBACK'], FB: ['FB', 'FULLBACK'],
      WR: ['WR', 'WIDE RECEIVER'], TE: ['TE', 'TIGHT END'], OT: ['OT', 'OFFENSIVE TACKLE', 'TACKLE'],
      OG: ['OG', 'G', 'OFFENSIVE GUARD', 'GUARD'], C: ['C', 'CENTER'], OL: ['OL', 'OFFENSIVE LINE', 'OFFENSIVE LINEMAN'],
      DE: ['DE', 'DEFENSIVE END'], DT: ['DT', 'DEFENSIVE TACKLE'], DL: ['DL', 'DEFENSIVE LINE', 'DEFENSIVE LINEMAN'],
      OLB: ['OLB', 'OUTSIDE LINEBACKER'], ILB: ['ILB', 'INSIDE LINEBACKER'], LB: ['LB', 'LINEBACKER'],
      CB: ['CB', 'CORNERBACK'], S: ['S', 'SAFETY'], DB: ['DB', 'DEFENSIVE BACK'],
      K: ['K', 'KICKER'], P: ['P', 'PUNTER'], LS: ['LS', 'LONG SNAPPER']
    },
    baseball: {
      SP: ['SP', 'STARTING PITCHER'], RP: ['RP', 'RELIEF PITCHER'], P: ['P', 'PITCHER'], C: ['C', 'CATCHER'],
      '1B': ['1B', 'FIRST BASE', 'FIRST BASEMAN'], '2B': ['2B', 'SECOND BASE', 'SECOND BASEMAN'],
      '3B': ['3B', 'THIRD BASE', 'THIRD BASEMAN'], SS: ['SS', 'SHORTSTOP'],
      LF: ['LF', 'LEFT FIELD', 'LEFT FIELDER'], CF: ['CF', 'CENTER FIELD', 'CENTER FIELDER'],
      RF: ['RF', 'RIGHT FIELD', 'RIGHT FIELDER'], OF: ['OF', 'OUTFIELD', 'OUTFIELDER'], DH: ['DH', 'DESIGNATED HITTER']
    },
    hockey: {
      G: ['G', 'GOALIE', 'GOALTENDER'], D: ['D', 'DEFENSE', 'DEFENSEMAN'], C: ['C', 'CENTER'],
      LW: ['LW', 'LEFT WING'], RW: ['RW', 'RIGHT WING'], F: ['F', 'FORWARD']
    },
    basketball: {
      PG: ['PG', 'POINT GUARD'], SG: ['SG', 'SHOOTING GUARD'], G: ['G', 'GUARD'],
      SF: ['SF', 'SMALL FORWARD'], PF: ['PF', 'POWER FORWARD'], F: ['F', 'FORWARD'], C: ['C', 'CENTER']
    }
  });

  const labels = Object.freeze({
    QB: 'Quarterbacks', RB: 'Running Backs', FB: 'Fullbacks', WR: 'Wide Receivers', TE: 'Tight Ends',
    OT: 'Offensive Tackles', OG: 'Offensive Guards', C: 'Centers', OL: 'Offensive Line',
    DE: 'Defensive Ends', DT: 'Defensive Tackles', DL: 'Defensive Line', OLB: 'Outside Linebackers',
    ILB: 'Inside Linebackers', LB: 'Linebackers', CB: 'Cornerbacks', S: 'Safeties', DB: 'Defensive Backs',
    K: 'Kickers', P: 'Punters', LS: 'Long Snappers',
    SP: 'Starting Pitchers', RP: 'Relief Pitchers', P_BASEBALL: 'Pitchers', C_BASEBALL: 'Catchers',
    '1B': 'First Basemen', '2B': 'Second Basemen', '3B': 'Third Basemen', SS: 'Shortstops',
    LF: 'Left Fielders', CF: 'Center Fielders', RF: 'Right Fielders', OF: 'Outfielders', DH: 'Designated Hitters',
    G_HOCKEY: 'Goaltenders', D: 'Defensemen', C_HOCKEY: 'Centers', LW: 'Left Wings', RW: 'Right Wings', F_HOCKEY: 'Forwards',
    PG: 'Point Guards', SG: 'Shooting Guards', G_BASKETBALL: 'Guards', SF: 'Small Forwards', PF: 'Power Forwards', F_BASKETBALL: 'Forwards', C_BASKETBALL: 'Centers'
  });

  const order = Object.freeze({
    football: ['QB','RB','FB','WR','TE','OT','OG','C','OL','DE','DT','DL','OLB','ILB','LB','CB','S','DB','K','P','LS'],
    baseball: ['SP','RP','P','C','1B','2B','3B','SS','LF','CF','RF','OF','DH'],
    hockey: ['G','D','C','LW','RW','F'],
    basketball: ['PG','SG','G','SF','PF','F','C']
  });

  function canonicalPosition(raw, sport) {
    const value = String(raw || '').trim().toUpperCase();
    if (!value) return 'OTHER';
    const map = aliases[sport] || {};
    for (const [key, values] of Object.entries(map)) {
      if (values.includes(value)) return key;
    }
    return value;
  }

  function labelFor(key, sport, original) {
    if (sport === 'baseball' && key === 'P') return labels.P_BASEBALL;
    if (sport === 'baseball' && key === 'C') return labels.C_BASEBALL;
    if (sport === 'hockey' && key === 'G') return labels.G_HOCKEY;
    if (sport === 'hockey' && key === 'C') return labels.C_HOCKEY;
    if (sport === 'hockey' && key === 'F') return labels.F_HOCKEY;
    if (sport === 'basketball' && key === 'G') return labels.G_BASKETBALL;
    if (sport === 'basketball' && key === 'F') return labels.F_BASKETBALL;
    if (sport === 'basketball' && key === 'C') return labels.C_BASKETBALL;
    return labels[key] || original || 'Other';
  }

  function groupRoster() {
    if (detailTitle.textContent.trim() !== 'Roster') return;
    const list = detailContent.querySelector('.roster-list');
    if (!list || list.dataset.positionGrouped === 'true') return;

    const sport = sportByTeam[teamPage.dataset.teamId] || '';
    const rows = [...list.querySelectorAll(':scope > .roster-row')];
    if (!rows.length) return;

    const groups = new Map();
    rows.forEach(row => {
      const meta = row.querySelector('.roster-meta');
      const original = meta?.textContent.trim() || '';
      const key = canonicalPosition(original, sport);
      if (!groups.has(key)) groups.set(key, { key, original, rows: [] });
      groups.get(key).rows.push(row);
    });

    const preferred = order[sport] || [];
    const sorted = [...groups.values()].sort((a, b) => {
      const ai = preferred.indexOf(a.key);
      const bi = preferred.indexOf(b.key);
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
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      groupRoster();
    });
  });
  observer.observe(detailContent, { childList: true, subtree: true });
})();
