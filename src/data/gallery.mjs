// gallery.exe: the pieces from the Portfolio Gallery in Figma (3D, motion, branding, logos, xMoney visuals,
// overview sheets). Stills were exported from Figma; motion pieces are short MP4 loops cut from the originals.
// Facts here come from the gallery itself (section captions, piece names, years) and from where the source
// files live. Anything not known is left out rather than guessed.

export const CATS = ['3D', 'Motion', 'Branding', 'Logos', 'xMoney visuals', 'Overview'];

// one colour per category, used by the album and the prize cards (the labels are no longer shown)
export const RARITY = {
  '3D': { label: 'Epic', color: '#ff005d' },
  Motion: { label: 'Legendary', color: '#ff4b1f' },
  Branding: { label: 'Rare', color: '#3d63ff' },
  'xMoney visuals': { label: 'Uncommon', color: '#7c5cff' },
  Logos: { label: 'Common', color: '#2a2a2a' },
  Overview: { label: 'Common', color: '#2a2a2a' }
};

// cases group the work: the viewer and the prize cards name them, and the wall keeps a case's pieces apart
export const CASES = [
  { id: 'coins', title: 'The XM coins', note: 'Coin renders for EURXM, RONXM and USDXM, and the EURXM coin flip.', items: ['105', '142', '144', '145', '146', '147', '148', '149', '202'] },
  { id: 'xmoney3d', title: 'xMoney in 3D and motion', note: '3D loops, icons and motion pieces for xMoney.', items: ['106', '107', '108', '112', '213', '239', '240', '203', '204'] },
  { id: 'xmv', title: 'xMoney visuals', where: 'xMoney, in-house', note: 'Marketing visuals for xMoney.', items: ['801', '803', '804', '805', '806', '807', '808', '809', '810', '811'] },
  { id: 'xportal', title: 'xPortal in 3D', note: 'Frosted glass cards and an ETH staking hand for xPortal.', items: ['111', '140', '141', '150'] },
  { id: 'films', title: 'Films and explainers', note: 'Short films and an explainer.', items: ['103', '214', '219', '242', '245'] },
  { id: 'growth', title: 'Growth Games', where: 'MultiversX Foundation grants program', role: 'Brand identity, lead designer', year: '2025', note: 'Brand identity for the MultiversX Foundation grants program: the logo, a 3D key visual, a 3D tunnel, a YouTube cover and patterns.', items: ['701', '702', '703', '704', '705', '706', '722'] },
  { id: 'momentum', title: 'Momentum', where: 'Code MultiversX builders podcast', role: 'Logo, key visuals, YouTube covers', year: '2025', note: 'Logo, key visuals and YouTube covers for the Code MultiversX builders podcast.', items: ['716', '717', '718', '719', '720', '721'] },
  { id: 'fsp', title: 'Full Shard Podcast', where: 'MultiversX founders podcast', role: 'Branding, contributor', year: '2024', note: 'Branding for the MultiversX founders podcast, plus a logo puzzle animation and a fractal intro.', items: ['707', '708', '243', '244'] },
  { id: 'r20', title: 'The Roaring 20s', where: 'Podcast', role: 'Logo and key visual explorations', note: 'Logo and key visual explorations for a podcast.', items: ['709', '710', '711', '712', '713', '714', '715'] },
  { id: 'fourth', title: 'Back and Fourth', note: 'The Back and Fourth logo, the Fourth mark and a bucket hat.', items: ['310', 'X1', 'X3'] },
  { id: 'fizz', title: 'Fizz', note: 'The Fizz mark, the wordmark and the colour version.', items: ['350', '351', '352'] },
  { id: 'bored', title: 'Bored', note: 'Bored Buyer: the logo and its animation, plus Bored esports merch.', items: ['355', '232', '354'] },
  { id: 'marks', title: 'More logos', note: 'Logos from freelance work over the years.', items: ['X2', '320', '328', '362', '377', '234'] },
  { id: 'mvx', title: 'More from MultiversX', note: 'Other pieces made in-house at MultiversX: FebruAIry, the xMEX lightning and an astronaut helmet.', items: ['151', '241', '723'] },
  { id: 'archive', title: 'Archive sheets', note: 'Overview sheets of older work: a logofolio and animal marks.', items: ['503', '504'] }
];

// pieces whose source files sit in the MultiversX folders (made in-house there, later at xMoney)
const IN_HOUSE = ['103', '105', '106', '107', '108', '111', '112', '140', '141', '142', '144', '145', '146', '147', '148', '149', '150', '151', '202', '203', '204', '213', '214', '239', '240', '241', '242', '723'];
const WHERE = { '219': 'Wagmi Markets' };
// pieces whose original has a soundtrack: the viewer plays a full-length cut with sound (<key>-sound.mp4)
const SOUND = ['103', '213', '214', '219', '242', '244'];
// stills rebuilt from the original files (or the Figma source frames) at up to 2400px, so the viewer stays sharp when you zoom in (<key>-hd.webp)
const HD = ['105', '111', '112', '140', '141', '142', '144', '145', '146', '147', '148', '149', '150', '310', '320', '328', '350', '351', '352', '354', '355', '377', '503', '504', '801', '803', '804', '805', '806', '807', '808', '809'];

const catOf = (id) => {
  if (id.startsWith('X')) return 'Logos';
  return { 1: '3D', 2: 'Motion', 3: 'Logos', 5: 'Overview', 7: 'Branding', 8: 'xMoney visuals' }[id[0]];
};
// a few pieces the rules below would name wrongly
const KIND = { '723': 'Visual' };
const kindOf = (cat, title, video, id) => {
  if (KIND[id]) return KIND[id];
  const t = title.toLowerCase();
  if (cat === '3D') return video ? '3D loop' : '3D render';
  if (cat === 'Motion') return /logo/.test(t) ? 'Logo animation' : 'Motion';
  if (cat === 'Overview') return 'Overview sheet';
  if (cat === 'xMoney visuals') return 'Marketing visual';
  if (video) return /logo/.test(t) ? 'Logo animation' : /3d/.test(t) ? '3D loop' : 'Motion';
  if (/explorations/.test(t)) return 'Logo explorations';
  if (/key visual/.test(t)) return 'Key visual';
  if (/pattern/.test(t)) return 'Pattern';
  if (/cover|thumbnail/.test(t)) return 'Cover art';
  if (/merch|bucket hat/.test(t)) return 'Merch';
  if (/wordmark/.test(t)) return 'Wordmark';
  if (/monogram/.test(t)) return 'Monogram';
  if (/colour/.test(t)) return 'Logo, colour';
  return 'Logo';
};

export function buildGallery(stills, versioned) {
  const caseOf = Object.fromEntries(CASES.flatMap((c) => c.items.map((id) => [id, c.id])));
  const items = stills.map((s) => {
    const cat = catOf(s.id);
    const c = CASES.find((x) => x.id === caseOf[s.id]);
    const base = `/os/gallery/${s.key}`;
    let where = WHERE[s.id] || c.where;
    if (!where && IN_HOUSE.includes(s.id)) where = s.year === '2026' ? 'xMoney, in-house' : 'MultiversX, in-house';
    return {
      id: s.id, title: s.name, year: s.year || c.year || null, cat, case: c.id, kind: kindOf(cat, s.name, s.video, s.id),
      where: where || null, role: c.role || null, video: s.video, w: s.w, h: s.h,
      src: versioned(`${base}.webp`), thumb: versioned(`${base}-t.webp`), mp4: s.video ? versioned(`${base}.mp4`) : null,
      sound: SOUND.includes(s.id) ? versioned(`${base}-sound.mp4`) : null,
      hd: HD.includes(s.id) ? versioned(`${base}-hd.webp`) : null
    };
  });
  const order = (a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || a.id.localeCompare(b.id, 'en', { numeric: true });
  // the capsule machine: a Blender render (still) and one clip of a turn (knob, capsule rolls out)
  const machine = { still: versioned('/os/gallery/machine/still.webp'), pull: versioned('/os/gallery/machine/pull.mp4'), pullWebm: versioned('/os/gallery/machine/pull.webm') };
  return { items: items.sort(order), cases: CASES, cats: CATS, rarity: RARITY, machine };
}
