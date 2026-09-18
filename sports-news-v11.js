(() => {
  'use strict';

  const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
  const STALE_MS = 5 * 60 * 1000;
  const MAX_STORIES = 40;
  const MAX_TEAM_STORIES = 20;
  const SOURCE_PRIORITY = Object.freeze({ ESPN: 0, FOX: 1, CBS: 2, YAHOO: 3 });

  const TEAM_NEWS_ALIASES = Object.freeze({
    giants: ['new york giants', 'ny giants', 'giants'],
    yankees: ['new york yankees', 'ny yankees', 'yankees'],
    mets: ['new york mets', 'ny mets', 'mets'],
    jets: ['new york jets', 'ny jets', 'jets'],
    rangers: ['new york rangers', 'ny rangers', 'rangers'],
    army: ['army black knights', 'army football', 'black knights'],
    fever: ['indiana fever', 'fever'],
    eagles: ['philadelphia eagles', 'philly eagles', 'eagles'],
    phillies: ['philadelphia phillies', 'phillies'],
    flyers: ['philadelphia flyers', 'flyers'],
    sixers: ['philadelphia 76ers', '76ers', 'sixers'],
    knicks: ['new york knicks', 'ny knicks', 'knicks']
  });

  const screen = document.getElementById('sports-news-screen');
  const content = document.getElementById('sports-news-content');
  const status = document.getElementById('sports-news-status');
  const retry = document.getElementById('sports-news-retry');
  const teamGrid = document.getElementById('team-grid');
  if (!screen || !content || !status || !retry || !teamGrid) return;

  let loading = false;
  let loadedAt = 0;
  let loadedSignature = '';
  const teamStoryCache = new Map();

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
      id: `ESPN:${String(article?.id || article?.nowId || href || headline)}`,
      headline,
      description: String(article?.description || '').trim(),
      href,
      image: articleImage(article),
      byline: String(article?.byline || '').trim(),
      premium: article?.premium === true,
      type: String(article?.type || '').trim(),
      league: config.label,
      published: Number.isFinite(published) ? published : 0,
      relatedTeams,
      source: 'ESPN',
      externalCategories: []
    };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function fetchEspnLeague(config) {
    const payload = await fetchJson(newsUrl(config));
    const articles = Array.isArray(payload?.articles) ? payload.articles : [];
    return articles.map(article => normalizeArticle(article, config)).filter(Boolean);
  }

  function normalizedText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  }

  function teamAliases(team) {
    const locked = TEAM_NEWS_ALIASES[team?.id];
    if (locked?.length) return locked;
    const full = normalizedText(team?.name);
    return full ? [full] : [];
  }

  function externalStoryText(story) {
    return normalizedText([
      story?.headline,
      story?.description,
      ...(story?.externalCategories || [])
    ].filter(Boolean).join(' '));
  }

  function externalStoryMatchesTeam(story, team) {
    const haystack = externalStoryText(story);
    if (!haystack) return false;
    return teamAliases(team).some(alias => {
      const needle = normalizedText(alias);
      return needle && new RegExp(`(^|\\s)${escapeRegex(needle)}(?=\\s|$)`).test(haystack);
    });
  }

  function attachExternalTeamMatches(stories, config) {
    return stories.map(story => ({
      ...story,
      relatedTeams: config.teams.filter(team => externalStoryMatchesTeam(story, team))
    }));
  }

  async function fetchCombinedLeague(config, force = false) {
    const jobs = [fetchEspnLeague(config)];
    if (window.ScoreboardNewsSources?.fetchLeague) {
      jobs.push(
        window.ScoreboardNewsSources.fetchLeague(config, force)
          .then(stories => attachExternalTeamMatches(stories, config))
      );
    }

    const results = await Promise.allSettled(jobs);
    const fulfilled = results.filter(result => result.status === 'fulfilled');
    if (!fulfilled.length) throw new Error('All league news sources failed.');
    return fulfilled.flatMap(result => result.value || []);
  }

  function teamConfig(team) {
    const p = team?.provider;
    if (!team || !p?.sport || !p?.league || p?.team == null) return null;
    return {
      key: `${p.sport}/${p.league}`,
      sport: p.sport,
      league: p.league,
      label: team.league || String(p.league).toUpperCase(),
      teams: [team]
    };
  }

  async function fetchEspnTeamStories(team, config, teamKey) {
    const scopedUrls = [
      `${SITE}/${config.sport}/${config.league}/news?team=${encodeURIComponent(teamKey)}`,
      `${SITE}/${config.sport}/${config.league}/teams/${encodeURIComponent(teamKey)}/news`
    ];

    let lastError = null;
    for (const url of scopedUrls) {
      try {
        const payload = await fetchJson(url);
        const articles = Array.isArray(payload?.articles) ? payload.articles : [];
        const stories = articles
          .map(article => normalizeArticle(article, config))
          .filter(Boolean)
          .map(story => ({ ...story, relatedTeams: [team] }));

        if (stories.length) return stories;
      } catch (error) {
        lastError = error;
      }
    }

    try {
      return (await fetchEspnLeague(config))
        .filter(story => story.relatedTeams.some(item => item.id === team.id));
    } catch (error) {
      throw lastError || error;
    }
  }

  function headlineTokens(value) {
    const stop = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'at', 'from', 'is', 'are', 'was', 'be']);
    return normalizedText(value)
      .split(' ')
      .filter(token => token.length > 2 && !stop.has(token));
  }

  function headlineSignature(value) {
    return headlineTokens(value).join(' ');
  }

  function tokenOverlap(a, b) {
    const left = new Set(headlineTokens(a));
    const right = new Set(headlineTokens(b));
    if (!left.size || !right.size) return 0;
    let shared = 0;
    left.forEach(token => { if (right.has(token)) shared += 1; });
    return shared / Math.max(left.size, right.size);
  }

  function sameTeamContext(a, b) {
    const left = new Set((a.relatedTeams || []).map(team => team.id));
    const right = new Set((b.relatedTeams || []).map(team => team.id));
    if (!left.size || !right.size) return false;
    return [...left].some(id => right.has(id));
  }

  function sourceRank(story) {
    return SOURCE_PRIORITY[String(story?.source || '').toUpperCase()] ?? 99;
  }

  function mergeDuplicate(existing, candidate) {
    const preferred = sourceRank(candidate) < sourceRank(existing) ? candidate : existing;
    const other = preferred === existing ? candidate : existing;
    const teams = new Map([...(preferred.relatedTeams || []), ...(other.relatedTeams || [])].map(team => [team.id, team]));
    return {
      ...preferred,
      relatedTeams: [...teams.values()],
      published: Math.max(preferred.published || 0, other.published || 0),
      image: preferred.image || other.image,
      description: preferred.description || other.description
    };
  }

  function dedupeStories(stories, limit = MAX_STORIES) {
    const kept = [];
    stories
      .filter(Boolean)
      .sort((a, b) => (b.published || 0) - (a.published || 0))
      .forEach(story => {
        const signature = headlineSignature(story.headline);
        const duplicateIndex = kept.findIndex(existing => {
          if (signature && signature === headlineSignature(existing.headline)) return true;
          const withinWindow = Math.abs((story.published || 0) - (existing.published || 0)) <= 12 * 60 * 60 * 1000;
          return withinWindow && sameTeamContext(story, existing) && tokenOverlap(story.headline, existing.headline) >= 0.72;
        });

        if (duplicateIndex < 0) {
          kept.push(story);
        } else {
          kept[duplicateIndex] = mergeDuplicate(kept[duplicateIndex], story);
        }
      });

    return kept
      .sort((a, b) => (b.published || 0) - (a.published || 0))
      .slice(0, limit);
  }

  function balanceGlobalStories(stories, limit = MAX_STORIES) {
    const sorted = [...stories]
      .filter(Boolean)
      .sort((a, b) => (b.published || 0) - (a.published || 0));

    const sources = [...new Set(sorted.map(story => String(story.source || 'NEWS').toUpperCase()))];
    if (sources.length <= 1) return sorted.slice(0, limit);

    const maxPerSource = Math.max(8, Math.ceil(limit * 0.30));
    const selected = [];
    const counts = new Map();

    sorted.forEach(story => {
      if (selected.length >= limit) return;
      const source = String(story.source || 'NEWS').toUpperCase();
      const count = counts.get(source) || 0;
      if (count >= maxPerSource) return;
      selected.push(story);
      counts.set(source, count + 1);
    });

    const queues = new Map();
    selected.forEach(story => {
      const source = String(story.source || 'NEWS').toUpperCase();
      if (!queues.has(source)) queues.set(source, []);
      queues.get(source).push(story);
    });

    const balanced = [];
    let lastSource = '';
    let runLength = 0;

    while (balanced.length < selected.length) {
      const candidates = [...queues.entries()]
        .filter(([, queue]) => queue.length)
        .sort((a, b) => (b[1][0]?.published || 0) - (a[1][0]?.published || 0));

      if (!candidates.length) break;

      let pick = candidates[0];
      if (pick[0] === lastSource && runLength >= 2) {
        const alternate = candidates.find(([source]) => source !== lastSource);
        if (alternate) pick = alternate;
        else break;
      }

      const [source, queue] = pick;
      balanced.push(queue.shift());
      if (source === lastSource) runLength += 1;
      else {
        lastSource = source;
        runLength = 1;
      }
    }

    return balanced.slice(0, limit);
  }

  async function teamStories(team, force = false, providerTeamId = '') {
    const config = teamConfig(team);
    if (!config) throw new Error('Team news configuration is unavailable.');

    const teamKey = String(providerTeamId || team.provider.team || '').trim();
    if (!teamKey) throw new Error('Team news identifier is unavailable.');

    const cacheKey = `${team.id}:${config.key}:${teamKey}:multi`;
    const cached = teamStoryCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.loadedAt < STALE_MS) return cached.stories;

    const jobs = [fetchEspnTeamStories(team, config, teamKey)];
    if (window.ScoreboardNewsSources?.fetchLeague) {
      jobs.push(
        window.ScoreboardNewsSources.fetchLeague(config, force)
          .then(stories => attachExternalTeamMatches(stories, config))
          .then(stories => stories.filter(story => externalStoryMatchesTeam(story, team)))
      );
    }

    const results = await Promise.allSettled(jobs);
    const fulfilled = results.filter(result => result.status === 'fulfilled');
    if (!fulfilled.length) throw new Error('Team news sources did not respond.');

    const stories = dedupeStories(fulfilled.flatMap(result => result.value || []), MAX_TEAM_STORIES);
    teamStoryCache.set(cacheKey, { loadedAt: Date.now(), stories });
    return stories;
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
    const hasImage = Boolean(story.image);
    card.className = `sports-news-card${story.relatedTeams.length ? ' my-team-news' : ''}${hasImage ? '' : ' no-image'}`;
    card.href = story.href;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.setAttribute('aria-label', `Open ${story.source || 'sports'} story: ${story.headline}`);

    if (story.image) {
      const image = document.createElement('img');
      image.className = 'sports-news-image';
      image.src = story.image;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        image.remove();
        card.classList.add('no-image');
      }, { once: true });
      card.appendChild(image);
    }

    const body = el('div', 'sports-news-card-body');
    const tags = el('div', 'sports-news-tags');
    tags.appendChild(el('span', `sports-news-source source-${String(story.source || 'news').toLowerCase()}`, story.source || 'NEWS'));
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

    const source = String(story.source || '').trim();
    const byline = String(story.byline || '').trim();
    const metaParts = [
      byline && byline.toLowerCase() !== source.toLowerCase() ? byline : '',
      relativeTime(story.published)
    ].filter(Boolean);
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

  function sourceSummary(stories) {
    const sources = [...new Set(stories.map(story => story.source).filter(Boolean))];
    const order = ['ESPN', 'FOX', 'CBS', 'YAHOO'];
    return sources.sort((a, b) => order.indexOf(a) - order.indexOf(b));
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

    const results = await Promise.allSettled(configs.map(config => fetchCombinedLeague(config, force)));
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

    const deduped = dedupeStories(stories, MAX_STORIES * 3);
    const merged = balanceGlobalStories(deduped, MAX_STORIES);
    renderStories(merged);
    loadedSignature = nextSignature;
    loadedAt = Date.now();
    retry.hidden = true;

    const sources = sourceSummary(merged);
    const sourceText = sources.length ? ` · ${sources.length} ${sources.length === 1 ? 'source' : 'sources'}` : '';
    if (successes === configs.length) {
      setStatus(`${merged.length} current stories · ${configs.length} ${configs.length === 1 ? 'league' : 'leagues'}${sourceText}`, 'ok');
    } else {
      setStatus(`${merged.length} stories · ${successes} of ${configs.length} leagues updated${sourceText}`, 'partial');
    }
  }

  retry.addEventListener('click', () => activate(true));
  new MutationObserver(() => {
    if (!screen.hidden) activate(true);
  }).observe(teamGrid, { childList: true });

  window.ScoreboardNews = Object.freeze({
    activate,
    refresh: () => activate(true),
    teamStories,
    storyCard,
    dedupeStories,
    balanceGlobalStories
  });
})();
