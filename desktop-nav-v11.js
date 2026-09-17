(() => {
  'use strict';

  const nav = document.getElementById('desktop-top-nav');
  const pageTitle = document.getElementById('page-title');
  if (!nav || !pageTitle) return;

  const buttons = [...nav.querySelectorAll('[data-screen]')];

  function currentScreen() {
    return pageTitle.textContent.trim().toUpperCase() === 'STANDINGS' ? 'standings' : 'teams';
  }

  function updateState() {
    const current = currentScreen();
    buttons.forEach(button => {
      if (button.dataset.screen === current) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function show(screen) {
    const api = window.ScoreboardTopLevel;
    if (!api || typeof api.show !== 'function') return;
    api.show(screen);
    updateState();
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => show(button.dataset.screen));
  });

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.matches('input, textarea, select, button, a, [contenteditable="true"]')) return;
    if (document.body.classList.contains('editing') || document.body.classList.contains('modal-open')) return;
    const teamPage = document.getElementById('data-modal');
    if (teamPage && !teamPage.hidden) return;

    const current = currentScreen();
    if (event.key === 'ArrowLeft' && current === 'teams') {
      event.preventDefault();
      show('standings');
    } else if (event.key === 'ArrowRight' && current === 'standings') {
      event.preventDefault();
      show('teams');
    }
  });

  new MutationObserver(updateState).observe(pageTitle, { childList: true, characterData: true, subtree: true });
  updateState();
})();
