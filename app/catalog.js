export const normalizeSearchText = (value) => String(value ?? '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '');

export const buildSearchText = (entry) => normalizeSearchText([
  entry.name,
  entry.companion,
  entry.artifact,
  entry.mount,
  entry.race,
  entry.releaseLabel,
  entry.year,
  entry.platform,
  entry.hasAccountUnlock ? 'account unlock' : '',
].filter(Boolean).join(' '));

export const matchesCategory = (entry, category = 'all') => {
  switch (category) {
    case 'companion': return Boolean(entry.companion);
    case 'artifact': return Boolean(entry.artifact);
    case 'mount': return Boolean(entry.mount);
    case 'race': return Boolean(entry.race);
    case 'account': return Boolean(entry.hasAccountUnlock);
    default: return true;
  }
};

export const sortLockboxes = (entries, sort = 'newest') => [...entries].sort((a, b) => {
  switch (sort) {
    case 'oldest': return a.releaseDate.localeCompare(b.releaseDate);
    case 'az': return a.name.localeCompare(b.name);
    case 'za': return b.name.localeCompare(a.name);
    default: return b.releaseDate.localeCompare(a.releaseDate);
  }
});

export const filterLockboxes = (entries, filters = {}) => {
  const {
    query = '',
    category = 'all',
    year = 'all',
    sort = 'newest',
  } = filters;

  const tokens = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);

  const filtered = entries.filter((entry) => {
    const queryMatches = tokens.every((token) => buildSearchText(entry).includes(token));
    const yearMatches = year === 'all' || String(entry.year) === String(year);
    return queryMatches && yearMatches && matchesCategory(entry, category);
  });

  return sortLockboxes(filtered, sort);
};
