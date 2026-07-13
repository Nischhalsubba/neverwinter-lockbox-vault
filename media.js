const TOONFORGE_REPO = 'https://github.com/n00bin/nwc';
const TOONFORGE_RAW = 'https://raw.githubusercontent.com/n00bin/nwc/main/images';

const companionFiles = {
  'Aranea': 'aranea.webp',
  'Assassin Drake': 'assassin-drake.webp',
  'Black Ice Ioun Stone': 'black-ice-stone.webp',
  'Blaspheme Assassin': 'blaspheme-assassin.webp',
  'Bobby the Barbarian': 'bobby.webp',
  'Butterfly': 'butterfly.webp',
  'Crystal Golem': 'crystalline-golem.webp',
  'Deep Crow Hatchling': 'deep-crow-hatchling.webp',
  'Diana the Acrobat': 'diana-the-acrobat.webp',
  'Displacer Beast': 'displacer-beast.webp',
  'Dragon Hunter': 'dragon-hunter.webp',
  'Flapjack': 'flapjack.webp',
  'Flumph': 'flumph.webp',
  'Grace Revoir': 'grace-revoir.webp',
  'Grung': 'grung.webp',
  'Hank the Ranger': 'hank-the-ranger.webp',
  'Infant Gorilla': 'infant-gorilla.webp',
  'Iron Golem': 'iron_golem.webp',
  'Kavatos Stormeye': 'kavatos-stormeye.webp',
  'Laughing Skull': 'laughing-skull (2).webp',
  'Lich': 'lich.webp',
  'Lysaera': 'lysaera.webp',
  'Manticore': 'manticore (2).webp',
  'Minsc': 'minsc (2).webp',
  'Minotaur Mercenary': 'minotaur.webp',
  'Phoera': 'phoera.webp',
  'Pseudodragon': 'pseudodragon (2).webp',
  'Razorwood': 'razorwood (2).webp',
  'Rumpadump': 'rumpadump.webp',
  'Rust Monster': 'rust-monster (2).webp',
  'Savage Allosaur': 'savage-allosaur.webp',
  'Shadow Elemental': 'shadow-elemental (2).webp',
  'Spined Devil': 'spined-devil.webp',
  'Stalwart Golden Lion': 'stalwart-golden-lion.webp',
  'Tamed Velociraptor': 'tamed-velociraptor.webp',
  'Xaryxian Defector': 'xaryxian-defector.webp',
};

const mountFiles = {
  'Adolescent Deep Crow': 'adolescent-deep-crow.webp',
  'Apparatus of Kwalish': 'apparatus-of-kwalish.webp',
  'Arcane Whirlwind': 'arcane-whirlwind.webp',
  'Armored Axe Beak': 'armored-axe-beak.webp',
  'Armored Bulette': 'armored-bulette.webp',
  'Armored Giant Strider': 'armored-giant-strider.webp',
  'Armored Griffon': 'armored-griffon.webp',
  'Axe Beak': 'axe-beak.webp',
  'Barlgura': 'barlgura.webp',
  'Bestial Fire Archon': 'bestial-fire-archon.webp',
  "Bigby's Hand": 'bigbys-hand.webp',
  'Black Ice Warhorse': 'black-ice-warhorse.webp',
  'Black Unicorn': 'black-unicorn.webp',
  'Brain Stealer Dragon': 'brain-stealer-dragon.webp',
  'Brown Siege Bear': 'brown-siege-bear.webp',
  'Bulette': 'bulette.webp',
  'Carpet of Flying': 'carpet-of-flying.webp',
  'Cavalry Tyrannosaur': 'cavalry-tyrannosaur.webp',
  'Celestial Stag': 'celestial-stag.webp',
  'Coastal Flail Snail': 'coastal-flail-snail.webp',
  'Cosmos Stag': 'cosmos-stag.webp',
  'Deadly Driderform': 'deadly-driderform.webp',
  'Demon Wings': 'demon-wings.webp',
  'Demonic Gravehound': 'demonic-gravehound.webp',
  'Dragonbone Golem': 'dragonbone-golem.webp',
  'Ebon Riding Lizard': 'ebon-riding-lizard.webp',
  'Emperor Beetle': 'emperor-beetle.webp',
  'Empowered Dragonbone Golem': 'empowered-dragonbone-golem.webp',
  'Epic Giant Toad': 'epic-giant-toad.webp',
  'Feywild Griffon': 'feywild-griffon.webp',
  'Feywild Stag': 'feywild-stag.webp',
  'Flail Snail': 'flail-snail.webp',
  'Frost Salamander': 'frost-salamander.webp',
  'Giant Beetle': 'giant-beetle.webp',
  'Giant Space Hamster': 'giant-space-hamster.webp',
  'Giant Strider': 'giant-strider.webp',
  'Glorious Undead Lion': 'glorious-undead-lion.webp',
  'Golden Armored Griffon': 'golden-armored-griffon.webp',
  'Gorgon': 'gorgon.webp',
  'Grubshank the Burdened': 'grubshank-the-burdened.webp',
  "Hag's Cooking Cauldron": 'hags-cooking-cauldron.webp',
  "Hag's Enchanted Cauldron": 'hags-enchanted-cauldron.webp',
  'Heavy Inferno Nightmare': 'heavy-inferno-nightmare.webp',
  'Hellfire Engine': 'hellfire-engine.webp',
  'Imperial Rage Drake': 'imperial-rage-drake.webp',
  'Infernal War Machine': 'infernal-war-machine.webp',
  'King of Spines': 'king-of-spines.webp',
  'Legendary Barlgura': 'legendary-barlgura.webp',
  'Legendary Carpet of Flying': 'legendary-carpet-of-flying.webp',
  'Legendary Giant Toad': 'legendary-giant-toad.webp',
  'Legendary Hellfire Engine': 'legendary-hellfire-engine.webp',
  'Legendary Reconnaissance Balloons': 'legendary-reconnaissance-balloons.webp',
  'Marvelous Reconnaissance Balloons': 'marvelous-reconnaissance-balloons.webp',
  'Mist Form': 'mist-form.webp',
  'Myconid Bulette': 'myconid-bulette.webp',
  'Nightfire Dragonnel': 'nightfire-dragonnel.webp',
  'Noble Pegasus': 'noble-pegasus.webp',
  'Omen of Despair': 'omen-of-despair.webp',
  'Owlbear': 'owlbear.webp',
  'Pegasus': 'pegasus.webp',
  'Phantom Panther': 'phantom-panther.webp',
  'Polar Siege Bear': 'polar-siege-bear.webp',
  'Rage Drake': 'rage-drake.webp',
  'Red Mountain Fox': 'red-mountain-fox.webp',
  'Rimefire Salamander': 'rimefire-salamander.webp',
  'Runeclad Manticore': 'runeclad-manticore.webp',
  'Skeleton Steed': 'skeleton-steed.webp',
  'Skyhold Alligator': 'skyhold-alligator.webp',
  'Space Guppy School': 'space-guppy-school.webp',
  'Starfade Stag': 'starfade-stag.webp',
  'Swarm': 'swarm.webp',
  'Swift Golden Lion': 'swift-golden-lion.webp',
  'Sylvan Stag': 'sylvan-stag.webp',
  "Tenser's Floating Disk": 'tensers-floating-disk.webp',
  'Triceratops': 'triceratops.webp',
  'Twice-Pale Alder': 'twice-pale-alder.webp',
  'Umber Hulk': 'umber-hulk.webp',
  'Uni the Unicorn': 'uni-the-unicorn.webp',
  'War Triceratops': 'war-triceratops.webp',
  'Whirlwind': 'whirlwind.webp',
  'Zodar Armor': 'zodar-armor.webp',
};

const artifactFiles = {
  'Heart of the Black Dragon': 'Icon_Inventory_Artifacts_Black_Dragon_Heart.webp',
  'Token of Chromatic Storm': 'Icon_Inventory_Artifacts_Chromatic_Storm.webp',
};

const aliases = {
  'Bobby the Barbarian': 'Bobby the Barbarian',
  'Diana the Acrobat': 'Diana the Acrobat',
  'Legendary Adolescent Deep Crow': 'Adolescent Deep Crow',
  'Twice-Pale Alder Mount': 'Twice-Pale Alder',
};

export const cleanRewardName = (value = '') => {
  const accountMatch = String(value).match(/^\[(.+)]\s*-\s*Account unlock$/i);
  const unwrapped = accountMatch ? accountMatch[1] : String(value);
  return unwrapped
    .replace(/\s+\((?:Epic|Rare)\)$/i, '')
    .replace(/[’]/g, "'")
    .trim();
};

const buildMedia = (folder, filename, canonicalName, match = 'exact') => ({
  url: `${TOONFORGE_RAW}/${folder}/${encodeURIComponent(filename)}`,
  sourceUrl: `${TOONFORGE_REPO}/blob/main/images/${folder}/${encodeURIComponent(filename)}`,
  provider: 'ToonForge / Neverwinter Compendium',
  repository: TOONFORGE_REPO,
  canonicalName,
  match,
  rightsNote: 'Community-hosted Neverwinter game asset; rights remain with the game publishers.',
});

export const resolveRewardMedia = (type, rewardName) => {
  const cleaned = cleanRewardName(rewardName);
  const canonical = aliases[cleaned] || cleaned;

  if (type === 'companion' && companionFiles[canonical]) {
    return buildMedia('companions', companionFiles[canonical], canonical, canonical === cleaned ? 'exact' : 'alias');
  }

  if (type === 'mount' && mountFiles[canonical]) {
    return buildMedia('mounts', mountFiles[canonical], canonical, canonical === cleaned ? 'exact' : 'alias');
  }

  if (type === 'artifact' && artifactFiles[canonical]) {
    return buildMedia('artifacts', artifactFiles[canonical], canonical, canonical === cleaned ? 'exact' : 'alias');
  }

  return null;
};

export const MEDIA_SOURCES = {
  official: {
    name: 'Official Neverwinter news',
    url: 'https://www.playneverwinter.com/en/news',
    use: 'Primary source for lockbox announcements and promotional artwork.',
  },
  toonforge: {
    name: 'ToonForge / Neverwinter Compendium',
    url: TOONFORGE_REPO,
    use: 'Community-maintained companion, mount, and artifact thumbnails.',
  },
  nwhub: {
    name: 'Neverwinter Hub',
    url: 'https://nw-hub.com/',
    use: 'Secondary discovery source when a directly attributable asset can be verified.',
  },
};
