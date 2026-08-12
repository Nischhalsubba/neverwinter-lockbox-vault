export const normalizeSearchText = (value) => String(value ?? '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '');

const rewardValues = (entry, plural, legacyKey) => {
  const values = entry?.rewards?.[plural];
  if (Array.isArray(values)) return values;
  return entry?.[legacyKey] ? [entry[legacyKey]] : [];
};

export const buildSearchText = (entry) => normalizeSearchText([
  entry.name,
  ...rewardValues(entry, 'companions', 'companion'),
  ...rewardValues(entry, 'artifacts', 'artifact'),
  ...rewardValues(entry, 'mounts', 'mount'),
  ...rewardValues(entry, 'races', 'race'),
  entry.releaseLabel,
  entry.year,
  entry.platform,
  entry.hasAccountUnlock ? 'account unlock' : '',
].filter(Boolean).join(' '));

export const matchesCategory = (entry, category = 'all') => {
  switch (category) {
    case 'companion': return rewardValues(entry, 'companions', 'companion').length > 0;
    case 'artifact': return rewardValues(entry, 'artifacts', 'artifact').length > 0;
    case 'mount': return rewardValues(entry, 'mounts', 'mount').length > 0;
    case 'race': return rewardValues(entry, 'races', 'race').length > 0;
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
