'use client';

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  List,
  House,
  Sparkle,
  UserCircle,
  Gear,
  ArrowsLeftRight,
  X,
  Scissors,
} from '@phosphor-icons/react';
import SignOutButton from '@/components/sign-out-button';

const COLLAPSE_KEY = 'sidebar-collapsed';
const COLLAPSE_EVENT = 'sidebar-collapsed-change';

// Owner's collapse preference lives in localStorage — an external store.
// useSyncExternalStore (not an effect + setState) keeps hydration correct:
// server renders expanded, the client snapshot takes over right after.
function subscribeCollapsed(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(COLLAPSE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(COLLAPSE_EVENT, onChange);
  };
}
function getCollapsedSnapshot() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}
function getCollapsedServerSnapshot() {
  return false;
}

/**
 * App shell for every authenticated surface: a collapsible grouped sidebar
 * on desktop, a slide-over drawer behind a sticky top bar on mobile.
 * Nav is grouped by domain (Workspace / Account); sign-out lives at the
 * bottom, visually separated from routine destinations.
 */
const NAV_GROUPS = [
  {
    title: 'Workspace',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: House },
      { href: '/generate', label: 'New CV', icon: Sparkle },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/profile', label: 'Profile', icon: UserCircle },
      { href: '/settings', label: 'Settings', icon: Gear },
    ],
  },
] as const;

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          {!collapsed && (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
              {group.title}
            </p>
          )}
          <ul className="space-y-1">
            {group.links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? label : undefined}
                    className={
                      'flex min-h-10 items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors ' +
                      (active
                        ? 'bg-wash-blue font-medium text-tone-blue'
                        : 'text-mute hover:bg-surface-2 hover:text-ink') +
                      (collapsed ? ' justify-center px-0' : '')
                    }
                  >
                    <Icon aria-hidden weight={active ? 'fill' : 'regular'} className="shrink-0" size={20} />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Wordmark() {
  return (
    <Link
      href="/dashboard"
      className="flex min-h-10 items-center gap-2.5 rounded-full px-3 py-2 transition-colors hover:bg-surface-2"
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-bar-blue to-bar-violet text-white"
      >
        <Scissors size={16} weight="bold" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-ink">ResumeTailor</span>
    </Link>
  );
}

export default function AppShell({ children, email }: { children: ReactNode; email?: string }) {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, getCollapsedSnapshot() ? '0' : '1');
      window.dispatchEvent(new Event(COLLAPSE_EVENT));
    } catch {
      /* storage unavailable — the toggle is just session-local */
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside
        className={
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface lg:flex ' +
          (collapsed ? 'w-[76px]' : 'w-60')
        }
      >
        <div className="px-2 pt-3">
          {collapsed ? (
            <Link
              href="/dashboard"
              title="ResumeTailor"
              className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-bar-blue to-bar-violet text-white transition-colors hover:brightness-95 mx-auto"
            >
              <Scissors aria-hidden size={18} weight="bold" />
            </Link>
          ) : (
            <Wordmark />
          )}
        </div>
        <NavLinks collapsed={collapsed} />
        <div className="border-t border-line px-3 py-3">
          <SignOutButton variant="nav" compact={collapsed} />
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          className="mx-3 mb-3 flex min-h-10 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm text-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ArrowsLeftRight aria-hidden size={18} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      {/* Mobile sticky top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface px-4 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex size-10 items-center justify-center rounded-full text-mute transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <List aria-hidden size={22} />
        </button>
        <Wordmark />
        <span className="size-10" aria-hidden />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface shadow-xl">
            <div className="flex items-center justify-between px-2 pt-3">
              <Wordmark />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="mr-2 flex size-10 items-center justify-center rounded-full text-mute transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X aria-hidden size={20} />
              </button>
            </div>
            <NavLinks collapsed={false} onNavigate={() => setDrawerOpen(false)} />
            <div className="border-t border-line px-3 py-3">
              <SignOutButton variant="nav" onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {email && (
          <div className="hidden justify-end px-6 pt-4 text-xs text-faint lg:flex">
            {email}
          </div>
        )}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
