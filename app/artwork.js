import runtimeMedia from './data/runtime-media.js';

const LOCAL_PACK_ART = {
  companion: '/assets/packs/companion-choice.webp',
  companionLegendary: '/assets/packs/legendary-companion-choice.webp',
  mount: '/assets/packs/mount-choice.webp',
  artifact: '/assets/packs/artifact-choice.webp',
};

const curatedMedia = {
  companion: {
    'Sardina the Tressym': '/assets/rewards/curated/sardina-the-tressym.png',
  },
  mount: {
    'Cactus the Hedgehog': '/assets/rewards/curated/cactus-the-hedgehog.png',
    "Hag's Hexing Cauldron": '/assets/rewards/curated/hags-hexing-cauldron.png',
  },
  race: {
    'Sigil of the Metallic Ancestry Dragonborn': '/assets/rewards/curated/metallic-ancestry-dragonborn.png',
    'Glorious Resurgence Legendary Pack': '/assets/rewards/curated/glorious-resurgence-legendary-pack.png',
  },
};

export const cleanRewardName = (value = '') => {
  const accountMatch = String(value).match(/^\[(.+)]\s*-\s*Account unlock$/i);
  const unwrapped = accountMatch ? accountMatch[1] : String(value);
  return unwrapped
    .replace(/^\s*(?:companion|artifact|mount|race)\s*:\s*/i, '')
    .replace(/\s+\((?:Epic|Rare)\)$/i, '')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

export const normalizeMediaKey = (value = '') => cleanRewardName(value)
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const localReward = (type, rewardName) => {
  const mapped = runtimeMedia?.items?.[type]?.[normalizeMediaKey(rewardName)];
  if (!mapped?.url) return null;
  return {
    ...mapped,
    canonicalName: mapped.name || cleanRewardName(rewardName),
    match: 'local',
  };
};

const packArtwork = (type, canonicalName) => {
  if (!/\bpack\b/i.test(canonicalName)) return null;

  let url = null;
  if (type === 'companion') {
    url = /legendary/i.test(canonicalName) ? LOCAL_PACK_ART.companionLegendary : LOCAL_PACK_ART.companion;
  } else if (type === 'mount') {
    url = LOCAL_PACK_ART.mount;
  } else if (type === 'artifact') {
    url = LOCAL_PACK_ART.artifact;
  }

  if (!url) return null;
  return {
    url,
    canonicalName,
    match: 'category-pack',
  };
};

export const resolveRewardMedia = (type, rewardName) => {
  const local = localReward(type, rewardName);
  if (local) return local;

  const canonicalName = cleanRewardName(rewardName);
  const curatedUrl = curatedMedia?.[type]?.[canonicalName];
  if (curatedUrl) {
    return {
      url: curatedUrl,
      canonicalName,
      match: 'curated-local',
    };
  }

  return packArtwork(type, canonicalName);
};

export const resolveCoverMedia = (entry) => {
  const mapped = runtimeMedia?.items?.lockbox?.[entry?.slug];
  if (!mapped?.url) return null;
  return {
    ...mapped,
    canonicalName: mapped.name || entry.name,
    isLocal: String(mapped.url).startsWith('/'),
    isPlaceholder: false,
  };
};
