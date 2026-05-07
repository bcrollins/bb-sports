export interface BrandAsset {
  id: string;
  title: string;
  kind: 'founder-photo' | 'illustration';
  src: string;
  width: number;
  height: number;
  alt: string;
  usage: string;
  credit: string;
  objectPosition?: string;
}

export const BRADLEY_BRAND_ASSETS: BrandAsset[] = [
  {
    id: 'bradley-winter-classic',
    title: 'Brad Benson - NHL trophy photo',
    kind: 'founder-photo',
    src: '/brand/bradley/bradley-benson-winter-classic.jpg',
    width: 2200,
    height: 1650,
    alt: 'Brad Benson in a Florida Panthers jersey beside the Stanley Cup at an NHL event.',
    usage: 'Primary founder image for the About page, media kit, and Bradley profile surfaces.',
    credit: 'BB Sports / Bradley Benson',
    objectPosition: '78% center',
  },
  {
    id: 'bradley-manchester-united',
    title: 'Brad Benson - Manchester United photo',
    kind: 'founder-photo',
    src: '/brand/bradley/bradley-benson-manchester-united.jpg',
    width: 2200,
    height: 1650,
    alt: 'Brad Benson at a Manchester United display.',
    usage: 'Secondary founder image for soccer coverage, profile variants, and brand collateral.',
    credit: 'BB Sports / Bradley Benson',
    objectPosition: '82% center',
  },
  {
    id: 'bradley-illustrated-card',
    title: 'Bradley Benson illustrated BB Sports card',
    kind: 'illustration',
    src: '/brand/bradley/bradley-benson-illustrated-card.jpg',
    width: 1054,
    height: 1400,
    alt: 'Illustrated BB Sports card of Bradley Benson in a Florida Panthers jersey holding a laptop and a trophy.',
    usage: 'Personality art for brand decks, launch graphics, and internal admin references.',
    credit: 'BB Sports illustration supplied by Bradley Benson',
    objectPosition: 'center',
  },
];

export const PRIMARY_BRADLEY_ASSET = BRADLEY_BRAND_ASSETS[0];
