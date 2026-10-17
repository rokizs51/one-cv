import { redirect } from 'next/navigation';
import DashboardApp from '@/components/dashboard/dashboard-app';
import TopBar from '@/components/top-bar';
import { getSessionUser } from '@/lib/auth/session';

// Session-reading pages must block on the server so the guard can
// redirect before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

export default async function DashboardPage() {
  // Page-level guard (defense-in-depth alongside the proxy): the dashboard —
  // like every authenticated surface — is private by default.
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <TopBar />
      <DashboardApp />
    </div>
  );
}
