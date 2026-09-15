    (() => {
      'use strict';

      const STORAGE_KEY = 'scoreboard.preferences.v2';
      const teamLibrary = Object.freeze([
        { id: 'giants', name: 'New York Giants', league: 'NFL', sport: 'football', image: 'assets/giants.webp', defaultSelected: true, provider: { sport: 'football', league: 'nfl', team: 'nyg' } },
        { id: 'yankees', name: 'New York Yankees', league: 'MLB', sport: 'baseball', image: 'assets/yankees.webp', defaultSelected: true, provider: { sport: 'baseball', league: 'mlb', team: 'nyy' } },
        { id: 'mets', name: 'New York Mets', league: 'MLB', sport: 'baseball', image: 'assets/mets.webp', defaultSelected: true, provider: { sport: 'baseball', league: 'mlb', team: 'nym' } },
        { id: 'jets', name: 'New York Jets', league: 'NFL', sport: 'football', image: 'assets/jets.webp', defaultSelected: true, provider: { sport: 'football', league: 'nfl', team: 'nyj' } },
        { id: 'rangers', name: 'New York Rangers', league: 'NHL', sport: 'hockey', image: 'assets/rangers.webp', defaultSelected: true, provider: { sport: 'hockey', league: 'nhl', team: 'nyr' } },
        { id: 'army', name: 'Army Black Knights', league: 'NCAA', sport: 'football', image: 'assets/army.webp', defaultSelected: true, provider: { sport: 'football', league: 'college-football', team: '349' } },
        { id: 'fever', name: 'Indiana Fever', league: 'WNBA', sport: 'basketball', image: 'assets/fever.webp', defaultSelected: true, provider: { sport: 'basketball', league: 'wnba', team: 'ind' } }
      ]);

      const byId = new Map(teamLibrary.map(team => [team.id, team]));
      const defaultOrder = teamLibrary.filter(team => team.defaultSelected).map(team => team.id);
      let activeIds = loadPreferences();
      let editing = false;
      let dragId = null;

      const grid = document.getElementById('team-grid');
      const count = document.getElementById('team-count');
      const editToggle = document.getElementById('edit-toggle');
      const addTeam = document.getElementById('add-team');
      const resetTeams = document.getElementById('reset-teams');
      const emptyState = document.getElementById('empty-state');
      const modal = document.getElementById('library-modal');
      const libraryList = document.getElementById('library-list');
      const closeLibrary = document.getElementById('close-library');
      function loadPreferences() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return [...defaultOrder];
          const parsed = JSON.parse(raw);
          if (!parsed || !Array.isArray(parsed.activeIds)) return [...defaultOrder];
          const unique = [...new Set(parsed.activeIds)].filter(id => byId.has(id));
          return unique;
        } catch {
          return [...defaultOrder];
        }
      }

      function savePreferences() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, activeIds }));
        } catch {
          // The board remains usable if private browsing or storage policy blocks persistence.
        }
      }

      function activeTeams() {
        return activeIds.map(id => byId.get(id)).filter(Boolean);
      }

      function hiddenTeams() {
        const active = new Set(activeIds);
        return teamLibrary.filter(team => !active.has(team.id));
      }

      function moveTeam(id, delta) {
        const from = activeIds.indexOf(id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= activeIds.length) return;
        [activeIds[from], activeIds[to]] = [activeIds[to], activeIds[from]];
        savePreferences();
        render();
      }

      function moveBefore(movingId, targetId) {
        if (!movingId || movingId === targetId) return;
        const next = activeIds.filter(id => id !== movingId);
        const targetIndex = next.indexOf(targetId);
        if (targetIndex < 0) return;
        next.splice(targetIndex, 0, movingId);
        activeIds = next;
        savePreferences();
        render();
      }

      function hideTeam(id) {
        activeIds = activeIds.filter(teamId => teamId !== id);
        savePreferences();
        render();
      }

      function restoreTeam(id) {
        if (!byId.has(id) || activeIds.includes(id)) return;
        activeIds = [...activeIds, id];
        savePreferences();
        render();
        renderLibrary();
      }

      function createTeamCard(team, index, total) {
        const figure = document.createElement('figure');
        figure.className = 'team-card';
        figure.dataset.teamId = team.id;
        figure.dataset.league = team.league;
        figure.dataset.sport = team.sport;
        figure.draggable = editing;
        figure.tabIndex = editing ? -1 : 0;
        figure.setAttribute('role', 'button');
        figure.setAttribute('aria-label', `Open live data for ${team.name}`);

        const img = document.createElement('img');
        img.src = team.image;
        img.alt = `${team.name} team plaque`;
        img.loading = 'eager';
        img.decoding = 'async';
        img.width = 1000;
        img.height = 563;

        const caption = document.createElement('figcaption');
        caption.className = 'sr-only';
        caption.textContent = `${team.name} · ${team.league}`;

        const order = document.createElement('span');
        order.className = 'order-pill';
        order.textContent = String(index + 1);
        order.setAttribute('aria-hidden', 'true');

        const controls = document.createElement('div');
        controls.className = 'edit-controls';
        controls.setAttribute('aria-label', `Reorder or hide ${team.name}`);

        const up = document.createElement('button');
        up.className = 'icon-button';
        up.type = 'button';
        up.textContent = '↑';
        up.disabled = index === 0;
        up.setAttribute('aria-label', `Move ${team.name} up`);
        up.addEventListener('click', () => moveTeam(team.id, -1));

        const down = document.createElement('button');
        down.className = 'icon-button';
        down.type = 'button';
        down.textContent = '↓';
        down.disabled = index === total - 1;
        down.setAttribute('aria-label', `Move ${team.name} down`);
        down.addEventListener('click', () => moveTeam(team.id, 1));

        const hide = document.createElement('button');
        hide.className = 'icon-button hide-team';
        hide.type = 'button';
        hide.textContent = '−';
        hide.setAttribute('aria-label', `Remove ${team.name} from My Teams`);
        hide.addEventListener('click', () => hideTeam(team.id));

        controls.append(up, down, hide);
        figure.append(img, caption, order, controls);

        figure.addEventListener('click', event => {
          if (editing || event.target.closest('.edit-controls')) return;
          window.ScoreboardLive.open(team);
        });
        figure.addEventListener('keydown', event => {
          if (editing) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            window.ScoreboardLive.open(team);
          }
        });

        figure.addEventListener('dragstart', event => {
          if (!editing) return event.preventDefault();
          dragId = team.id;
          figure.classList.add('dragging');
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', team.id);
        });
        figure.addEventListener('dragend', () => {
          dragId = null;
          figure.classList.remove('dragging');
        });
        figure.addEventListener('dragover', event => {
          if (!editing || !dragId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        });
        figure.addEventListener('drop', event => {
          if (!editing) return;
          event.preventDefault();
          const movingId = event.dataTransfer.getData('text/plain') || dragId;
          moveBefore(movingId, team.id);
        });

        return figure;
      }

      function render() {
        const teams = activeTeams();
        const fragment = document.createDocumentFragment();
        teams.forEach((team, index) => fragment.appendChild(createTeamCard(team, index, teams.length)));
        grid.replaceChildren(fragment);
        count.textContent = `${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`;
        emptyState.classList.toggle('visible', teams.length === 0);
        window.SCOREBOARD_ACTIVE_TEAMS = Object.freeze([...teams]);
      }

      function renderLibrary() {
        const hidden = hiddenTeams();
        if (!hidden.length) {
          const empty = document.createElement('div');
          empty.className = 'library-empty';
          empty.textContent = 'All teams in your current library are already on the board.';
          libraryList.replaceChildren(empty);
          return;
        }

        const fragment = document.createDocumentFragment();
        hidden.forEach(team => {
          const button = document.createElement('button');
          button.className = 'library-team';
          button.type = 'button';
          button.setAttribute('aria-label', `Add ${team.name} to My Teams`);

          const img = document.createElement('img');
          img.src = team.image;
          img.alt = '';
          img.loading = 'lazy';

          const text = document.createElement('span');
          const name = document.createElement('span');
          name.className = 'library-team-name';
          name.textContent = team.name;
          const meta = document.createElement('span');
          meta.className = 'library-team-meta';
          meta.textContent = `${team.league} · ${team.sport}`;
          text.append(name, document.createElement('br'), meta);

          const mark = document.createElement('span');
          mark.className = 'add-mark';
          mark.textContent = '+';
          mark.setAttribute('aria-hidden', 'true');

          button.append(img, text, mark);
          button.addEventListener('click', () => restoreTeam(team.id));
          fragment.appendChild(button);
        });
        libraryList.replaceChildren(fragment);
      }

      function setEditing(next) {
        editing = Boolean(next);
        document.body.classList.toggle('editing', editing);
        editToggle.textContent = editing ? 'Done' : 'Edit';
        editToggle.setAttribute('aria-pressed', String(editing));
        render();
      }

      function openLibrary() {
        renderLibrary();
        modal.hidden = false;
        document.body.classList.add('modal-open');
        closeLibrary.focus();
      }

      function closeLibraryModal() {
        modal.hidden = true;
        document.body.classList.remove('modal-open');
        addTeam.focus();
      }

      editToggle.addEventListener('click', () => setEditing(!editing));
      addTeam.addEventListener('click', openLibrary);
      closeLibrary.addEventListener('click', closeLibraryModal);
      modal.addEventListener('click', event => {
        if (event.target === modal) closeLibraryModal();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.hidden) closeLibraryModal();
      });
      resetTeams.addEventListener('click', () => {
        activeIds = [...defaultOrder];
        savePreferences();
        render();
      });

      window.SCOREBOARD_TEAMS = teamLibrary;
      window.SCOREBOARD_DATA_PROVIDER = Object.freeze({ name: 'ESPN public JSON', officialSupport: false, auth: 'none' });
      render();
      window.__APP_READY__ = true;

      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js').catch(() => {
            // The board remains fully usable online if service-worker registration is unavailable.
          });
        }, { once: true });
      }
    })();
