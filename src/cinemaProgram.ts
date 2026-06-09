export type ShowAct = 'preshow' | 'lobby' | 'auditorium' | 'backstage';

export type CluePalette = 'cyan' | 'gold';

export type ProgramScene = {
  seatId: string;
  order: number;
  title: string;
  hint: string;
  symbol: string;
  palette: CluePalette;
  runtime: string;
  festivalTag: string;
  directorNote: string;
  audioSrc: string;
  isPlaceholder?: boolean;
};

export function sceneAudioSrc(seatId: string): string {
  return `/media/audio/${seatId.replace(':', '-')}.m4a`;
}

export type ProgramAct = {
  id: ShowAct;
  label: string;
  subtitle: string;
};

export type PreShowSlide = {
  id: string;
  kind: 'silence' | 'welcome' | 'feature';
  kicker?: string;
  title: string;
  subtitle?: string;
  durationMs: number;
};

export type SoundtrackCue = {
  title: string;
  note: string;
};

export type TicketCoupon = {
  id: string;
  title: string;
  subtitle: string;
  admit: string;
};

export type StillCaption = {
  city: string;
  year: string;
  caption: string;
};

export const FEATURE_TITLE = "Tonight's Feature: Ollie's Birthday";

export const DIRECTOR_NOTE_PLACEHOLDER =
  '';

export const PROGRAM_ACTS: ProgramAct[] = [
  { id: 'lobby', label: 'Act I', subtitle: 'Lobby' },
  { id: 'auditorium', label: 'Act II', subtitle: 'Auditorium' },
  { id: 'backstage', label: 'Act III', subtitle: 'Backstage' },
];

export const PRE_SHOW_SLIDES: PreShowSlide[] = [
  {
    id: 'silence',
    kind: 'silence',
    kicker: 'House announcement',
    title: 'Please silence your phones.',
    subtitle: '',
    durationMs: 2800,
  },
  {
    id: 'welcome',
    kind: 'welcome',
    kicker: 'Ollie Birthday Cinema',
    title: 'Welcome.',
    subtitle: 'One night only. Doors open at dusk.',
    durationMs: 2400,
  },
  {
    id: 'feature',
    kind: 'feature',
    kicker: 'Now showing',
    title: FEATURE_TITLE,
    subtitle: '',
    durationMs: 3600,
  },
];

export const PROGRAM_SCENES: ProgramScene[] = [
  {
    seatId: '1:3',
    order: 1,
    title: 'Night Watcher',
    hint: 'A small shadow walks in circles.',
    symbol: 'cat-orbit',
    palette: 'cyan',
    runtime: '2 min',
    festivalTag: 'Midnight Short',
    directorNote: 'For the nights when the room needs...',
    audioSrc: sceneAudioSrc('1:3'),
  },
  {
    seatId: '1:5',
    order: 2,
    title: 'Borderless Map',
    hint: 'Continent awaits; lens keeps searching...',
    symbol: 'europe-lens',
    palette: 'gold',
    runtime: '3 min',
    festivalTag: 'Travel Window',
    directorNote: 'Collect',
    audioSrc: sceneAudioSrc('1:5'),
  },
  {
    seatId: '3:5',
    order: 3,
    title: 'Sticks',
    hint: 'Meet and tap.',
    symbol: 'chopsticks',
    palette: 'cyan',
    runtime: '1 min',
    festivalTag: 'Table Scene',
    directorNote: '不是筷子。',
    audioSrc: sceneAudioSrc('3:5'),
  },
  {
    seatId: '3:7',
    order: 4,
    title: 'Mystery Reel',
    hint: 'This frame refuses to explain itself.',
    symbol: 'mystery',
    palette: 'gold',
    runtime: '?:??',
    festivalTag: 'Hidden Reel',
    directorNote: 'Some birthday gifts should stay half-hidden until the lights come up.',
    audioSrc: sceneAudioSrc('3:7'),
  },
  // {
  //   seatId: '2:4',
  //   order: 5,
  //   title: 'Reserved Frame',
  //   hint: 'This seat is still waiting for its scene.',
  //   symbol: 'placeholder',
  //   palette: 'gold',
  //   runtime: 'TBD',
  //   festivalTag: 'Coming Soon',
  //   directorNote: 'Placeholder — fill in when the next gift is ready.',
  //   audioSrc: sceneAudioSrc('2:4'),
  //   isPlaceholder: true,
  // },
  // {
  //   seatId: '2:7',
  //   order: 6,
  //   title: 'Reserved Frame',
  //   hint: 'Another frame held back for later.',
  //   symbol: 'placeholder',
  //   palette: 'cyan',
  //   runtime: 'TBD',
  //   festivalTag: 'Coming Soon',
  //   directorNote: 'Placeholder — fill in when the next gift is ready.',
  //   audioSrc: sceneAudioSrc('2:7'),
  //   isPlaceholder: true,
  // },
];

export const GIFT_SEAT_IDS = PROGRAM_SCENES.map((scene) => scene.seatId);

export type GiftSeatId = ProgramScene['seatId'];

export const SCREENING_ORDER = [
  { order: 0, label: 'Overture', detail: 'Still gallery on screen + soundtrack in the corner' },
  { order: 1, label: 'Short 01', detail: 'Little Night Watcher — Row 1 Seat 3' },
  { order: 2, label: 'Short 02', detail: 'Borderless Map — Row 1 Seat 5' },
  { order: 3, label: 'Short 03', detail: 'Two Small Sticks — Row 3 Seat 5' },
  { order: 4, label: 'Short 04', detail: 'Mystery Reel — Row 3 Seat 7' },
  { order: 5, label: 'Short 05', detail: 'Reserved Frame — Row 2 Seat 4' },
  { order: 6, label: 'Short 06', detail: 'Reserved Frame — Row 2 Seat 7' },
  { order: 5, label: 'Intermission', detail: 'Find the backstage board behind the screen' },
  { order: 6, label: 'Commentary tracks', detail: 'Three voice letters — to be recorded' },
  { order: 7, label: 'Future tickets', detail: 'Admit-two coupons for scenes yet to film' },
] as const;

export const SOUNDTRACK_AUDIO_SRC = '/media/audio/soundtrack.m4a';

export const SOUNDTRACK_CUES: SoundtrackCue[] = [
  { title: 'Opening lobby', note: 'The walk in before the first frame.' },
  { title: 'Still gallery loop', note: 'Photos passing like a quiet montage.' },
  { title: 'Seat discoveries', note: 'A brighter motif for each found scene.' },
  { title: 'Backstage', note: 'Softer, handwritten — for the board behind the screen.' },
];

export const TICKET_COUPONS: TicketCoupon[] = [
  { id: 'film-night', title: 'Admit Two — Any Film', subtitle: 'Valid for the next shared screening.', admit: 'Row ? · Seat ?' },
  { id: 'dinner', title: 'Admit Two — Dinner Scene', subtitle: 'A table, two menus, no rush.', admit: 'Future date · TBD' },
  { id: 'call', title: 'Admit One — Long-distance call', subtitle: 'Director on the line. No time limit.', admit: 'Any timezone' },
];

export const STILL_CAPTIONS: Record<string, StillCaption> = {

  '/media/img_v3_0212d_0a5973ec-b664-45cd-9adf-f935a510b74g.jpg': {
    city: 'Europe',
    year: '2026',
    caption: 'One window from the continent you turned into a map.',
  },
  '/media/img_v3_0212d_17098b3c-dfb8-41d9-9fe5-d57e4fedfeeg.jpg': {
    city: 'On the road',
    year: '2026',
    caption: 'A still you sent; now part of the montage.',
  },
  '/media/img_v3_0212d_2be711b3-9236-4b26-9c45-bca1c77652cg.jpg': {
    city: '本来看到就拍了这个照片想问你好不好看来着',
    year: '2026',
    caption: '但是感觉很没有边界感就算了，可以再想想要不要给你...',
  },
  '/media/img_v3_0212d_41dc5fcd-82fc-4161-9f43-f8d5478f2d0g.jpg': {
    city: '不知道是不是最后一次被Ollie宠幸所以拍一张',
    year: '2026',
    caption: '温暖的妈咪',
  },
  '/media/img_v3_0212d_704fb92a-ed8a-412e-b9e8-712299cc456g.jpg': {
    city: '美味玉米汁',
    year: '2026',
    caption: '每次被妈咪宠爱都要记录一下',
  },
  '/media/img_v3_0212d_9d32bd63-ca3a-485f-94f2-c8dcbd40622g.jpg': {
    city: '在波尔图机场',
    year: '2026',
    caption: '刚teams call完你测试设备，拍完决定不发了不然显得try too hard',
  },
  '/media/img_v3_0212d_beee9f9d-b03f-4ebd-9c07-79b639ab952g.jpg': {
    city: '随时随地偷拍',
    year: '2026',
    caption: '像那个臭狗仔',
  },
  '/media/img_v3_0212d_e0bb7cc9-7559-41b3-8d5c-20a1c397c0bg.jpg': {
    city: '开屏',
    year: '2026',
    caption: '在IFAD顶楼一块儿聊天，突然看到好看树影走过去拍，拍完回来暗自希望你看到了我的绝美构图并觉得我这小孩儿很会拍照',
  },
  '/media/img_v3_0212d_e7df2920-b722-4544-acbb-2c5c436c1c7g.jpg': {
    city: '🫥',
    year: '2026',
    caption: '这天你和小羊去看电影了！我俩和情姐施宇站在地铁轨道两遍，刚刚和你分开，不高兴😒',
  },
  '/media/img_v3_0212d_e8d789fa-91ed-46bf-8a1e-00414b10356g.png': {
    city: '不着家的瓜娃子',
    year: '2026',
    caption: '被指了 开心 截图截图',
  },
};

export function sceneForSeat(seatId: string) {
  return PROGRAM_SCENES.find((scene) => scene.seatId === seatId);
}

export function stillCaptionForSrc(src?: string): StillCaption | null {
  if (!src) {
    return null;
  }

  return STILL_CAPTIONS[src] ?? null;
}

export function resolveShowAct({
  preShowComplete,
  collectedCount,
  backstageVisited,
  enteredAuditorium,
}: {
  preShowComplete: boolean;
  collectedCount: number;
  backstageVisited: boolean;
  enteredAuditorium: boolean;
}): ShowAct {
  if (!preShowComplete) {
    return 'preshow';
  }

  if (backstageVisited) {
    return 'backstage';
  }

  if (collectedCount > 0 || enteredAuditorium) {
    return 'auditorium';
  }

  return 'lobby';
}
