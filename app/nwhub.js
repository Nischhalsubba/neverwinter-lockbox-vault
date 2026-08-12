export const normalizeMediaText = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[’]/g, "'")
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export const mediaSlug = (value = '') => normalizeMediaText(value).replace(/\s+/g, '-');

const usefulTokens = (value) => new Set(
  normalizeMediaText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !['the', 'and', 'pack', 'account', 'unlock'].includes(token)),
);

export const scoreMediaCandidate = (target, candidate) => {
  const targetName = normalizeMediaText(target?.name);
  const candidateName = normalizeMediaText(candidate?.title);
  const targetSlug = mediaSlug(target?.name);
  const candidateSlug = mediaSlug(candidate?.title);
  const urlSlug = mediaSlug(String(candidate?.url || '').split('/').pop()?.split('?')[0] || '');

  if (!targetName || !candidate?.url) return -1;

  let score = 0;
  if (candidateName && candidateName === targetName) score += 1200;
  if (candidateSlug && candidateSlug === targetSlug) score += 950;
  if (urlSlug && urlSlug === targetSlug) score += 900;
  if (candidateName && (candidateName.includes(targetName) || targetName.includes(candidateName))) score += 420;
  if (urlSlug && (urlSlug.includes(targetSlug) || targetSlug.includes(urlSlug))) score += 340;

  const targetTokens = usefulTokens(target.name);
  const candidateTokens = new Set([
    ...usefulTokens(candidate.title),
    ...usefulTokens(urlSlug),
  ]);
  let overlap = 0;
  for (const token of targetTokens) if (candidateTokens.has(token)) overlap += 1;
  score += overlap * 145;

  if (target.type === 'lockbox' && (candidateName.includes('lockbox') || urlSlug.includes('lockbox'))) score += 160;
  if (target.type && candidate.type && target.type === candidate.type) score += 160;
  if (targetTokens.size > 1 && overlap === 1) score -= 120;

  return score;
};

export const matchNwHubCandidates = (targets, candidates, { threshold = 520 } = {}) => {
  const bestByTarget = new Map();

  for (const candidate of candidates || []) {
    if (!candidate?.url?.startsWith('https://')) continue;
    let bestTarget = null;
    let bestScore = threshold - 1;

    for (const target of targets || []) {
      const score = scoreMediaCandidate(target, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }

    if (!bestTarget) continue;
    const current = bestByTarget.get(bestTarget.key);
    if (!current || bestScore > current.score) {
      bestByTarget.set(bestTarget.key, { target: bestTarget, candidate, score: bestScore });
    }
  }

  return bestByTarget;
};
