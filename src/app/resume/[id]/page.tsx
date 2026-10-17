import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getResume } from '@/lib/db/resumes';
import { getJd } from '@/lib/db/jds';
import TopBar from '@/components/top-bar';
import ResumeEditor from '@/components/resume/resume-editor';

// Session-reading page — must block server-side so the guard can redirect
// before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ResumePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const cookieStore = await cookies();
  const supabase = await createRouteClient(cookieStore);
  const resume = await getResume(supabase, id);
  if (!resume) notFound();
  const jd = await getJd(supabase, resume.jdId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <TopBar />
      <main className="px-4 py-10">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="sr-only">Resume preview</h1>
          <ResumeEditor resume={resume} extraction={jd?.extraction ?? null} />
        </div>
      </main>
    </div>
  );
}
