import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Scissors } from '@phosphor-icons/react/ssr';
import SignupForm from './signup-form';
import { getSessionUser } from '@/lib/auth/session';

// Session-reading pages must block on the server so the guard can
// redirect before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

export default async function SignupPage() {
  // Signed-in users have no business on the auth screens.
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-wash-violet via-background to-wash-teal px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-sm font-semibold tracking-tight text-ink">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-bar-blue to-bar-violet text-white"
          >
            <Scissors size={17} weight="bold" />
          </span>
          ResumeTailor
        </div>
        <div className="rounded-3xl border border-line bg-surface p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Create your account</h1>
            <p className="mt-2 text-sm text-mute">Enter your details to get started</p>
          </div>
          <div className="mt-8">
            <SignupForm />
          </div>
        </div>
        <p className="mt-6 text-center text-sm">
          <span className="text-mute">Already have an account? </span>
          <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary-press">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
