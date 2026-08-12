import latest from './data/latest-lockboxes.js';
import { filterLockboxes } from './catalog.js';
import { cleanRewardName, resolveCoverMedia, resolveRewardMedia } from './artwork.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const loadBaseEntries = async () => {
  try {
    const dataUrl = new URL('./data/lockboxes.json', import.meta.url);
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    console.error('Could not load the lockbox catalog.', error);
    return [];
  }
};

const base = await loadBaseEntries();
const entries = [...base, ...latest];

const rewardGroups = [
  ['companion', 'companions'],
  ['mount', 'mounts'],
  ['artifact', 'artifacts'],
  ['race', 'races'],
];

const typeLabels = {
  companion: 'Companion',
  mount: 'Mount',
  artifact: 'Artifact',
  race: 'Special',
};

const iconPaths = {
  companion: '<circle cx="9" cy="8" r="3"/><circle cx="16" cy="8.5" r="2.4"/><path d="M5 20c.5-4.4 3-6.8 7-6.8s6.5 2.4 7 6.8"/>',
  mount: '<path d="M6 19v-5.5l2.2-4.1 3.2-2.3 4.4.8 2.2 3.2-1.2 3.1-3.2.8-1.8 4M8 9.5 6.2 7.7M15.6 8 17 5.5M9.2 19v-3.8M15.4 19v-4"/>',
  artifact: '<path d="m12 3 6.5 6.2L12 21 5.5 9.2 12 3Zm-6.5 6.2 6.5 2.7 6.5-2.7M12 3v18"/>',
  race: '<circle cx="12" cy="7.5" r="3.2"/><path d="M5.5 21c.6-5.2 2.8-8 6.5-8s5.9 2.8 6.5 8M5.8 10 3 7.5m15.2 2.5L21 7.5"/>',
};

const initials = (value = '') => cleanRewardName(value)
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word[0])
  .join('')
  .toUpperCase();

const allRewards = (entry) => rewardGroups.flatMap(([type, plural]) =>
  (entry.rewards?.[plural] || []).map((name) => ({ type, name })),
);

const entryTypes = (entry) => rewardGroups
  .filter(([, plural]) => (entry.rewards?.[plural] || []).length)
  .map(([type]) => type);

const rewardFallback = (type, name, compact = false) => `
  <span class="reward-fallback${compact ? ' compact' : ''}" aria-hidden="true">
    <svg viewBox="0 0 24 24">${iconPaths[type] || iconPaths.artifact}</svg>
    <small>${escapeHtml(initials(name))}</small>
  </span>`;

const rewardIcon = (type, name, compact = false) => {
  const media = resolveRewardMedia(type, name);
  return `
    <span class="reward-icon${compact ? ' compact' : ''}${media?.url ? ' has-media' : ''}">
      ${rewardFallback(type, name, compact)}
      ${media?.url ? `<img src="${escapeHtml(media.url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-reward-image>` : ''}
    </span>`;
};

const vaultFallback = (entry, detail = false) => `
  <span class="vault-fallback${detail ? ' detail' : ''}" aria-hidden="true">
    <svg viewBox="0 0 48 48"><path d="M9 20h30v20H9zM12 20v-3c0-8 5-13 12-13s12 5 12 13v3M24 20v20M9 29h30"/><path d="M20 27h8v8h-8z"/></svg>
    <strong>${escapeHtml(initials(entry.name))}</strong>
  </span>`;

const cover = (entry, detail = false) => {
  const media = resolveCoverMedia(entry);
  return `
    <span class="pack-icon${detail ? ' detail' : ''}${media?.url ? ' has-media' : ''}">
      ${vaultFallback(entry, detail)}
      ${media?.url ? `<img src="${escapeHtml(media.url)}" alt="${escapeHtml(entry.name)}" loading="lazy" decoding="async" data-cover-image>` : ''}
    </span>`;
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
};

const card = (entry) => {
  const rewards = allRewards(entry);
  const previews = rewards.slice(0, 5)
    .map(({ type, name }) => `<span title="${escapeHtml(cleanRewardName(name))}">${rewardIcon(type, name, true)}</span>`)
    .join('');
  const types = entryTypes(entry)
    .map((type) => `<span class="type-chip">${typeLabels[type]}</span>`)
    .join('');

  return `
    <button class="pack-card" type="button" data-open="${escapeHtml(entry.slug)}" aria-label="Open ${escapeHtml(entry.name)} details">
      <span class="pack-card-art">${cover(entry)}</span>
      <span class="pack-card-body">
        <span class="pack-card-meta">
          <time datetime="${escapeHtml(entry.releaseDate)}">${escapeHtml(entry.releaseLabel)}</time>
          ${entry.hasAccountUnlock ? '<span class="account-dot">Account unlock</span>' : ''}
        </span>
        <strong class="pack-card-title">${escapeHtml(entry.name)}</strong>
        <span class="pack-card-types">${types || '<span class="type-chip muted">Reward pack</span>'}</span>
        <span class="pack-card-footer">
          <span class="reward-preview" aria-hidden="true">${previews}</span>
          <span class="reward-count">${rewards.length} reward${rewards.length === 1 ? '' : 's'} <span aria-hidden="true">→</span></span>
        </span>
      </span>
    </button>`;
};

const syncUrl = () => {
  try {
    const url = new URL(location.href);
    state.query ? url.searchParams.set('q', state.query) : url.searchParams.delete('q');
    state.category !== 'all' ? url.searchParams.set('type', state.category) : url.searchParams.delete('type');
    state.year !== 'all' ? url.searchParams.set('year', state.year) : url.searchParams.delete('year');
    state.sort !== 'newest' ? url.searchParams.set('sort', state.sort) : url.searchParams.delete('sort');
    const query = url.searchParams.toString();
    history.replaceState(null, '', `${url.pathname}${query ? `?${query}` : ''}${url.hash}`);
  } catch {
    // URL state is optional.
  }
};

const render = () => {
  const list = filterLockboxes(entries, state);
  el.results.innerHTML = list.map(card).join('');
  el.results.hidden = !list.length;
  el.empty.hidden = Boolean(list.length);
  el.count.textContent = `Showing ${list.length} of ${entries.length} lockboxes`;
  el.search.value = state.query;
  el.clear.hidden = !state.query;
  el.year.value = state.year;
  el.sort.value = state.sort;

  for (const button of el.categories) {
    const active = button.dataset.category === state.category;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  el.reset.hidden = !(state.query || state.category !== 'all' || state.year !== 'all' || state.sort !== 'newest');
  syncUrl();
};

const detailSection = (title, type, items) => {
  if (!items?.length) return '';
  return `
    <section class="detail-section">
      <header><h3>${escapeHtml(title)}</h3><span>${items.length}</span></header>
      <div class="reward-grid">
        ${items.map((name) => `
          <article class="reward-card">
            ${rewardIcon(type, name)}
            <span>
              <strong>${escapeHtml(cleanRewardName(name))}</strong>
              <small>${escapeHtml(typeLabels[type] || 'Reward')}</small>
            </span>
          </article>`).join('')}
      </div>
    </section>`;
};

const openDetails = (slug, setHash = true) => {
  const entry = entries.find((item) => item.slug === slug);
  if (!entry) return;
  const rewards = allRewards(entry);

  el.content.innerHTML = `
    <header class="detail-header">
      ${cover(entry, true)}
      <div>
        <p class="detail-kicker">${escapeHtml(entry.releaseLabel)} · ${escapeHtml(entry.platform)}</p>
        <h2 id="detail-title">${escapeHtml(entry.name)}</h2>
        <p>${rewards.length} highlighted reward${rewards.length === 1 ? '' : 's'}${entry.hasAccountUnlock ? ' · includes account unlocks' : ''}</p>
      </div>
    </header>
    <div class="detail-content">
      ${detailSection('Companions', 'companion', entry.rewards?.companions || [])}
      ${detailSection('Mounts', 'mount', entry.rewards?.mounts || [])}
      ${detailSection('Artifacts & packs', 'artifact', entry.rewards?.artifacts || [])}
      ${detailSection('Special rewards', 'race', entry.rewards?.races || [])}
      <div class="detail-actions">
        <button class="button primary" type="button" data-copy="${escapeHtml(entry.slug)}">Copy permalink</button>
      </div>
    </div>`;

  if (!el.dialog.open) el.dialog.showModal();
  if (setHash) history.replaceState(null, '', `${location.pathname}${location.search}#${entry.slug}`);
};

const closeDetails = () => {
  if (el.dialog.open) el.dialog.close();
};

const resetFilters = () => {
  Object.assign(state, { query: '', category: 'all', year: 'all', sort: 'newest' });
  render();
  el.search.focus();
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

const updateStats = () => {
  $('#stat-total').textContent = String(entries.length);
  $('#count-all').textContent = String(entries.length);
  $('#count-companion').textContent = String(entries.filter((entry) => (entry.rewards?.companions || []).length).length);
  $('#count-mount').textContent = String(entries.filter((entry) => (entry.rewards?.mounts || []).length).length);
  $('#count-artifact').textContent = String(entries.filter((entry) => (entry.rewards?.artifacts || []).length).length);
  $('#count-race').textContent = String(entries.filter((entry) => (entry.rewards?.races || []).length).length);
  $('#count-account').textContent = String(entries.filter((entry) => entry.hasAccountUnlock).length);
};

const showToast = (message) => {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { el.toast.hidden = true; }, 1800);
};

const bindEvents = () => {
  el.form.addEventListener('submit', (event) => event.preventDefault());
  el.search.addEventListener('input', () => { state.query = el.search.value; render(); });
  el.clear.addEventListener('click', () => { state.query = ''; render(); el.search.focus(); });
  el.year.addEventListener('change', () => { state.year = el.year.value; render(); });
  el.sort.addEventListener('change', () => { state.sort = el.sort.value; render(); });
  el.categories.forEach((button) => button.addEventListener('click', () => {
    state.category = button.dataset.category;
    render();
  }));
  el.reset.addEventListener('click', resetFilters);
  el.emptyReset.addEventListener('click', resetFilters);
  el.close.addEventListener('click', closeDetails);

  el.dialog.addEventListener('click', (event) => {
    if (event.target === el.dialog) closeDetails();
  });
  el.dialog.addEventListener('close', () => {
    if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);
  });

  document.addEventListener('click', async (event) => {
    const openButton = event.target.closest('[data-open]');
    if (openButton) {
      openDetails(openButton.dataset.open);
      return;
    }

    const copyButton = event.target.closest('[data-copy]');
    if (!copyButton) return;
    const url = new URL(location.href);
    url.hash = copyButton.dataset.copy;
    try {
      await navigator.clipboard.writeText(url.href);
      showToast('Permalink copied');
    } catch {
      showToast('Could not copy permalink');
    }
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
    if (event.key === '/' && !typing && !el.dialog.open) {
      event.preventDefault();
      el.search.focus();
    }
  });

  document.addEventListener('error', (event) => {
    const image = event.target instanceof HTMLImageElement ? event.target : null;
    if (!image) return;
    image.hidden = true;
    image.closest('.pack-icon, .reward-icon')?.classList.add('media-failed');
  }, true);

  window.addEventListener('hashchange', () => {
    if (location.hash) openDetails(location.hash.slice(1), false);
    else if (el.dialog.open) el.dialog.close();
  });
};

populateFilters();
updateStats();
bindEvents();
render();

if (!base.length) {
  el.count.textContent = `Showing ${entries.length} lockbox${entries.length === 1 ? '' : 'es'} · base catalog unavailable`;
}

if (location.hash) openDetails(location.hash.slice(1), false);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
}
