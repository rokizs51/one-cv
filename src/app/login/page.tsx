import Link from 'next/link';
import { redirect } from 'next/navigation';
import LoginForm from './login-form';
import { Wordmark } from '@/components/brand/wordmark';
import { getSessionUser } from '@/lib/auth/session';

// Session-reading pages must block on the server so the guard can
// redirect before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

export default async function LoginPage() {
  // Signed-in users have no business on the auth screens.
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Wordmark className="mb-6 block text-2xl" />
        <div className="bg-surface p-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
            <p className="mt-2 text-sm text-mute">Sign in to your account to continue</p>
          </div>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
        <p className="mt-6 text-center text-sm">
          <span className="text-mute">Don&apos;t have an account? </span>
          <Link href="/signup" className="font-medium text-primary transition-colors hover:text-primary-press">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
