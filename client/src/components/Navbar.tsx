import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import {
  getActiveSection,
  getSecondaryNav,
  isMainItemActive,
  isSecondaryItemActive,
  MAIN_NAV_ITEMS,
  MOBILE_BOTTOM_TABS,
  type AppSection,
  type MainNavItem,
} from '../lib/navigation';

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m14.5 14.5 3 3m-1.5-8A6.5 6.5 0 1 1 3 9.5a6.5 6.5 0 0 1 13 0Z" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z" clipRule="evenodd" />
    </svg>
  );
}

function buildProfileTarget(isLoggedIn: boolean): string {
  return isLoggedIn ? '/profile' : '/login';
}

function MainNavLink({
  item,
  pathname,
}: {
  item: MainNavItem;
  pathname: string;
}) {
  const active = isMainItemActive(item, pathname);

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={`group relative px-1 py-3 text-sm font-medium transition-colors duration-200 ${
        active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
      }`}
    >
      <span>{item.label}</span>
      <span
        className={`absolute inset-x-0 bottom-0 h-px origin-center rounded-full bg-emerald-400 transition-all duration-200 ${
          active ? 'scale-x-100 opacity-100 shadow-[0_0_12px_rgba(52,211,153,0.55)]' : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-70'
        }`}
      />
    </NavLink>
  );
}

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [desktopSearch, setDesktopSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');
  const [openMobileGroups, setOpenMobileGroups] = useState<Partial<Record<AppSection, boolean>>>({});

  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = getActiveSection(location.pathname);
  const secondaryNav = useMemo(() => getSecondaryNav(activeSection), [activeSection]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q') ?? '';
    setDesktopSearch(query);
    setMobileSearch(query);
  }, [location.search]);

  useEffect(() => {
    setDrawerOpen(false);
    setUserMenuOpen(false);
    setMobileSearchOpen(false);

    if (activeSection) {
      setOpenMobileGroups((prev) => ({ ...prev, [activeSection]: true }));
    }
  }, [location.pathname, location.search, location.hash, activeSection]);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 16);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  async function handleLogout() {
    setUserMenuOpen(false);
    setDrawerOpen(false);
    await logout();
  }

  function handleSearchSubmit(event: FormEvent, source: 'desktop' | 'mobile') {
    event.preventDefault();
    const query = (source === 'desktop' ? desktopSearch : mobileSearch).trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
    if (source === 'mobile') {
      setMobileSearchOpen(false);
    }
  }

  function toggleGroup(section: AppSection) {
    setOpenMobileGroups((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  const bottomTabs = MOBILE_BOTTOM_TABS.map((item) => ({
    ...item,
    to: item.section === 'profil' ? buildProfileTarget(Boolean(user)) : item.to,
  }));

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b border-white/8 transition-all duration-200 ${
          scrolled
            ? 'bg-slate-950/90 backdrop-blur-2xl shadow-[0_12px_40px_rgba(2,6,23,0.45)]'
            : 'bg-[linear-gradient(180deg,rgba(8,15,28,0.88),rgba(8,15,28,0.72))] backdrop-blur-xl'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center gap-3">
            <button
              onClick={() => setDrawerOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-white/20 hover:bg-white/10 lg:hidden"
              aria-label="Navigasyon menusu"
            >
              <MenuIcon open={drawerOpen} />
            </button>

            <NavLink to="/" className="flex min-w-0 items-center gap-3">
              <img src="/logo.png" alt="BetGuess" className="h-10 w-10 rounded-2xl border border-emerald-400/25 shadow-[0_0_24px_rgba(16,185,129,0.18)]" />
              <div className="min-w-0">
                <div className="truncate text-lg font-black tracking-tight text-white">BetGuess</div>
                <div className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300 sm:inline-flex">
                  Akilli Tahminler
                </div>
              </div>
            </NavLink>

            <nav className="ml-6 hidden items-center gap-7 lg:flex">
              {MAIN_NAV_ITEMS.map((item) => (
                <MainNavLink key={item.id} item={item} pathname={location.pathname} />
              ))}
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className={`group relative px-1 py-3 text-sm font-medium transition-colors duration-200 ${
                    activeSection === 'admin' ? 'text-amber-300' : 'text-amber-200/70 hover:text-amber-200'
                  }`}
                >
                  <span>Admin</span>
                  <span
                    className={`absolute inset-x-0 bottom-0 h-px rounded-full bg-amber-300 transition-all duration-200 ${
                      activeSection === 'admin' ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'
                    }`}
                  />
                </NavLink>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <form
                onSubmit={(event) => handleSearchSubmit(event, 'desktop')}
                className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] xl:flex"
              >
                <SearchIcon />
                <input
                  value={desktopSearch}
                  onChange={(event) => setDesktopSearch(event.target.value)}
                  placeholder="Takim, oyuncu, mac ara..."
                  className="w-56 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
              </form>

              <button
                onClick={() => setMobileSearchOpen((value) => !value)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 xl:hidden"
                aria-label="Arama"
              >
                <SearchIcon />
              </button>

              {user && <NotificationBell />}

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((value) => !value)}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition hover:border-white/20 hover:bg-white/10"
                    aria-label="Kullanici menusu"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-sm font-bold text-slate-950">
                      {user.username.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="hidden min-w-0 md:block">
                      <div className="truncate text-sm font-semibold text-white">{user.username}</div>
                      <div className="text-xs text-slate-400">{isAdmin ? 'Admin' : 'Hesabim'}</div>
                    </div>
                    <ChevronIcon open={userMenuOpen} />
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="navbar-dropdown">
                        <div className="navbar-dropdown-header">
                          <p className="navbar-dropdown-email">{user.email}</p>
                          <span className={`navbar-dropdown-role ${isAdmin ? 'role-admin' : 'role-user'}`}>
                            {isAdmin ? 'Admin' : 'Kullanici'}
                          </span>
                        </div>
                        <button onClick={() => navigate('/profile')} className="navbar-dropdown-settings">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                          </svg>
                          Profil ve Ayarlar
                        </button>
                        <div className="navbar-dropdown-divider" />
                        <button onClick={handleLogout} className="navbar-dropdown-logout">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M3 3a1 1 0 0 0-1 1v12a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1Zm10.293 9.293a1 1 0 0 0 1.414 1.414l3-3a1 1 0 0 0 0-1.414l-3-3a1 1 0 1 0-1.414 1.414L14.586 9H7a1 1 0 1 0 0 2h7.586l-1.293 1.293Z" clipRule="evenodd" />
                          </svg>
                          Cikis Yap
                        </button>
                      </div>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    </>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10 md:inline-flex"
                >
                  Giris Yap
                </Link>
              )}
            </div>
          </div>

          {mobileSearchOpen && (
            <div className="border-t border-white/8 pb-3 pt-3 xl:hidden">
              <form
                onSubmit={(event) => handleSearchSubmit(event, 'mobile')}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300"
              >
                <SearchIcon />
                <input
                  value={mobileSearch}
                  onChange={(event) => setMobileSearch(event.target.value)}
                  placeholder="Takim, oyuncu, mac ara..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
              </form>
            </div>
          )}

          {secondaryNav.length > 0 && (
            <div className="hidden border-t border-white/8 lg:block">
              <nav className="flex h-12 items-center gap-2 overflow-x-auto scrollbar-none">
                {secondaryNav.map((item) => {
                  const active = isSecondaryItemActive(item, location.pathname, location.search, location.hash);
                  return (
                    <NavLink
                      key={item.id}
                      to={item.to}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                          : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
                      }`}
                    >
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </header>

      {drawerOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-[min(22rem,88vw)] overflow-y-auto border-r border-white/10 bg-slate-950/95 px-4 pb-28 pt-4 shadow-[0_24px_80px_rgba(2,6,23,0.6)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-lg font-black text-white">BetGuess</div>
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Akilli Tahminler</div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200"
                aria-label="Menüyü kapat"
              >
                <MenuIcon open />
              </button>
            </div>

            <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-3">
              <form onSubmit={(event) => handleSearchSubmit(event, 'mobile')} className="flex items-center gap-2">
                <SearchIcon />
                <input
                  value={mobileSearch}
                  onChange={(event) => setMobileSearch(event.target.value)}
                  placeholder="Takim, oyuncu, mac ara..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
              </form>
            </div>

            <div className="space-y-3">
              {MAIN_NAV_ITEMS.map((item) => {
                const groupOpen = openMobileGroups[item.id] ?? activeSection === item.id;
                const subitems = getSecondaryNav(item.id);
                const active = isMainItemActive(item, location.pathname);

                return (
                  <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03]">
                    <div className="flex items-center justify-between px-3 py-3">
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        className={`text-sm font-semibold transition-colors ${
                          active ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {item.label}
                      </NavLink>
                      {subitems.length > 0 ? (
                        <button
                          onClick={() => toggleGroup(item.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"
                          aria-label={`${item.label} alt menusunu ac`}
                        >
                          <ChevronIcon open={groupOpen} />
                        </button>
                      ) : null}
                    </div>
                    {subitems.length > 0 && groupOpen && (
                      <div className="border-t border-white/8 px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {subitems.map((subitem) => {
                            const subActive = isSecondaryItemActive(subitem, location.pathname, location.search, location.hash);
                            return (
                              <NavLink
                                key={subitem.id}
                                to={subitem.to}
                                className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                                  subActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
                                }`}
                              >
                                {subitem.label}
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {isAdmin && (
                <NavLink
                  to="/admin"
                  className="flex items-center rounded-2xl border border-amber-300/15 bg-amber-300/8 px-3 py-3 text-sm font-semibold text-amber-200"
                >
                  Admin
                </NavLink>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3">
              {user ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-sm font-bold text-slate-950">
                      {user.username.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{user.username}</div>
                      <div className="truncate text-xs text-slate-400">{user.email}</div>
                    </div>
                    <NotificationBell />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <NavLink to="/profile" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-slate-100">
                      Profil
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm font-medium text-red-300"
                    >
                      Cikis
                    </button>
                  </div>
                </>
              ) : (
                <NavLink
                  to="/login"
                  className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white"
                >
                  Giris Yap
                </NavLink>
              )}
            </div>
          </aside>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-slate-950/90 backdrop-blur-2xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {bottomTabs.map((item) => {
            const active =
              item.section === 'profil'
                ? location.pathname === item.to
                : getActiveSection(location.pathname) === item.section;

            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === '/'}
                className={`flex flex-col items-center justify-center gap-1 px-1 py-3 text-[11px] font-medium transition-colors ${
                  active ? 'text-emerald-300' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full transition-all ${active ? 'bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.75)]' : 'bg-transparent'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
