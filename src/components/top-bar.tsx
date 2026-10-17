import Link from 'next/link';
import SignOutButton from './sign-out-button';

const linkCls =
  'text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';

/**
 * Shared top bar for authenticated pages (dashboard, profile, generate).
 * Wordmark links home; sign-out is the quiet right-hand action.
 */
export default function TopBar() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          ResumeTailor
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/settings" className={linkCls}>
            Settings
          </Link>
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
