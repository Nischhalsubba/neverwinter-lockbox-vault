import data from './data/lockboxes.json';
import { filterLockboxes } from './catalog.js';
import { MEDIA_SOURCES, resolveRewardMedia } from './media.js';

(() => {
  'use strict';

  const lockboxes = Array.isArray(data) ? data : [];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {
    searchForm: $('#search-form'),
    search: $('#search-input'),
    clearSearch: $('#clear-search'),
    year: $('#year-filter'),
    sort: $('#sort-filter'),
    results: $('#results'),
    resultCount: $('#result-count'),
    reset: $('#reset-filters'),
    emptyReset: $('#empty-reset'),
    loading: $('#loading-state'),
    empty: $('#empty-state'),
    chips: $$('.filter-chip'),
    gridView: $('#grid-view'),
    listView: $('#list-view'),
    dialog: $('#detail-dialog'),
    dialogClose: $('#dialog-close'),
    dialogContent: $('#dialog-content'),
    toast: $('#toast'),
  };

  const state = {
    query: '',
    category: 'all',
    year: 'all',
    sort: 'newest',
    view: localStorage.getItem('lockbox-view') || 'grid',
  };

  const icon = (type) => {
    const icons = {
      companion: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M6.5 20c.5-5 2.3-7 5.5-7s5 2 5.5 7M5 10c-1.5 1-2 3-1 5M19 10c1.5 1 2 3 1 5"/></svg>',
      artifact: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 3 6 6 .8-4.5 4.3 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L3 9.8 9 9z"/></svg>',
      mount: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18c1-5 3-8 7-9l2-4 2 3 4 1-1 4c-1 1-2 1-3 1l-2 5M7 14l2 5M16 14l2 5"/></svg>',
      race: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3"/><path d="M5 21c.7-6 3-9 7-9s6.3 3 7 9M4 7l3-2M20 7l-3-2"/></svg>',
      arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg>',
      copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5H5v11h3"/></svg>',
      search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    };
    return icons[type] || '';
  };

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const filteredEntries = () => filterLockboxes(lockboxes, state);

  const firstAvailableRewards = (entry) => {
    const rows = [
      ['companion', entry.rewards.companions[0]],
      ['artifact', entry.rewards.artifacts[0]],
      ['mount', entry.rewards.mounts[0]],
      ['race', entry.rewards.races[0]],
    ].filter(([, value]) => value);
    return rows.slice(0, 3);
  };

  const rewardMediaMarkup = (type, item, compact = false) => {
    const media = resolveRewardMedia(type, item);
    if (!media) return `<span class="reward-media reward-media-fallback-only">${icon(type)}</span>`;

    return `
      <span class="reward-media${compact ? ' reward-media-compact' : ''}" title="Thumbnail from ${escapeHtml(media.provider)}">
        <img src="${escapeHtml(media.url)}" alt="" loading="lazy" width="64" height="64" data-media-image>
        <span class="reward-fallback">${icon(type)}</span>
      </span>
    `;
  };

  const artworkStatusLabel = (entry) => entry.imageDiscovery
    ? 'Official source found'
    : 'Placeholder cover';

  const renderCard = (entry) => {
    const rewardRows = firstAvailableRewards(entry).map(([type, value]) => `
      <div class="reward-row">
        ${rewardMediaMarkup(type, value, true)}
        <span><strong class="sr-only">${escapeHtml(type)}:</strong>${escapeHtml(value)}</span>
      </div>
    `).join('');

    return `
      <article class="lockbox-card" data-slug="${escapeHtml(entry.slug)}">
        <div class="card-media">
          <img src="${escapeHtml(entry.image)}" alt="Generated placeholder cover for ${escapeHtml(entry.name)}" loading="lazy" width="960" height="600">
          <span class="image-status${entry.imageDiscovery ? ' source-found' : ''}">${artworkStatusLabel(entry)}</span>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <time datetime="${entry.releaseDate}">${escapeHtml(entry.releaseLabel)}</time>
            ${entry.hasAccountUnlock ? '<span class="account-pill">Account unlock</span>' : ''}
          </div>
          <h3>${escapeHtml(entry.name)}</h3>
          <div class="reward-preview">${rewardRows || '<p class="reward-empty">No highlighted reward in the source sheet.</p>'}</div>
          <button class="card-action" type="button" data-open="${escapeHtml(entry.slug)}" aria-label="View rewards for ${escapeHtml(entry.name)}">
            View all rewards ${icon('arrow')}
          </button>
        </div>
      </article>
    `;
  };

  const updateUrl = () => {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    state.query ? params.set('q', state.query) : params.delete('q');
    state.category !== 'all' ? params.set('type', state.category) : params.delete('type');
    state.year !== 'all' ? params.set('year', state.year) : params.delete('year');
    state.sort !== 'newest' ? params.set('sort', state.sort) : params.delete('sort');
    history.replaceState(null, '', `${url.pathname}${params.toString() ? `?${params}` : ''}${url.hash}`);
  };

  const updateControls = () => {
    elements.search.value = state.query;
    elements.clearSearch.hidden = !state.query;
    elements.year.value = state.year;
    elements.sort.value = state.sort;
    elements.chips.forEach((chip) => {
      const active = chip.dataset.category === state.category;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    const hasFilters = state.query || state.category !== 'all' || state.year !== 'all' || state.sort !== 'newest';
    elements.reset.hidden = !hasFilters;
  };

  const render = () => {
    const entries = filteredEntries();
    elements.results.innerHTML = entries.map(renderCard).join('');
    elements.results.hidden = entries.length === 0;
    elements.empty.hidden = entries.length !== 0;
    elements.resultCount.textContent = `Showing ${entries.length} ${entries.length === 1 ? 'lockbox' : 'lockboxes'}`;
    updateControls();
    updateUrl();
  };

  const sectionMarkup = (title, type, items) => `
    <section class="reward-section">
      <header>${icon(type)}<h3>${escapeHtml(title)}</h3></header>
      ${items.length ? `<ul class="reward-list">${items.map((item) => {
        const media = resolveRewardMedia(type, item);
        return `
          <li class="reward-item">
            ${rewardMediaMarkup(type, item)}
            <span class="reward-item-copy">
              <span>${escapeHtml(item)}</span>
              ${media ? `<a href="${escapeHtml(media.sourceUrl)}" target="_blank" rel="noreferrer">Image source: ToonForge</a>` : '<small>No verified thumbnail mapped yet</small>'}
            </span>
          </li>
        `;
      }).join('')}</ul>` : '<p class="reward-empty">None listed in the source sheet.</p>'}
    </section>
  `;

  const openDetails = (slug, updateHash = true) => {
    const entry = data.find((item) => item.slug === slug);
    if (!entry) return;
    const officialSource = entry.imageDiscovery;
    elements.dialogContent.innerHTML = `
      <div class="detail-hero">
        <img src="${escapeHtml(entry.image)}" alt="Generated placeholder cover for ${escapeHtml(entry.name)}" width="960" height="600">
        <div class="detail-heading">
          <p class="eyebrow">Released ${escapeHtml(entry.releaseLabel)}</p>
          <h2 id="detail-title">${escapeHtml(entry.name)}</h2>
          <div class="detail-submeta">
            <span>${escapeHtml(entry.platform)}</span>
            ${entry.hasAccountUnlock ? '<span>Includes account unlock</span>' : ''}
            <span>${artworkStatusLabel(entry)}</span>
          </div>
        </div>
      </div>
      <div class="detail-content">
        <p>Rewards below reproduce the linked community sheet. Pack contents and live-game availability can change, so verify important trading or purchase decisions in-game.</p>
        ${officialSource ? `
          <aside class="source-notice">
            <div>
              <strong>Official artwork source located</strong>
              <p>${escapeHtml(officialSource.note)}</p>
            </div>
            <a href="${escapeHtml(officialSource.pageUrl)}" target="_blank" rel="noreferrer">Open official page</a>
          </aside>
        ` : ''}
        <div class="reward-sections">
          ${sectionMarkup('Companions', 'companion', entry.rewards.companions)}
          ${sectionMarkup('Artifacts', 'artifact', entry.rewards.artifacts)}
          ${sectionMarkup('Mounts', 'mount', entry.rewards.mounts)}
          ${sectionMarkup('Race / special pack', 'race', entry.rewards.races)}
        </div>
        <section class="media-provenance" aria-labelledby="media-provenance-title">
          <h3 id="media-provenance-title">Media provenance</h3>
          <p>Main lockbox covers stay as generated placeholders until the actual image file is downloaded and checked. Reward thumbnails are resolved from ToonForge only when an explicit filename mapping exists.</p>
          <div class="source-links">
            <a href="${escapeHtml(MEDIA_SOURCES.official.url)}" target="_blank" rel="noreferrer">Official Neverwinter</a>
            <a href="${escapeHtml(MEDIA_SOURCES.toonforge.url)}" target="_blank" rel="noreferrer">ToonForge</a>
            <a href="${escapeHtml(MEDIA_SOURCES.nwhub.url)}" target="_blank" rel="noreferrer">NW Hub</a>
          </div>
        </section>
        <div class="detail-actions">
          <button class="button button-primary" type="button" data-copy="${escapeHtml(entry.slug)}">${icon('copy')} Copy share link</button>
          ${officialSource ? `<a class="button button-secondary" href="${escapeHtml(officialSource.pageUrl)}" target="_blank" rel="noreferrer">Official source</a>` : ''}
          <a class="button button-secondary" href="https://www.google.com/search?q=${encodeURIComponent(`Neverwinter ${entry.name}`)}" target="_blank" rel="noreferrer">${icon('search')} Search the web</a>
        </div>
      </div>
    `;
    if (!elements.dialog.open) elements.dialog.showModal();
    if (updateHash) history.replaceState(null, '', `${location.pathname}${location.search}#${entry.slug}`);
  };

  const closeDetails = () => {
    if (elements.dialog.open) elements.dialog.close();
    if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);
  };

  const showToast = (message) => {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { elements.toast.hidden = true; }, 2300);
  };

  const copyLink = async (slug) => {
    const url = new URL(window.location.href);
    url.hash = slug;
    try {
      await navigator.clipboard.writeText(url.href);
      showToast('Share link copied');
    } catch {
      showToast('Could not copy automatically');
    }
  };

  const resetFilters = () => {
    state.query = '';
    state.category = 'all';
    state.year = 'all';
    state.sort = 'newest';
    render();
    elements.search.focus();
  };

  const setView = (view) => {
    state.view = view;
    localStorage.setItem('lockbox-view', view);
    elements.results.classList.toggle('list-view', view === 'list');
    elements.gridView.classList.toggle('is-active', view === 'grid');
    elements.listView.classList.toggle('is-active', view === 'list');
    elements.gridView.setAttribute('aria-pressed', String(view === 'grid'));
    elements.listView.setAttribute('aria-pressed', String(view === 'list'));
  };

  const initYears = () => {
    [...new Set(lockboxes.map((entry) => entry.year))].sort((a, b) => b - a).forEach((year) => {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      elements.year.append(option);
    });
  };

  const initStats = () => {
    $('#stat-total').textContent = String(lockboxes.length);
    $('#stat-account').textContent = String(lockboxes.filter((entry) => entry.hasAccountUnlock).length);
    const latest = [...data].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))[0];
    $('#stat-latest').textContent = latest ? latest.releaseLabel.replace(/^\d+\s/, '') : 'Unknown';
  };

  const initStateFromUrl = () => {
    const params = new URLSearchParams(location.search);
    state.query = params.get('q') || '';
    state.category = ['all', 'companion', 'artifact', 'mount', 'race', 'account'].includes(params.get('type')) ? params.get('type') : 'all';
    state.year = params.get('year') || 'all';
    state.sort = ['newest', 'oldest', 'az', 'za'].includes(params.get('sort')) ? params.get('sort') : 'newest';
  };

  elements.searchForm.addEventListener('submit', (event) => event.preventDefault());
  elements.search.addEventListener('input', () => { state.query = elements.search.value; render(); });
  elements.clearSearch.addEventListener('click', () => { state.query = ''; render(); elements.search.focus(); });
  elements.year.addEventListener('change', () => { state.year = elements.year.value; render(); });
  elements.sort.addEventListener('change', () => { state.sort = elements.sort.value; render(); });
  elements.chips.forEach((chip) => chip.addEventListener('click', () => { state.category = chip.dataset.category; render(); }));
  elements.reset.addEventListener('click', resetFilters);
  elements.emptyReset.addEventListener('click', resetFilters);
  elements.gridView.addEventListener('click', () => setView('grid'));
  elements.listView.addEventListener('click', () => setView('list'));
  elements.dialogClose.addEventListener('click', closeDetails);
  elements.dialog.addEventListener('click', (event) => {
    if (event.target === elements.dialog) closeDetails();
  });
  elements.dialog.addEventListener('close', () => {
    if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);
  });
  document.addEventListener('error', (event) => {
    const image = event.target.closest?.('[data-media-image]');
    if (!image) return;
    const wrapper = image.closest('.reward-media');
    wrapper?.classList.add('media-failed');
  }, true);
  document.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open]');
    if (openButton) openDetails(openButton.dataset.open);
    const copyButton = event.target.closest('[data-copy]');
    if (copyButton) copyLink(copyButton.dataset.copy);
  });
  document.addEventListener('keydown', (event) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    if (event.key === '/' && !typing) {
      event.preventDefault();
      elements.search.focus();
    }
    if (event.key === 'Escape' && !elements.dialog.open && state.query) {
      state.query = '';
      render();
    }
  });
  window.addEventListener('hashchange', () => {
    const slug = location.hash.slice(1);
    if (slug) openDetails(slug, false);
    else if (elements.dialog.open) elements.dialog.close();
  });

  initYears();
  initStats();
  initStateFromUrl();
  setView(state.view);
  setTimeout(() => {
    elements.loading.hidden = true;
    render();
    if (location.hash) openDetails(location.hash.slice(1), false);
  }, 280);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
