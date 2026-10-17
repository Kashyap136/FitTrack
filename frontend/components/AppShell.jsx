'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { initials, avatarPalette } from '@/lib/format';
import { useEffect, useState } from 'react';

const NAV_LINKS = [
  { href: '/feed', label: 'Feed', icon: '📣' },
  { href: '/workout/log', label: 'Log workout', icon: '💪' },
  { href: '/challenges', label: 'Challenges', icon: '🏆' },
  { href: '/leaderboard', label: 'Leaderboard', icon: '📈' },
  { href: '/profile', label: 'Profile', icon: '👤' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

function NavLink({ href, label, icon, isActive }) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[11px] font-medium transition lg:flex-row lg:items-center lg:justify-center lg:gap-1.5 lg:px-2 lg:py-1.5 lg:text-sm ${
        isActive
          ? 'bg-accent text-accent-ink shadow-[0_1px_0_rgba(17,19,16,0.12)_inset]'
          : 'text-ink-soft hover:bg-surface-sunken hover:text-ink'
      }`}
    >
      <span aria-hidden="true" className="text-base lg:text-sm">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

/** Routes that own the full screen; the tab bar would compete with their CTAs. */
const FULL_SCREEN_ROUTES = ['/login', '/register'];

function isActivePath(pathname, href) {
  if (!pathname) return false;
  if (href === '/profile') return pathname === '/profile' || pathname.startsWith('/profile/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Global navigation and shell. The header shows the current user, the bottom
 * bar keeps the app usable on mobile (320px+). */
export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  const palette = avatarPalette(user?.handle || user?.name || '');

  // Close the account menu whenever the route changes. Adjusting state during
  // render (rather than in an effect) is React's recommended reset pattern and
  // avoids a cascading re-render after navigation.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const profileHref = user?.handle ? `/profile/${user.handle}` : '/profile';
  const showMobileNav = !FULL_SCREEN_ROUTES.includes(pathname);

  return (
    <div className={`flex min-h-screen flex-col ${showMobileNav ? 'pb-20 lg:pb-0' : ''}`}>
      <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
          <Link
            href={isAuthenticated ? '/feed' : '/'}
            className="flex min-w-0 items-center gap-2.5"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-[0_1px_0_rgba(17,19,16,0.12)_inset]">
              <span aria-hidden="true" className="text-lg">
                FT
              </span>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold leading-tight sm:text-base">
                FitTrack Community
              </span>
              <span className="hidden text-[11px] leading-none text-ink-soft sm:block">
                Build the habit. Share the wins.
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-2xl border border-line bg-surface px-1 py-1 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] lg:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                isActive={isActivePath(pathname, link.href)}
              />
            ))}
          </nav>

          <div className="relative flex shrink-0 items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex max-w-[10rem] items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-1 pr-2.5 text-left shadow-sm transition hover:bg-surface-sunken sm:max-w-none sm:px-2.5"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-semibold uppercase shadow-[0_1px_0_rgba(255,255,255,0.25)_inset]"
                    style={{
                      backgroundColor: palette[1],
                      color: palette[0],
                      border: '1px solid color-mix(in srgb, var(--color-line), transparent 40%)',
                    }}
                  >
                    {initials(user.name, user.handle)}
                  </span>
                  <div className="hidden min-w-0 flex-col leading-none sm:flex">
                    <span className="truncate text-sm font-semibold">{user.name}</span>
                    <span className="truncate text-xs text-ink-soft">@{user.handle}</span>
                  </div>
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
                    <div className="flex flex-col gap-1 px-2 py-2">
                      <Link
                        href={profileHref}
                        onClick={() => setMenuOpen(false)}
                        className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-surface-sunken"
                      >
                        View profile
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-surface-sunken"
                      >
                        Settings
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          handleLogout();
                        }}
                        className="rounded-xl px-3 py-2 text-left text-sm font-medium text-danger hover:bg-surface-sunken"
                      >
                        Log out
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-2xl border border-line bg-surface px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-surface-sunken"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-2xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow-[0_1px_0_rgba(17,19,16,0.12)_inset] transition hover:bg-accent-deep"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-3 pb-6 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
        {children}
      </main>

      {showMobileNav ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
          aria-label="Primary"
        >
          <div className="mx-auto grid max-w-6xl grid-cols-6 gap-0.5 px-1 py-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                isActive={isActivePath(pathname, link.href)}
              />
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}