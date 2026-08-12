import localMedia from './data/local-media.js';

const LOCAL_PACK_ART = {
  companion: '/assets/packs/companion-choice.webp',
  companionLegendary: '/assets/packs/legendary-companion-choice.webp',
  mount: '/assets/packs/mount-choice.webp',
  artifact: '/assets/packs/artifact-choice.webp',
};

const curatedMedia = {
  companion: {
    'Sardina the Tressym': {
      url: 'https://forgottenrealms.fandom.com/wiki/Special:FilePath/Sardina_the_Tressym.png',
      sourceUrl: 'https://forgottenrealms.fandom.com/wiki/Sardina',
      provider: 'Forgotten Realms Wiki',
    },
  },
  mount: {
    'Cactus the Hedgehog': {
      url: 'https://forgottenrealms.fandom.com/wiki/Special:FilePath/Cactus_the_Hedgehog.png',
      sourceUrl: 'https://forgottenrealms.fandom.com/wiki/Cactus_(hedgehog)',
      provider: 'Forgotten Realms Wiki',
    },
    "Hag's Hexing Cauldron": {
      url: 'https://static.wikia.nocookie.net/neverwinter_gamepedia/images/7/77/Icons_Inventory_Mount_Cauldron_Mythic.png/revision/latest?cb=20210424062237',
      sourceUrl: 'https://neverwinter.fandom.com/wiki/Hag%27s_Hexing_Cauldron',
      provider: 'Neverwinter Wiki',
    },
  },
  race: {
    'Sigil of the Metallic Ancestry Dragonborn': {
      url: 'https://static.wikia.nocookie.net/neverwinter_gamepedia/images/3/31/Icon_Lockbox_Sigil_Metallicdragonborn.png/revision/latest?cb=20150115203247',
      sourceUrl: 'https://neverwinter.fandom.com/wiki/Sigil_of_the_Metallic_Ancestry_Dragonborn',
      provider: 'Neverwinter Wiki',
    },
    'Glorious Resurgence Legendary Pack': {
      url: 'https://static.wikia.nocookie.net/neverwinter_gamepedia/images/5/5c/Icon_Lockbox_Resurgence_Legendarypack.png/revision/latest?cb=20151118143748',
      sourceUrl: 'https://neverwinter.fandom.com/wiki/Glorious_Resurgence_Legendary_Pack',
      provider: 'Neverwinter Wiki',
    },
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
  const mapped = localMedia?.items?.[type]?.[normalizeMediaKey(rewardName)];
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
    provider: 'Local pack artwork',
    match: 'category-pack',
  };
};

export const resolveRewardMedia = (type, rewardName) => {
  const local = localReward(type, rewardName);
  if (local) return local;

  const canonicalName = cleanRewardName(rewardName);
  const curated = curatedMedia?.[type]?.[canonicalName];
  if (curated?.url) return { ...curated, canonicalName, match: 'curated' };

  return packArtwork(type, canonicalName);
};

export const resolveCoverMedia = (entry) => {
  const mapped = localMedia?.items?.lockbox?.[entry?.slug];
  if (!mapped?.url) return null;
  return {
    ...mapped,
    canonicalName: mapped.name || entry.name,
    isLocal: String(mapped.url).startsWith('/'),
    isPlaceholder: false,
  };
};

export const MEDIA_SOURCES = {
  archive: {
    name: 'Local archive artwork',
    url: 'https://neverwinter.fandom.com/wiki/Lockbox',
  },
};
