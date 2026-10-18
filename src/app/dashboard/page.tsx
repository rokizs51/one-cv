import { redirect } from 'next/navigation';
import DashboardApp from '@/components/dashboard/dashboard-app';
import AppShell from '@/components/shell/app-shell';
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
    <AppShell email={user.email ?? undefined}>
      <DashboardApp />
    </AppShell>
  );
}
