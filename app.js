import data from './data/lockboxes.json';
import { filterLockboxes } from './catalog.js';
import { resolveRewardMedia, MEDIA_SOURCES } from './media.js';

const lockboxes = Array.isArray(data) ? data : [];
const WIKI_API = 'https://neverwinter.fandom.com/api.php';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = '') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

const safeStorage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

const cleanReward = (value = '') => {
  const match = String(value).match(/^\[(.+)]\s*-\s*Account unlock$/i);
  return (match ? match[1] : String(value))
    .replace(/\s+\((?:Epic|Rare)\)$/i, '')
    .replace(/\s+Mount$/i, '')
    .replace(/[’]/g, "'")
    .trim();
};

const mediaCache = new Map();
const coverCache = new Map();
const mediaKey = (type, name) => `${type}:${cleanReward(name).toLowerCase()}`;
const isHttps = (value) => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
const resolveMedia = (type, name) => resolveRewardMedia(type, name) || mediaCache.get(mediaKey(type, name)) || null;
const allRewards = (entry) => [
  ...entry.rewards.companions.map((name) => ({ type: 'companion', name })),
  ...entry.rewards.mounts.map((name) => ({ type: 'mount', name })),
  ...entry.rewards.artifacts.map((name) => ({ type: 'artifact', name })),
  ...entry.rewards.races.map((name) => ({ type: 'race', name })),
];

const els = {
  form: $('#search-form'), search: $('#search-input'), clear: $('#clear-search'),
  year: $('#year-filter'), sort: $('#sort-filter'), results: $('#results'),
  count: $('#result-count'), reset: $('#reset-filters'), emptyReset: $('#empty-reset'),
  empty: $('#empty-state'), categories: $$('.category-button'), grid: $('#grid-view'), list: $('#list-view'),
  dialog: $('#detail-dialog'), dialogClose: $('#dialog-close'), dialogContent: $('#dialog-content'), toast: $('#toast'),
};

const validYears = new Set(lockboxes.map((entry) => String(entry.year)));
const initialView = safeStorage.get('lockbox-view');
const state = { query: '', category: 'all', year: 'all', sort: 'newest', view: initialView === 'list' ? 'list' : 'grid' };

const initials = (name) => cleanReward(name).split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join('').toUpperCase();
const rewardCount = (entry) => allRewards(entry).length;

const rewardThumb = (type, name, compact = false) => {
  const media = resolveMedia(type, name);
  if (!media) return `<span class="reward-monogram${compact ? ' compact' : ''}" aria-hidden="true">${esc(initials(name) || type[0].toUpperCase())}</span>`;
  return `<span class="reward-thumb${compact ? ' compact' : ''}" title="Image from ${esc(media.provider || 'community source')}">
    <img src="${esc(media.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-media-image>
  </span>`;
};

const coverMarkup = (entry) => {
  const cover = coverCache.get(entry.slug);
  if (!cover) return '';
  return `<div class="card-visual"><img src="${esc(cover.url)}" alt="${esc(entry.name)} artwork" loading="lazy" referrerpolicy="no-referrer" data-cover-image><span class="media-source-badge">${esc(cover.provider)}</span></div>`;
};

const card = (entry) => {
  const previews = allRewards(entry).slice(0,4).map(({type,name}) => `<div class="reward-strip-item">${rewardThumb(type,name,true)}<span>${esc(cleanReward(name))}</span></div>`).join('');
  return `<article class="lockbox-card${coverCache.has(entry.slug) ? ' has-cover' : ' no-cover'}">
    ${coverMarkup(entry)}
    <div class="card-content">
      <div class="card-topline"><time datetime="${entry.releaseDate}">${esc(entry.releaseLabel)}</time>${entry.hasAccountUnlock ? '<span class="unlock-badge">Account unlock</span>' : ''}</div>
      <h3>${esc(entry.name)}</h3>
      <p class="card-summary">${rewardCount(entry)} highlighted ${rewardCount(entry) === 1 ? 'reward' : 'rewards'}</p>
      <div class="reward-strip">${previews || '<p class="no-rewards">No headline rewards listed</p>'}</div>
      <button class="card-open" type="button" data-open="${esc(entry.slug)}">View rewards <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg></button>
    </div>
  </article>`;
};

const syncControls = () => {
  els.search.value = state.query;
  els.clear.hidden = !state.query;
  els.year.value = state.year;
  els.sort.value = state.sort;
  els.categories.forEach((button) => {
    const active = button.dataset.category === state.category;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  els.reset.hidden = !(state.query || state.category !== 'all' || state.year !== 'all' || state.sort !== 'newest');
};

const updateUrl = () => {
  const url = new URL(location.href);
  const params = url.searchParams;
  state.query ? params.set('q', state.query) : params.delete('q');
  state.category !== 'all' ? params.set('type', state.category) : params.delete('type');
  state.year !== 'all' ? params.set('year', state.year) : params.delete('year');
  state.sort !== 'newest' ? params.set('sort', state.sort) : params.delete('sort');
  history.replaceState(null, '', `${url.pathname}${params.toString() ? `?${params}` : ''}${url.hash}`);
};

const render = () => {
  const entries = filterLockboxes(lockboxes, state);
  els.results.classList.toggle('is-list', state.view === 'list');
  els.results.innerHTML = entries.map(card).join('');
  els.results.hidden = entries.length === 0;
  els.empty.hidden = entries.length !== 0;
  els.count.textContent = `Showing ${entries.length} ${entries.length === 1 ? 'lockbox' : 'lockboxes'}`;
  syncControls();
  updateUrl();
};

const rewardSection = (title, type, items) => items.length ? `<section class="detail-reward-section">
  <div class="detail-section-heading"><div><p>${esc(type)}</p><h3>${esc(title)}</h3></div><span>${items.length}</span></div>
  <div class="detail-reward-grid">${items.map((name) => {
    const media = resolveMedia(type,name);
    return `<article class="detail-reward-card">${rewardThumb(type,name)}<div><strong>${esc(cleanReward(name))}</strong><small>${media ? `Image: ${esc(media.provider || 'community source')}` : 'Verified artwork unavailable'}</small>${media?.sourceUrl ? `<a href="${esc(media.sourceUrl)}" target="_blank" rel="noreferrer">Open source ↗</a>` : ''}</div></article>`;
  }).join('')}</div>
</section>` : '';

const openDetails = (slug, updateHash = true) => {
  const entry = lockboxes.find((item) => item.slug === slug);
  if (!entry) { if (location.hash) history.replaceState(null,'',`${location.pathname}${location.search}`); return; }
  const cover = coverCache.get(entry.slug);
  els.dialogContent.innerHTML = `<header class="detail-hero${cover ? ' has-cover' : ' no-cover'}">
    ${cover ? `<div class="detail-cover"><img src="${esc(cover.url)}" alt="${esc(entry.name)} artwork" referrerpolicy="no-referrer"></div>` : ''}
    <div class="detail-intro"><p class="eyebrow">Released ${esc(entry.releaseLabel)}</p><h2 id="detail-title">${esc(entry.name)}</h2><p>${rewardCount(entry)} highlighted rewards across the archive.</p><div class="detail-badges"><span>${esc(entry.platform)}</span>${entry.hasAccountUnlock ? '<span>Account-wide unlocks</span>' : ''}<span>${entry.year}</span></div></div>
  </header>
  <div class="detail-body">
    ${rewardSection('Companions','companion',entry.rewards.companions)}
    ${rewardSection('Mounts','mount',entry.rewards.mounts)}
    ${rewardSection('Artifacts','artifact',entry.rewards.artifacts)}
    ${rewardSection('Race and special packs','race',entry.rewards.races)}
    <section class="detail-sources"><div><p class="eyebrow">Media provenance</p><h3>Community sources</h3><p>Artwork is loaded from NW Hub, ToonForge, and Neverwinter Wiki. Missing images remain absent rather than being fabricated.</p></div><div class="source-links"><a href="${esc(MEDIA_SOURCES.nwhub.url)}" target="_blank" rel="noreferrer">NW Hub</a><a href="${esc(MEDIA_SOURCES.toonforge.url)}" target="_blank" rel="noreferrer">ToonForge</a><a href="${esc(MEDIA_SOURCES.wiki.url)}" target="_blank" rel="noreferrer">Neverwinter Wiki</a></div></section>
    <div class="detail-actions"><button class="button button-primary" type="button" data-copy="${esc(entry.slug)}">Copy share link</button><a class="button button-ghost" href="https://www.google.com/search?q=${encodeURIComponent(`Neverwinter ${entry.name}`)}" target="_blank" rel="noreferrer">Search the web</a></div>
  </div>`;
  if (!els.dialog.open) els.dialog.showModal();
  if (updateHash) history.replaceState(null,'',`${location.pathname}${location.search}#${entry.slug}`);
};

const closeDetails = () => {
  if (els.dialog.open) els.dialog.close();
  if (location.hash) history.replaceState(null,'',`${location.pathname}${location.search}`);
};

const reset = () => { Object.assign(state,{query:'',category:'all',year:'all',sort:'newest'}); render(); };
const setView = (view) => {
  state.view = view === 'list' ? 'list' : 'grid';
  safeStorage.set('lockbox-view',state.view);
  els.grid.classList.toggle('is-active',state.view === 'grid');
  els.list.classList.toggle('is-active',state.view === 'list');
  els.grid.setAttribute('aria-pressed',String(state.view === 'grid'));
  els.list.setAttribute('aria-pressed',String(state.view === 'list'));
  render();
};

const showToast = (message) => { els.toast.textContent = message; els.toast.hidden = false; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => els.toast.hidden = true,2200); };
const copyLink = async (slug) => { const url = new URL(location.href); url.hash = slug; try { await navigator.clipboard.writeText(url.href); showToast('Share link copied'); } catch { showToast('Could not copy automatically'); } };

const init = () => {
  [...validYears].sort((a,b) => Number(b)-Number(a)).forEach((year) => { const option = document.createElement('option'); option.value = year; option.textContent = year; els.year.append(option); });
  const params = new URLSearchParams(location.search);
  state.query = params.get('q') || '';
  state.category = ['all','companion','mount','artifact','race','account'].includes(params.get('type')) ? params.get('type') : 'all';
  state.year = validYears.has(params.get('year')) ? params.get('year') : 'all';
  state.sort = ['newest','oldest','az','za'].includes(params.get('sort')) ? params.get('sort') : 'newest';

  const uniqueRewards = new Set(lockboxes.flatMap(allRewards).map(({type,name}) => mediaKey(type,name)));
  $('#stat-total').textContent = lockboxes.length;
  $('#stat-years').textContent = validYears.size;
  $('#stat-rewards').textContent = uniqueRewards.size;
  $('#stat-account').textContent = lockboxes.filter((entry) => entry.hasAccountUnlock).length;
  $('#count-all').textContent = lockboxes.length;
  $('#count-companion').textContent = lockboxes.filter((entry) => entry.rewards.companions.length).length;
  $('#count-mount').textContent = lockboxes.filter((entry) => entry.rewards.mounts.length).length;
  $('#count-artifact').textContent = lockboxes.filter((entry) => entry.rewards.artifacts.length).length;
  $('#count-race').textContent = lockboxes.filter((entry) => entry.rewards.races.length).length;
  $('#count-account').textContent = lockboxes.filter((entry) => entry.hasAccountUnlock).length;
  setView(state.view);
  render();
  if (location.hash) openDetails(location.hash.slice(1),false);
};

const batchWikiLookup = async (requests, onResult, size = 35) => {
  if (typeof fetch !== 'function') return 0;
  let updated = 0;
  for (let i=0; i<requests.length; i+=size) {
    const batch = requests.slice(i,i+size);
    const byTitle = new Map(batch.map((item) => [item.title.toLowerCase(),item]));
    const params = new URLSearchParams({action:'query',format:'json',formatversion:'2',redirects:'1',prop:'pageimages|info',piprop:'thumbnail|original',pithumbsize:'720',inprop:'url',origin:'*',titles:batch.map((item) => item.title).join('|')});
    try {
      const response = await fetch(`${WIKI_API}?${params}`,{headers:{accept:'application/json'}});
      if (!response.ok) continue;
      const payload = await response.json();
      for (const page of payload?.query?.pages || []) {
        const request = byTitle.get(String(page.title || '').toLowerCase());
        const url = page.thumbnail?.source || page.original?.source;
        if (!request || !isHttps(url)) continue;
        onResult(request,{url,sourceUrl:page.fullurl || null,provider:'Neverwinter Wiki / Fandom'});
        updated += 1;
      }
    } catch {}
  }
  return updated;
};

const hydrateMedia = async () => {
  const coverRequests = lockboxes.map((entry) => ({title:entry.name,entry}));
  const rewardRequests = [];
  for (const entry of lockboxes) for (const reward of allRewards(entry)) if (!resolveMedia(reward.type,reward.name)) rewardRequests.push({title:cleanReward(reward.name),type:reward.type,name:reward.name});
  const uniqueRewards = [...new Map(rewardRequests.map((item) => [mediaKey(item.type,item.name),item])).values()];
  const results = await Promise.allSettled([
    batchWikiLookup(coverRequests,(request,media) => coverCache.set(request.entry.slug,media)),
    batchWikiLookup(uniqueRewards,(request,media) => mediaCache.set(mediaKey(request.type,request.name),media)),
  ]);
  if (results.some((result) => result.status === 'fulfilled' && result.value > 0)) {
    render();
    const slug = location.hash.slice(1);
    if (slug && els.dialog.open) openDetails(slug,false);
  }
};

els.form.addEventListener('submit',(event) => event.preventDefault());
els.search.addEventListener('input',() => { state.query = els.search.value; render(); });
els.clear.addEventListener('click',() => { state.query=''; render(); els.search.focus(); });
els.year.addEventListener('change',() => { state.year=els.year.value; render(); });
els.sort.addEventListener('change',() => { state.sort=els.sort.value; render(); });
els.categories.forEach((button) => button.addEventListener('click',() => { state.category=button.dataset.category; render(); }));
els.reset.addEventListener('click',reset);
els.emptyReset.addEventListener('click',reset);
els.grid.addEventListener('click',() => setView('grid'));
els.list.addEventListener('click',() => setView('list'));
els.dialogClose.addEventListener('click',closeDetails);
els.dialog.addEventListener('click',(event) => { if (event.target === els.dialog) closeDetails(); });
els.dialog.addEventListener('close',() => { if (location.hash) history.replaceState(null,'',`${location.pathname}${location.search}`); });

document.addEventListener('click',(event) => {
  const open = event.target.closest('[data-open]'); if (open) openDetails(open.dataset.open);
  const copy = event.target.closest('[data-copy]'); if (copy) copyLink(copy.dataset.copy);
});

document.addEventListener('error',(event) => {
  const image = event.target instanceof HTMLImageElement ? event.target : null;
  if (!image) return;
  image.hidden = true;
  image.closest('.reward-thumb,.card-visual,.detail-cover')?.classList.add('media-failed');
},true);

window.addEventListener('hashchange',() => { const slug=location.hash.slice(1); if (slug) openDetails(slug,false); else if (els.dialog.open) els.dialog.close(); });
document.addEventListener('keydown',(event) => { const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || ''); if (event.key==='/' && !typing) { event.preventDefault(); els.search.focus(); } if (event.key==='Escape' && !els.dialog.open && state.query) { state.query=''; render(); } });

init();
hydrateMedia();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load',() => navigator.serviceWorker.register('/sw.js').catch(() => {}));
