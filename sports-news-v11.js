(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const STALE_MS = 5 * 60 * 1000;
  const MAX_STORIES = 40;

  const screen = document.getElementById('sports-news-screen');
  const content = document.getElementById('sports-news-content');
  const status = document.getElementById('sports-news-status');
  const retry = document.getElementById('sports-news-retry');
  const teamGrid = document.getElementById('team-grid');
  if (!screen || !content || !status || !retry || !teamGrid) return;

  let loading = false;
  let loadedAt = 0;
  let loadedSignature = '';

  const el = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  };

  function activeTeams() {
    return Array.isArray(window.SCOREBOARD_ACTIVE_TEAMS) ? [...window.SCOREBOARD_ACTIVE_TEAMS] : [];
  }

  function signature(teams) {
    return teams
      .map(team => `${team.id}:${team.provider?.sport || ''}/${team.provider?.league || ''}/${team.provider?.team || ''}`)
      .sort()
      .join('|');
  }

  function leagueConfigs(teams) {
    const map = new Map();
    teams.forEach(team => {
      const p = team?.provider;
      if (!p?.sport || !p?.league) return;
      const key = `${p.sport}/${p.league}`;
      if (!map.has(key)) map.set(key, {
        key,
        sport: p.sport,
        league: p.league,
        label: team.league || String(p.league).toUpperCase(),
        teams: []
      });
      map.get(key).teams.push(team);
    });
    return [...map.values()];
  }

  function newsUrl(config) {
    return `${SITE}/${config.sport}/${config.league}/news`;
  }

  function articleLink(article) {
    const href = article?.links?.web?.href || article?.links?.mobile?.href || '';
    return String(href).replace(/^http:/i, 'https:');
  }

  function articleImage(article) {
    const images = Array.isArray(article?.images) ? article.images : [];
    const preferred = images.find(image => image?.url && (image.type === 'header' || image.ratio === '16x9'));
    return preferred?.url || images.find(image => image?.url)?.url || '';
  }

  function categoryMatchesTeam(category, team) {
    if (String(category?.type || '').toLowerCase() !== 'team') return false;
    const key = String(team?.provider?.team || '').toLowerCase();
    const categoryId = String(category?.teamId ?? category?.team?.id ?? category?.id ?? '').toLowerCase();
    const abbreviation = String(category?.team?.abbreviation || '').toLowerCase();
    return key && (key === categoryId || key === abbreviation);
  }

  function normalizeArticle(article, config) {
    const headline = String(article?.headline || '').trim();
    const href = articleLink(article);
    if (!headline || !href) return null;

    const categories = Array.isArray(article?.categories) ? article.categories : [];
    const relatedTeams = config.teams.filter(team => categories.some(category => categoryMatchesTeam(category, team)));
    const publishedRaw = article?.published || article?.lastModified || '';
    const published = Date.parse(publishedRaw);

    return {
      id: String(article?.id || article?.nowId || href || headline),
      headline,
      description: String(article?.description || '').trim(),
      href,
      image: articleImage(article),
      byline: String(article?.byline || 'ESPN').trim(),
      premium: article?.premium === true,
      type: String(article?.type || '').trim(),
      league: config.label,
      published: Number.isFinite(published) ? published : 0,
      relatedTeams
    };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function fetchLeague(config) {
    const payload = await fetchJson(newsUrl(config));
    const articles = Array.isArray(payload?.articles) ? payload.articles : [];
    return articles.map(article => normalizeArticle(article, config)).filter(Boolean);
  }

  function dedupeStories(stories) {
    const byKey = new Map();
    stories.forEach(story => {
      const key = story.id || story.href || story.headline;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, story);
        return;
      }
      const teams = new Map([...(existing.relatedTeams || []), ...(story.relatedTeams || [])].map(team => [team.id, team]));
      existing.relatedTeams = [...teams.values()];
      if (story.published > existing.published) existing.published = story.published;
    });
    return [...byKey.values()]
      .sort((a, b) => b.published - a.published)
      .slice(0, MAX_STORIES);
  }

  function relativeTime(value) {
    if (!value) return '';
    const delta = value - Date.now();
    const abs = Math.abs(delta);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (abs < 60 * 60 * 1000) return rtf.format(Math.round(delta / (60 * 1000)), 'minute');
    if (abs < 24 * 60 * 60 * 1000) return rtf.format(Math.round(delta / (60 * 60 * 1000)), 'hour');
    return rtf.format(Math.round(delta / (24 * 60 * 60 * 1000)), 'day');
  }

  function storyCard(story) {
    const card = document.createElement('a');
    card.className = `sports-news-card${story.relatedTeams.length ? ' my-team-news' : ''}`;
    card.href = story.href;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.setAttribute('aria-label', `Open story: ${story.headline}`);

    if (story.image) {
      const image = document.createElement('img');
      image.className = 'sports-news-image';
      image.src = story.image;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      card.appendChild(image);
    }

    const body = el('div', 'sports-news-card-body');
    const tags = el('div', 'sports-news-tags');
    tags.appendChild(el('span', 'sports-news-league', story.league));
    story.relatedTeams.slice(0, 2).forEach(team => {
      const tag = el('span', 'sports-news-team-tag', team.name);
      tag.dataset.teamId = team.id;
      tags.appendChild(tag);
    });
    if (story.premium) tags.appendChild(el('span', 'sports-news-premium', 'ESPN+'));
    body.appendChild(tags);

    body.appendChild(el('h2', 'sports-news-headline', story.headline));
    if (story.description) body.appendChild(el('p', 'sports-news-description', story.description));

    const metaParts = [story.byline || 'ESPN', relativeTime(story.published)].filter(Boolean);
    body.appendChild(el('div', 'sports-news-meta', metaParts.join(' · ')));
    card.appendChild(body);
    return card;
  }

  function renderStories(stories) {
    if (!stories.length) {
      content.replaceChildren(el('div', 'sports-news-empty', 'No current stories were returned for the leagues in My Teams.'));
      return;
    }
    const fragment = document.createDocumentFragment();
    stories.forEach(story => fragment.appendChild(storyCard(story)));
    content.replaceChildren(fragment);
  }

  function setStatus(message, state = '') {
    status.hidden = !message;
    status.className = `sports-news-status${state ? ` ${state}` : ''}`;
    status.textContent = message;
  }

  async function activate(force = false) {
    if (loading) return;
    const teams = activeTeams();
    const nextSignature = signature(teams);
    const configs = leagueConfigs(teams);

    if (!configs.length) {
      loadedSignature = nextSignature;
      loadedAt = Date.now();
      retry.hidden = true;
      setStatus('');
      content.replaceChildren(el('div', 'sports-news-empty', 'Add a team to My Teams to build your Sports News feed.'));
      return;
    }

    if (!force && loadedSignature === nextSignature && Date.now() - loadedAt < STALE_MS && content.children.length) return;

    loading = true;
    retry.hidden = true;
    setStatus('Updating Sports News…', 'loading');
    if (!content.children.length || loadedSignature !== nextSignature) {
      content.replaceChildren(el('div', 'sports-news-loading', 'Connecting to the latest league news…'));
    }

    const results = await Promise.allSettled(configs.map(fetchLeague));
    const stories = [];
    let successes = 0;
    results.forEach(result => {
      if (result.status !== 'fulfilled') return;
      successes += 1;
      stories.push(...result.value);
    });

    loading = false;
    if (!successes) {
      content.replaceChildren(el('div', 'sports-news-error', 'Sports News is temporarily unavailable.'));
      setStatus('News feeds did not respond.', 'bad');
      retry.hidden = false;
      return;
    }

    const merged = dedupeStories(stories);
    renderStories(merged);
    loadedSignature = nextSignature;
    loadedAt = Date.now();
    retry.hidden = true;
    if (successes === configs.length) {
      setStatus(`${merged.length} current stories · ${configs.length} ${configs.length === 1 ? 'league' : 'leagues'}`, 'ok');
    } else {
      setStatus(`${merged.length} stories · ${successes} of ${configs.length} leagues updated`, 'partial');
    }
  }

  retry.addEventListener('click', () => activate(true));
  new MutationObserver(() => {
    if (!screen.hidden) activate(true);
  }).observe(teamGrid, { childList: true });

  window.ScoreboardNews = Object.freeze({
    activate,
    refresh: () => activate(true)
  });
})();
