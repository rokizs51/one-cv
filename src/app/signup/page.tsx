import SignupForm from './signup-form';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your details to get started
          </p>
        </div>
        <SignupForm />
        <div className="text-center text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Already have an account? </span>
          <a
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
