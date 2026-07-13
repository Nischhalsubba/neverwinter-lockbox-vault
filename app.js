import data from './data/lockboxes.json';
import { filterLockboxes } from './catalog.js';
import { MEDIA_SOURCES, resolveRewardMedia } from './media.js';
import { hydrateCoverMedia, resolveCoverMedia } from './covers.js';

const boxes = Array.isArray(data) ? data : [];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v = '') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const getStoredView = () => { try { const v = localStorage.getItem('lockbox-view'); return ['grid','list'].includes(v) ? v : 'grid'; } catch { return 'grid'; } };
const setStoredView = (v) => { try { localStorage.setItem('lockbox-view', v); } catch {} };

const state = { query:'', category:'all', year:'all', sort:'newest', view:getStoredView() };
const el = {
  form: $('#search-form'), search: $('#search-input'), clear: $('#clear-search'), year: $('#year-filter'), sort: $('#sort-filter'),
  results: $('#catalog-results'), count: $('#result-count'), reset: $('#reset-filters'), emptyReset: $('#empty-reset'), loading: $('#loading-state'),
  empty: $('#empty-state'), tabs: $$('.category-tab'), grid: $('#grid-view'), list: $('#list-view'), dialog: $('#detail-dialog'),
  close: $('#dialog-close'), dialogContent: $('#dialog-content'), toast: $('#toast'), mediaStatus: $('#media-status'), sourceGrid: $('#source-grid')
};

const icon = (type) => ({
  companion:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M6.5 20c.5-5 2.3-7 5.5-7s5 2 5.5 7M5 10c-1.5 1-2 3-1 5M19 10c1.5 1 2 3 1 5"/></svg>',
  mount:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18c1-5 3-8 7-9l2-4 2 3 4 1-1 4c-1 1-2 1-3 1l-2 5M7 14l2 5M16 14l2 5"/></svg>',
  artifact:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 3 6 6 .8-4.5 4.3 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L3 9.8 9 9z"/></svg>',
  race:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3"/><path d="M5 21c.7-6 3-9 7-9s6.3 3 7 9"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg>',
  copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5H5v11h3"/></svg>'
}[type] || '');

const rewardsOf = (entry) => [
  ...entry.rewards.companions.map(name => ['companion',name]),
  ...entry.rewards.mounts.map(name => ['mount',name]),
  ...entry.rewards.artifacts.map(name => ['artifact',name]),
  ...entry.rewards.races.map(name => ['race',name])
];
const label = (type) => ({companion:'Companion',mount:'Mount',artifact:'Artifact',race:'Race'}[type] || type);

const rewardThumb = (type, name, large = false) => {
  const media = resolveRewardMedia(type, name);
  if (!media?.url) return `<span class="reward-thumb ${large?'large':''} empty" aria-hidden="true">${icon(type)}</span>`;
  return `<span class="reward-thumb ${large?'large':''}" title="Artwork from ${esc(media.provider)}"><img src="${esc(media.url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-real-media></span>`;
};

const coverMarkup = (entry) => {
  const cover = resolveCoverMedia(entry);
  if (!cover || cover.isPlaceholder || !cover.url) {
    return `<div class="cover-empty"><span>${entry.year}</span><strong>${esc(entry.name.replace(/\s+Lockbox$/i,''))}</strong></div>`;
  }
  return `<img class="cover-image" src="${esc(cover.url)}" alt="${esc(entry.name)} artwork" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-real-media>`;
};

const card = (entry) => {
  const preview = rewardsOf(entry).slice(0,3).map(([type,name]) => `<div class="reward-chip">${rewardThumb(type,name)}<span><small>${label(type)}</small><strong>${esc(name)}</strong></span></div>`).join('');
  const cover = resolveCoverMedia(entry);
  return `<article class="lockbox-card" data-slug="${esc(entry.slug)}">
    <button class="card-cover" type="button" data-open="${esc(entry.slug)}" aria-label="View rewards for ${esc(entry.name)}">
      ${coverMarkup(entry)}<span class="cover-gradient"></span><span class="year-badge">${entry.year}</span>
      ${cover && !cover.isPlaceholder ? `<span class="source-badge">${esc(cover.provider)}</span>` : ''}
    </button>
    <div class="card-body"><div class="card-heading-row"><div><p class="card-date">${esc(entry.releaseLabel)}</p><h3>${esc(entry.name)}</h3></div>${entry.hasAccountUnlock?'<span class="account-pill">Account unlock</span>':''}</div>
      <div class="reward-preview">${preview || '<p class="card-empty-copy">No highlighted reward listed.</p>'}</div>
      <button class="card-action" type="button" data-open="${esc(entry.slug)}">View all rewards ${icon('arrow')}</button>
    </div>
  </article>`;
};

const updateUrl = () => {
  const url = new URL(location.href), p = url.searchParams;
  state.query ? p.set('q',state.query) : p.delete('q'); state.category !== 'all' ? p.set('type',state.category) : p.delete('type');
  state.year !== 'all' ? p.set('year',state.year) : p.delete('year'); state.sort !== 'newest' ? p.set('sort',state.sort) : p.delete('sort');
  history.replaceState(null,'',`${url.pathname}${p.toString()?`?${p}`:''}${url.hash}`);
};
const updateControls = () => {
  el.search.value=state.query; el.clear.hidden=!state.query; el.year.value=state.year; el.sort.value=state.sort;
  el.tabs.forEach(t=>{const a=t.dataset.category===state.category;t.classList.toggle('is-active',a);t.setAttribute('aria-pressed',String(a));});
  el.reset.hidden=!(state.query||state.category!=='all'||state.year!=='all'||state.sort!=='newest');
};
const render = () => {
  const entries=filterLockboxes(boxes,state); el.results.innerHTML=entries.map(card).join(''); el.results.hidden=!entries.length; el.empty.hidden=!!entries.length;
  el.count.textContent=`Showing ${entries.length} ${entries.length===1?'lockbox':'lockboxes'}`; updateControls(); updateUrl();
};

const rewardSection = (title,type,items) => `<section class="reward-section"><header>${icon(type)}<h3>${title}</h3><span>${items.length}</span></header>${items.length?`<ul>${items.map(name=>{const m=resolveRewardMedia(type,name);return `<li>${rewardThumb(type,name,true)}<div><strong>${esc(name)}</strong>${m?`<a href="${esc(m.sourceUrl)}" target="_blank" rel="noreferrer">Artwork: ${esc(m.provider)}</a>`:'<small>Artwork not resolved</small>'}</div></li>`}).join('')}</ul>`:'<p>None listed in the source sheet.</p>'}</section>`;
const openDetails = (slug,updateHash=true) => {
  const entry=boxes.find(x=>x.slug===slug); if(!entry){if(location.hash)history.replaceState(null,'',`${location.pathname}${location.search}`);return;}
  const cover=resolveCoverMedia(entry);
  el.dialogContent.innerHTML=`<div class="detail-cover">${coverMarkup(entry)}<span class="cover-gradient"></span><div><p>${esc(entry.releaseLabel)}</p><h2 id="detail-title">${esc(entry.name)}</h2><span>${esc(entry.platform)}</span></div></div>
  <div class="detail-content"><div class="detail-summary"><p>Highlighted rewards from the community source sheet. Availability and values can change in game.</p>${entry.hasAccountUnlock?'<span class="account-pill">Includes account unlocks</span>':''}</div>
  <div class="reward-sections">${rewardSection('Companions','companion',entry.rewards.companions)}${rewardSection('Mounts','mount',entry.rewards.mounts)}${rewardSection('Artifacts','artifact',entry.rewards.artifacts)}${rewardSection('Races / special packs','race',entry.rewards.races)}</div>
  <div class="detail-actions"><button class="button button-primary" data-copy="${esc(entry.slug)}">${icon('copy')} Copy share link</button>${cover?.pageUrl?`<a class="button button-secondary" href="${esc(cover.pageUrl)}" target="_blank" rel="noreferrer">Open artwork source</a>`:''}</div></div>`;
  if(!el.dialog.open)el.dialog.showModal(); if(updateHash)history.replaceState(null,'',`${location.pathname}${location.search}#${entry.slug}`);
};
const closeDetails=()=>{if(el.dialog.open)el.dialog.close();if(location.hash)history.replaceState(null,'',`${location.pathname}${location.search}`)};
const toast=(msg)=>{el.toast.textContent=msg;el.toast.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.toast.hidden=true,2200)};
const copyLink=async slug=>{const u=new URL(location.href);u.hash=slug;try{await navigator.clipboard.writeText(u.href);toast('Share link copied')}catch{toast('Could not copy automatically')}};
const reset=()=>{Object.assign(state,{query:'',category:'all',year:'all',sort:'newest'});render();el.search.focus()};
const setView=v=>{state.view=['grid','list'].includes(v)?v:'grid';setStoredView(state.view);el.results.classList.toggle('list-view',state.view==='list');el.grid.setAttribute('aria-pressed',String(state.view==='grid'));el.list.setAttribute('aria-pressed',String(state.view==='list'))};

const init = () => {
  [...new Set(boxes.map(x=>x.year))].sort((a,b)=>b-a).forEach(y=>{const o=document.createElement('option');o.value=String(y);o.textContent=String(y);el.year.append(o)});
  const uniqueRewards=new Set(boxes.flatMap(rewardsOf).map(([,n])=>n)); const latest=[...boxes].sort((a,b)=>b.releaseDate.localeCompare(a.releaseDate))[0];
  $('#stat-total').textContent=boxes.length; $('#stat-years').textContent=new Set(boxes.map(x=>x.year)).size; $('#stat-rewards').textContent=uniqueRewards.size; $('#stat-account').textContent=boxes.filter(x=>x.hasAccountUnlock).length;
  $('#stat-latest').textContent=latest?.name||'Unknown'; $('#stat-latest-date').textContent=latest?.releaseLabel||'';
  const counts={all:boxes.length,companion:boxes.filter(x=>x.rewards.companions.length).length,mount:boxes.filter(x=>x.rewards.mounts.length).length,artifact:boxes.filter(x=>x.rewards.artifacts.length).length,race:boxes.filter(x=>x.rewards.races.length).length,account:boxes.filter(x=>x.hasAccountUnlock).length};
  Object.entries(counts).forEach(([k,v])=>{const n=$(`#count-${k}`);if(n)n.textContent=v});
  const p=new URLSearchParams(location.search),validYears=new Set(['all',...boxes.map(x=>String(x.year))]); state.query=p.get('q')||''; state.category=['all','companion','mount','artifact','race','account'].includes(p.get('type'))?p.get('type'):'all'; state.year=validYears.has(p.get('year'))?p.get('year'):'all'; state.sort=['newest','oldest','az','za'].includes(p.get('sort'))?p.get('sort'):'newest';
  el.sourceGrid.innerHTML=Object.values(MEDIA_SOURCES).map((s,i)=>`<a class="source-card" href="${esc(s.url)}" target="_blank" rel="noreferrer"><span>0${i+1}</span><div><strong>${esc(s.name)}</strong><p>${esc(s.use)}</p></div><b>↗</b></a>`).join('');
  setView(state.view);render();el.loading.hidden=true;if(location.hash)openDetails(location.hash.slice(1),false);
};

let timer; el.form.addEventListener('submit',e=>e.preventDefault()); el.search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.query=el.search.value;render()},90)}); el.clear.addEventListener('click',()=>{state.query='';render();el.search.focus()});
el.year.addEventListener('change',()=>{state.year=el.year.value;render()});el.sort.addEventListener('change',()=>{state.sort=el.sort.value;render()});el.tabs.forEach(t=>t.addEventListener('click',()=>{state.category=t.dataset.category;render()}));el.reset.addEventListener('click',reset);el.emptyReset.addEventListener('click',reset);el.grid.addEventListener('click',()=>setView('grid'));el.list.addEventListener('click',()=>setView('list'));el.close.addEventListener('click',closeDetails);el.dialog.addEventListener('click',e=>{if(e.target===el.dialog)closeDetails()});el.dialog.addEventListener('close',()=>{if(location.hash)history.replaceState(null,'',`${location.pathname}${location.search}`)});
document.addEventListener('click',e=>{const o=e.target.closest('[data-open]');if(o)openDetails(o.dataset.open);const c=e.target.closest('[data-copy]');if(c)copyLink(c.dataset.copy)});document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){e.preventDefault();el.search.focus()}if(e.key==='Escape'&&!el.dialog.open&&state.query){state.query='';render()}});window.addEventListener('hashchange',()=>{const s=location.hash.slice(1);if(s)openDetails(s,false);else if(el.dialog.open)el.dialog.close()});
document.addEventListener('error',e=>{const img=e.target instanceof HTMLImageElement?e.target:null;if(!img?.matches('[data-real-media]'))return;img.hidden=true;img.closest('.reward-thumb,.card-cover,.detail-cover')?.classList.add('media-failed')},true);

init();
hydrateCoverMedia(boxes).then(updated=>{el.mediaStatus.classList.add('is-ready');el.mediaStatus.innerHTML=`<span></span> ${updated?`${updated} cover images loaded`:'Verified artwork ready'}`;if(updated){render();const s=location.hash.slice(1);if(s&&el.dialog.open)openDetails(s,false)}}).catch(()=>{el.mediaStatus.classList.add('is-warning');el.mediaStatus.innerHTML='<span></span> Some remote artwork is unavailable'});
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
