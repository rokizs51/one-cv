import { redirect } from 'next/navigation';
import LoginForm from './login-form';
import { getSessionUser } from '@/lib/auth/session';

// Session-reading pages must block on the server so the guard can
// redirect before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

export default async function LoginPage() {
  // Signed-in users have no business on the auth screens.
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to your account to continue
          </p>
        </div>
        <LoginForm />
        <div className="text-center text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Don't have an account? </span>
          <a
            href="/signup"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Sign up
          </a>
        </div>
      </div>
    </div>
  );
}
