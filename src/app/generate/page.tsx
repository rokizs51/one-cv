import GenerateWizard from '@/components/generate-wizard';

export default function GeneratePage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            New tailored CV
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Paste a job description and we&apos;ll build a one-page CV from what
            you&apos;ve recorded in your profile.
          </p>
        </header>
        <GenerateWizard />
      </div>
    </main>
  );
}
