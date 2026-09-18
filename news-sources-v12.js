(() => {
  'use strict';

  const RSS_JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
  const STALE_MS = 5 * 60 * 1000;
  const FOX_KEY = 'MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i';

  const PROVIDERS = Object.freeze({
    FOX: Object.freeze({
      label: 'FOX',
      feeds: Object.freeze({
        mlb: `https://api.foxsports.com/v2/content/optimized-rss?partnerKey=${FOX_KEY}&size=30&tags=fs%2Fmlb`,
        nfl: `https://api.foxsports.com/v2/content/optimized-rss?partnerKey=${FOX_KEY}&size=30&tags=fs%2Fnfl`,
        'college-football': `https://api.foxsports.com/v2/content/optimized-rss?partnerKey=${FOX_KEY}&size=30&tags=fs%2Fcfb`,
        nba: `https://api.foxsports.com/v2/content/optimized-rss?partnerKey=${FOX_KEY}&size=30&tags=fs%2Fnba`,
        nhl: `https://api.foxsports.com/v2/content/optimized-rss?partnerKey=${FOX_KEY}&size=30&tags=fs%2Fnhl`,
        wnba: `https://api.foxsports.com/v2/content/optimized-rss?partnerKey=${FOX_KEY}&size=30&tags=fs%2Fwnba`
      })
    }),
    CBS: Object.freeze({
      label: 'CBS',
      feeds: Object.freeze({
        mlb: 'https://www.cbssports.com/rss/headlines/mlb',
        nfl: 'https://www.cbssports.com/rss/headlines/nfl',
        'college-football': 'https://www.cbssports.com/rss/headlines/college-football',
        nba: 'https://www.cbssports.com/rss/headlines/nba',
        nhl: 'https://www.cbssports.com/rss/headlines/nhl'
      })
    }),
    YAHOO: Object.freeze({
      label: 'Yahoo',
      feeds: Object.freeze({
        mlb: 'https://sports.yahoo.com/mlb/rss.xml',
        nfl: 'https://sports.yahoo.com/nfl/rss.xml',
        'college-football': 'https://sports.yahoo.com/ncaaf/rss.xml',
        nba: 'https://sports.yahoo.com/nba/rss.xml',
        nhl: 'https://sports.yahoo.com/nhl/rss.xml',
        wnba: 'https://sports.yahoo.com/wnba/rss.xml'
      })
    })
  });

  const cache = new Map();

  function stripHtml(value) {
    return String(value || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safeHttps(value) {
    return String(value || '').replace(/^http:/i, 'https:');
  }

  function itemImage(item) {
    const enclosure = item?.enclosure;
    const candidates = [
      item?.thumbnail,
      enclosure?.link,
      enclosure?.url,
      Array.isArray(enclosure) ? enclosure.find(entry => entry?.link || entry?.url)?.link : '',
      Array.isArray(enclosure) ? enclosure.find(entry => entry?.link || entry?.url)?.url : ''
    ];
    return safeHttps(candidates.find(Boolean) || '');
  }

  function publishedTime(item) {
    const value = Date.parse(item?.pubDate || item?.published || item?.date || '');
    return Number.isFinite(value) ? value : 0;
  }

  function normalizeItem(item, source, leagueLabel) {
    const headline = stripHtml(item?.title);
    const href = safeHttps(item?.link || item?.guid || '');
    if (!headline || !href) return null;

    const description = stripHtml(item?.description || item?.content || '');
    const categories = Array.isArray(item?.categories)
      ? item.categories.map(stripHtml).filter(Boolean)
      : [];

    return {
      id: `${source}:${String(item?.guid || href)}`,
      headline,
      description,
      href,
      image: itemImage(item),
      byline: stripHtml(item?.author || ''),
      premium: false,
      type: 'article',
      league: leagueLabel,
      published: publishedTime(item),
      relatedTeams: [],
      source,
      externalCategories: categories
    };
  }

  function rssJsonUrl(feedUrl) {
    return `${RSS_JSON}${encodeURIComponent(feedUrl)}`;
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.status && payload.status !== 'ok') {
      throw new Error(payload?.message || 'RSS conversion failed.');
    }
    return payload;
  }

  async function fetchProvider(source, provider, config, force = false) {
    const feedUrl = provider?.feeds?.[config.league];
    if (!feedUrl) return [];

    const cacheKey = `${source}:${feedUrl}`;
    const cached = cache.get(cacheKey);
    if (!force && cached && Date.now() - cached.loadedAt < STALE_MS) return cached.stories;

    const payload = await fetchJson(rssJsonUrl(feedUrl));
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const stories = items
      .map(item => normalizeItem(item, source, config.label))
      .filter(Boolean);

    cache.set(cacheKey, { loadedAt: Date.now(), stories });
    return stories;
  }

  async function fetchLeague(config, force = false) {
    if (!config?.league) return [];
    const jobs = Object.entries(PROVIDERS)
      .filter(([, provider]) => provider.feeds[config.league])
      .map(async ([source, provider]) => fetchProvider(source, provider, config, force));

    if (!jobs.length) return [];
    const results = await Promise.allSettled(jobs);
    const fulfilled = results.filter(result => result.status === 'fulfilled');
    if (!fulfilled.length) throw new Error('Secondary news feeds did not respond.');
    return fulfilled.flatMap(result => result.value || []);
  }

  window.ScoreboardNewsSources = Object.freeze({
    providers: PROVIDERS,
    fetchLeague,
    rssJsonUrl
  });
})();
