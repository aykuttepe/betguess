export type AppSection = 'tahminler' | 'canli' | 'istatistikler' | 'forum' | 'admin';

export interface MainNavItem {
  id: AppSection;
  label: string;
  to: string;
}

export interface SecondaryNavItem {
  id: string;
  label: string;
  to: string;
  match: (pathname: string, search: string, hash: string) => boolean;
}

export interface MobileTabItem {
  id: string;
  label: string;
  to: string;
  section: AppSection | 'profil';
}

const TAHMINLER_PATHS = ['/', '/sistem', '/kuponlarim', '/sonuclar'];
const ISTATISTIK_PATHS = [
  '/search',
  '/standings',
  '/values',
  '/team-detail',
  '/player',
  '/tournaments',
  '/history',
];

function matchPath(pathname: string, path: string): boolean {
  return pathname === path;
}

export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { id: 'tahminler', label: 'Tahminler', to: '/' },
  { id: 'canli', label: 'Canli', to: '/live' },
  { id: 'istatistikler', label: 'Istatistikler', to: '/search' },
  { id: 'forum', label: 'Forum', to: '/forum' },
];

export const SECONDARY_NAV_ITEMS: Record<Exclude<AppSection, 'canli' | 'admin' | 'forum'>, SecondaryNavItem[]> = {
  tahminler: [
    { id: 'kolon', label: 'Kolon', to: '/', match: (pathname) => matchPath(pathname, '/') },
    { id: 'sistem', label: 'Sistem', to: '/sistem', match: (pathname) => matchPath(pathname, '/sistem') },
    { id: 'kuponlarim', label: 'Kuponlarim', to: '/kuponlarim', match: (pathname) => matchPath(pathname, '/kuponlarim') },
    { id: 'sonuclar', label: 'Sonuclar', to: '/sonuclar', match: (pathname) => matchPath(pathname, '/sonuclar') },
  ],
  istatistikler: [
    { id: 'ara', label: 'Ara', to: '/search', match: (pathname) => matchPath(pathname, '/search') },
    { id: 'puan-durumu', label: 'Puan Durumu', to: '/standings', match: (pathname) => matchPath(pathname, '/standings') },
    { id: 'degerler', label: 'Degerler', to: '/values', match: (pathname) => matchPath(pathname, '/values') },
    { id: 'takimlar', label: 'Takimlar', to: '/team-detail', match: (pathname) => matchPath(pathname, '/team-detail') },
    { id: 'oyuncular', label: 'Oyuncular', to: '/player', match: (pathname) => matchPath(pathname, '/player') },
    { id: 'turnuvalar', label: 'Turnuvalar', to: '/tournaments', match: (pathname) => matchPath(pathname, '/tournaments') },
    { id: 'gecmis-analiz', label: 'Gecmis Analiz', to: '/history', match: (pathname) => matchPath(pathname, '/history') },
  ],
};

export const MOBILE_BOTTOM_TABS: MobileTabItem[] = [
  { id: 'ana-sayfa', label: 'Ana Sayfa', to: '/', section: 'tahminler' },
  { id: 'canli', label: 'Canli', to: '/live', section: 'canli' },
  { id: 'tahminler', label: 'Tahminler', to: '/sistem', section: 'tahminler' },
  { id: 'forum', label: 'Forum', to: '/forum', section: 'forum' },
  { id: 'profil', label: 'Profil', to: '/profile', section: 'profil' },
];

export function getActiveSection(pathname: string): AppSection | null {
  if (pathname.startsWith('/forum')) return 'forum';
  if (pathname === '/live') return 'canli';
  if (pathname === '/admin') return 'admin';
  if (TAHMINLER_PATHS.includes(pathname)) return 'tahminler';
  if (ISTATISTIK_PATHS.includes(pathname)) return 'istatistikler';
  return null;
}

export function getSecondaryNav(section: AppSection | null): SecondaryNavItem[] {
  if (!section || section === 'canli' || section === 'admin' || section === 'forum') {
    return [];
  }

  return SECONDARY_NAV_ITEMS[section];
}

export function isSecondaryItemActive(
  item: SecondaryNavItem,
  pathname: string,
  search: string,
  hash: string,
): boolean {
  return item.match(pathname, search, hash);
}

export function isMainItemActive(item: MainNavItem, pathname: string): boolean {
  return getActiveSection(pathname) === item.id;
}
