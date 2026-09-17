(() => {
  'use strict';

  const topLevel = window.ScoreboardTopLevel;
  if (!topLevel?.show || !topLevel?.current) return;

  let start = null;

  function repairNeeded() {
    // Stage 11B9 repairs the original top-level swipe guard and owns the complete
    // News ← My Teams → Standings gesture map. Keep this compatibility listener
    // active only on older shells that do not advertise News support.
    if (topLevel.supportsNews === true) return false;
    return !document.getElementById('depth-chart-overlay');
  }

  function blocked(target) {
    if (document.body.classList.contains('editing') || document.body.classList.contains('modal-open')) return true;

    const teamPage = document.getElementById('data-modal');
    if (teamPage && !teamPage.hidden) return true;

    let node = target instanceof Element ? target : null;
    while (node && node !== document.body) {
      if (node.matches('input, textarea, select, [contenteditable="true"], .standings-league-tabs')) return true;
      const style = getComputedStyle(node);
      if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 4) return true;
      node = node.parentElement;
    }
    return false;
  }

  function begin(event) {
    if (!repairNeeded() || event.touches?.length !== 1 || blocked(event.target)) {
      start = null;
      return;
    }

    const touch = event.touches[0];
    const edge = 24;
    if (touch.clientX <= edge || touch.clientX >= window.innerWidth - edge) {
      start = null;
      return;
    }

    start = { x: touch.clientX, y: touch.clientY, at: Date.now() };
  }

  function finish(event) {
    if (!repairNeeded() || !start || event.changedTouches?.length !== 1) {
      start = null;
      return;
    }

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = Date.now() - start.at;
    start = null;

    if (elapsed > 1000 || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.35) return;

    const screen = topLevel.current();
    if (screen === 'teams' && dx < 0) topLevel.show('standings');
    else if (screen === 'standings' && dx > 0) topLevel.show('teams');
  }

  document.addEventListener('touchstart', begin, { passive: true });
  document.addEventListener('touchend', finish, { passive: true });
  document.addEventListener('touchcancel', () => { start = null; }, { passive: true });
})();
