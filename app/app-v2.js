import latest from './data/latest-lockboxes.js';
import { filterLockboxes } from './catalog.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const clean = (value = '') => {
  const text = String(value);
  const accountMatch = text.match(/^\[(.+)]\s*-\s*Account unlock$/i);
  return (accountMatch?.[1] || text)
    .replace(/^\s*(?:companion|artifact|mount|race)\s*:\s*/i, '')
    .replace(/\s+\((?:Epic|Rare)\)$/i, '')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const safeStorage = {
  get(key) {
    try { return window.localStorage?.getItem(key) ?? null; } catch { return null; }
  },
  set(key, value) {
    try { window.localStorage?.setItem(key, value); } catch { /* optional persistence */ }
  },
};

const loadBaseEntries = async () => {
  try {
    const dataUrl = new URL('./data/lockboxes.json', import.meta.url);
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    console.error('Could not load the base lockbox catalog.', error);
    return [];
  }
};

const base = await loadBaseEntries();
const entries = [...base, ...latest];

let resolveRewardMedia = () => null;
let resolveCoverMedia = () => null;
let hydrateCoverMedia = async () => 0;
let mediaSources = {
  nwhub: { url: 'https://nw-hub.com/packs' },
  wiki: { url: 'https://neverwinter.fandom.com/wiki/Lockbox' },
};

const allRewards = (entry) => [
  ...entry.rewards.companions.map((name) => ({ type: 'companion', name })),
  ...entry.rewards.mounts.map((name) => ({ type: 'mount', name })),
  ...entry.rewards.artifacts.map((name) => ({ type: 'artifact', name })),
  ...entry.rewards.races.map((name) => ({ type: 'race', name })),
];

const initials = (value) => clean(value)
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word[0])
  .join('')
  .toUpperCase();

const iconPaths = {
  companion: '<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 0a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 15 11ZM5 20c.5-4.4 2.8-6.8 7-6.8s6.5 2.4 7 6.8"/>',
  mount: '<path d="M6 19v-5.5l2.2-4.1 3.2-2.3 4.4.8 2.2 3.2-1.2 3.1-3.2.8-1.8 4M8 9.5 6.2 7.7M15.6 8 17 5.5M9.2 19v-3.8M15.4 19v-4"/>',
  artifact: '<path d="m12 3 6.5 6.2L12 21 5.5 9.2 12 3Zm-6.5 6.2 6.5 2.7 6.5-2.7M12 3v18"/>',
  race: '<circle cx="12" cy="7.5" r="3.2"/><path d="M5.5 21c.6-5.2 2.8-8 6.5-8s5.9 2.8 6.5 8M5.8 10 3 7.5m15.2 2.5L21 7.5"/>',
};

const rewardFallback = (type, compact = false) => `
  <span class="reward-monogram${compact ? ' compact' : ''}" aria-hidden="true">
    <svg viewBox="0 0 24 24">${iconPaths[type] || iconPaths.artifact}</svg>
  </span>`;

const rewardIcon = (type, name, compact = false) => {
  const media = resolveRewardMedia(type, name);
  if (!media?.url) return rewardFallback(type, compact);

  return `
    <span class="reward-thumb${compact ? ' compact' : ''}">
      <img src="${esc(media.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-reward-image data-reward-type="${esc(type)}">
    </span>`;
};

const vaultIcon = (entry, detail = false) => `
  <div class="vault-icon vault-icon-${detail ? 'detail' : 'card'}" aria-hidden="true">
    <svg viewBox="0 0 120 100">
      <path d="M20 43h80v42H20zM24 43c3-18 16-28 36-28s33 10 36 28M60 15v70M20 61h80"/>
      <path class="vault-lock" d="M51 54h18v20H51zM56 54v-5c0-6 8-6 8 0v5"/>
      <path class="vault-spark" d="m93 17 2.6 6 6.4 2.5-6.4 2.6-2.6 6-2.5-6-6.5-2.6 6.5-2.5 2.5-6Z"/>
    </svg>
    <span>${esc(initials(entry.name))}</span>
    <small>${entry.year}</small>
  </div>`;

const cover = (entry, detail = false) => {
  const media = resolveCoverMedia(entry);
  return `
    <div class="cover-stage${media ? ' has-media' : ' is-fallback'}">
      ${vaultIcon(entry, detail)}
      ${media?.url ? `<img class="cover-art" src="${esc(media.url)}" alt="${esc(entry.name)} artwork" loading="lazy" referrerpolicy="no-referrer" data-cover-image>` : ''}
      <span class="media-source-badge${media ? '' : ' is-fallback'}">${esc(media?.provider || 'Vault icon')}</span>
    </div>`;
};

const el = {
  form: $('#search-form'),
  search: $('#search-input'),
  clear: $('#clear-search'),
  year: $('#year-filter'),
  sort: $('#sort-filter'),
  results: $('#results'),
  count: $('#result-count'),
  reset: $('#reset-filters'),
  emptyReset: $('#empty-reset'),
  empty: $('#empty-state'),
  categories: $$('.category-button'),
  grid: $('#grid-view'),
  list: $('#list-view'),
  dialog: $('#detail-dialog'),
  close: $('#dialog-close'),
  content: $('#dialog-content'),
  toast: $('#toast'),
};

const years = new Set(entries.map((entry) => String(entry.year)));
const state = {
  query: '',
  category: 'all',
  year: 'all',
  sort: 'newest',
  view: safeStorage.get('lockbox-view') === 'list' ? 'list' : 'grid',
};

const card = (entry) => {
  const rewards = allRewards(entry);
  const rewardRows = rewards.slice(0, 4).map(({ type, name }) => `
    <div class="reward-strip-item">
      ${rewardIcon(type, name, true)}
      <span>${esc(clean(name))}</span>
    </div>`).join('');

  return `
    <article class="lockbox-card">
      <div class="card-visual">${cover(entry)}</div>
      <div class="card-content">
        <div class="card-topline">
          <time datetime="${entry.releaseDate}">${esc(entry.releaseLabel)}</time>
          ${entry.hasAccountUnlock ? '<span class="unlock-badge">Account unlock</span>' : ''}
        </div>
        <h3>${esc(entry.name)}</h3>
        <p class="card-summary">${rewards.length} highlighted ${rewards.length === 1 ? 'reward' : 'rewards'}</p>
        <div class="reward-strip">${rewardRows || '<p class="no-rewards">No headline rewards listed</p>'}</div>
        <button class="card-open" type="button" data-open="${esc(entry.slug)}">
          <span>Explore rewards</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </div>
    </article>`;
};

const syncUrl = () => {
  try {
    const url = new URL(location.href);
    const params = url.searchParams;
    state.query ? params.set('q', state.query) : params.delete('q');
    state.category !== 'all' ? params.set('type', state.category) : params.delete('type');
    state.year !== 'all' ? params.set('year', state.year) : params.delete('year');
    state.sort !== 'newest' ? params.set('sort', state.sort) : params.delete('sort');
    history.replaceState(null, '', `${url.pathname}${params.toString() ? `?${params}` : ''}${url.hash}`);
  } catch {
    // URL persistence is nonessential to the catalog.
  }
};

const render = () => {
  const list = filterLockboxes(entries, state);
  el.results.classList.toggle('is-list', state.view === 'list');
  el.results.innerHTML = list.map(card).join('');
  el.results.hidden = !list.length;
  el.empty.hidden = Boolean(list.length);
  el.count.textContent = `Showing ${list.length} ${list.length === 1 ? 'lockbox' : 'lockboxes'}`;
  el.search.value = state.query;
  el.clear.hidden = !state.query;
  el.year.value = state.year;
  el.sort.value = state.sort;

  el.categories.forEach((button) => {
    const active = button.dataset.category === state.category;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  el.reset.hidden = !(state.query || state.category !== 'all' || state.year !== 'all' || state.sort !== 'newest');
  syncUrl();
};

const section = (title, type, items) => items.length ? `
  <section class="detail-reward-section">
    <div class="detail-section-heading">
      <div><p>${esc(type)}</p><h3>${esc(title)}</h3></div>
      <span>${items.length}</span>
    </div>
    <div class="detail-reward-grid">
      ${items.map((name) => {
        const media = resolveRewardMedia(type, name);
        return `
          <article class="detail-reward-card">
            ${rewardIcon(type, name)}
            <div>
              <strong>${esc(clean(name))}</strong>
              <small>${media ? 'Verified artwork' : 'Local category icon'}</small>
            </div>
          </article>`;
      }).join('')}
    </div>
  </section>` : '';

const openDetails = (slug, setHash = true) => {
  const entry = entries.find((item) => item.slug === slug);
  if (!entry) return;

  const source = entry.sourceUrl || entry.imageDiscovery?.pageUrl || mediaSources.wiki.url;
  el.content.innerHTML = `
    <header class="detail-hero">
      <div class="detail-cover">${cover(entry, true)}</div>
      <div class="detail-intro">
        <p class="eyebrow">Released ${esc(entry.releaseLabel)}</p>
        <h2 id="detail-title">${esc(entry.name)}</h2>
        <p>${allRewards(entry).length} highlighted rewards across the archive.</p>
        <div class="detail-badges">
          <span>${esc(entry.platform)}</span>
          ${entry.hasAccountUnlock ? '<span>Account-wide unlocks</span>' : ''}
          <span>${entry.year}</span>
        </div>
      </div>
    </header>
    <div class="detail-body">
      ${section('Companions', 'companion', entry.rewards.companions)}
      ${section('Mounts', 'mount', entry.rewards.mounts)}
      ${section('Artifacts & special packs', 'artifact', entry.rewards.artifacts)}
      ${section('Race and special packs', 'race', entry.rewards.races)}
      <section class="detail-sources">
        <div>
          <p class="eyebrow">Media provenance</p>
          <h3>Verified art when available, readable icons always.</h3>
          <p>Missing media receives a consistent local vector icon instead of an empty panel.</p>
        </div>
        <div class="source-links">
          <a href="${esc(source)}" target="_blank" rel="noreferrer">Entry source</a>
          <a href="${esc(mediaSources.nwhub.url)}" target="_blank" rel="noreferrer">NW Hub</a>
          <a href="${esc(mediaSources.wiki.url)}" target="_blank" rel="noreferrer">Wiki</a>
        </div>
      </section>
      <div class="detail-actions">
        <button class="button button-primary" type="button" data-copy="${esc(entry.slug)}">Copy share link</button>
        <a class="button button-ghost" href="${esc(source)}" target="_blank" rel="noreferrer">Open source</a>
      </div>
    </div>`;

  if (!el.dialog.open) el.dialog.showModal();
  if (setHash) history.replaceState(null, '', `${location.pathname}${location.search}#${entry.slug}`);
};

const closeDetails = () => {
  if (el.dialog.open) el.dialog.close();
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);
};

const resetFilters = () => {
  Object.assign(state, { query: '', category: 'all', year: 'all', sort: 'newest' });
  render();
};

const setView = (view) => {
  state.view = view === 'list' ? 'list' : 'grid';
  safeStorage.set('lockbox-view', state.view);
  el.grid.classList.toggle('is-active', state.view === 'grid');
  el.list.classList.toggle('is-active', state.view === 'list');
  el.grid.setAttribute('aria-pressed', String(state.view === 'grid'));
  el.list.setAttribute('aria-pressed', String(state.view === 'list'));
  render();
};

const updateStats = () => {
  const uniqueRewards = new Set(entries.flatMap(allRewards).map(({ type, name }) => `${type}:${clean(name).toLowerCase()}`));
  $('#stat-total').textContent = String(entries.length);
  $('#stat-years').textContent = String(years.size);
  $('#stat-rewards').textContent = String(uniqueRewards.size);
  $('#stat-account').textContent = String(entries.filter((entry) => entry.hasAccountUnlock).length);
  $('#count-all').textContent = String(entries.length);
  $('#count-companion').textContent = String(entries.filter((entry) => entry.rewards.companions.length).length);
  $('#count-mount').textContent = String(entries.filter((entry) => entry.rewards.mounts.length).length);
  $('#count-artifact').textContent = String(entries.filter((entry) => entry.rewards.artifacts.length).length);
  $('#count-race').textContent = String(entries.filter((entry) => entry.rewards.races.length).length);
  $('#count-account').textContent = String(entries.filter((entry) => entry.hasAccountUnlock).length);
};

const populateFilters = () => {
  [...years].sort((a, b) => Number(b) - Number(a)).forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    el.year.append(option);
  });

  const params = new URLSearchParams(location.search);
  state.query = params.get('q') || '';
  state.category = ['all', 'companion', 'mount', 'artifact', 'race', 'account'].includes(params.get('type'))
    ? params.get('type')
    : 'all';
  state.year = years.has(params.get('year')) ? params.get('year') : 'all';
  state.sort = ['newest', 'oldest', 'az', 'za'].includes(params.get('sort')) ? params.get('sort') : 'newest';
};

const bindEvents = () => {
  el.form.addEventListener('submit', (event) => event.preventDefault());
  el.search.addEventListener('input', () => { state.query = el.search.value; render(); });
  el.clear.addEventListener('click', () => { state.query = ''; render(); el.search.focus(); });
  el.year.addEventListener('change', () => { state.year = el.year.value; render(); });
  el.sort.addEventListener('change', () => { state.sort = el.sort.value; render(); });
  el.categories.forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.category; render(); }));
  el.reset.addEventListener('click', resetFilters);
  el.emptyReset.addEventListener('click', resetFilters);
  el.grid.addEventListener('click', () => setView('grid'));
  el.list.addEventListener('click', () => setView('list'));
  el.close.addEventListener('click', closeDetails);
  el.dialog.addEventListener('click', (event) => { if (event.target === el.dialog) closeDetails(); });

  document.addEventListener('click', async (event) => {
    const openButton = event.target.closest('[data-open]');
    if (openButton) openDetails(openButton.dataset.open);

    const copyButton = event.target.closest('[data-copy]');
    if (!copyButton) return;

    const url = new URL(location.href);
    url.hash = copyButton.dataset.copy;
    try {
      await navigator.clipboard.writeText(url.href);
      el.toast.textContent = 'Share link copied';
    } catch {
      el.toast.textContent = 'Copy failed';
    }
    el.toast.hidden = false;
    setTimeout(() => { el.toast.hidden = true; }, 2200);
  });

  document.addEventListener('error', (event) => {
    const image = event.target instanceof HTMLImageElement ? event.target : null;
    if (!image) return;
    image.hidden = true;
    image.closest('.cover-stage, .reward-thumb')?.classList.add('media-failed');
  }, true);

  window.addEventListener('hashchange', () => {
    if (location.hash) openDetails(location.hash.slice(1), false);
    else if (el.dialog.open) el.dialog.close();
  });
};

const loadOptionalMedia = async () => {
  try {
    const [mediaModule, coverModule] = await Promise.all([
      import('./media.js'),
      import('./covers.js'),
    ]);

    resolveRewardMedia = mediaModule.resolveRewardMedia || resolveRewardMedia;
    mediaSources = mediaModule.MEDIA_SOURCES || mediaSources;
    resolveCoverMedia = coverModule.resolveCoverMedia || resolveCoverMedia;
    hydrateCoverMedia = coverModule.hydrateCoverMedia || hydrateCoverMedia;

    render();
    if (location.hash && el.dialog.open) openDetails(location.hash.slice(1), false);

    const updated = await hydrateCoverMedia(entries);
    if (updated) {
      render();
      if (location.hash && el.dialog.open) openDetails(location.hash.slice(1), false);
    }
  } catch (error) {
    console.warn('Optional media services are unavailable. Local vector artwork will remain in use.', error);
  }
};

populateFilters();
updateStats();
bindEvents();
setView(state.view);

if (!base.length) {
  el.count.textContent = `Showing ${entries.length} lockbox${entries.length === 1 ? '' : 'es'} · base catalog failed to load`;
}

if (location.hash) openDetails(location.hash.slice(1), false);
void loadOptionalMedia();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
}
