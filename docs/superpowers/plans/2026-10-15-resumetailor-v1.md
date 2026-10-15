# ResumeTailor v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web app where a user records their full professional profile once, pastes a job description, and exports a tailored, one-page, ATS-clean CV — in as-is (curation only) or enhance (rewrite-suggestions) mode.

**Architecture:** Next.js App Router fullstack app. Supabase provides Postgres + auth + RLS; all DB reads/writes go through repository functions in `src/lib/db/` using the user's session (never the service key). AI lives behind one `GenAI` interface (`src/lib/ai/`) so extraction/enhance/summary calls are fakeable in tests and swappable in prod. The resume is a JSON document (`ResumeDoc`) rendered by one `@react-pdf/renderer` component — preview and exported PDF are the same component. Page fit is computed by a deterministic heuristic engine (`src/lib/resume/fit.ts`) re-run on every edit.

**Tech Stack:** Node 22+, pnpm, Next.js (latest stable, TS strict), Tailwind, Vitest + @testing-library/react, @react-pdf/renderer + pdf-lib (page-count assertions in tests), @supabase/supabase-js + @supabase/ssr, zod, Vercel AI SDK (`ai` + one provider package) behind env model IDs.

**Spec:** `docs/superpowers/specs/2026-10-15-resume-tailor-design.md` — read it with this plan; the plan argues from it.

## Global Constraints

- Node >= 22, pnpm, TypeScript `strict: true`. Latest stable packages; pin exact versions at install time in the lockfile.
- LLM API keys and provider only via server env: `AI_PROVIDER`, `AI_MODEL_EXTRACTION`, `AI_MODEL_ENHANCE`, `AI_MONTHLY_COST_MICROUSD_CEILING` (default 2_000_000 = $2/mo). Keys must never appear in client bundles.
- No translation anywhere; single ATS-clean template; one page by default with a per-generation 2-page toggle.
- Invite-gated signup only; 50 generations/user/month cap; budget-mode circuit breaker is server-side and never silently degrades a user experience — the UI must show the honest notice.
- Anti-goals are rules: never export unaccepted suggestions; never drop or overwrite user material silently (cuts visible, profile text changes only via accept with provenance, reverts available).
- Copy tone: plain language, no markdown/JSON exposed in the user path.
- Tests run with `pnpm test` (Vitest). Route handlers are tested by importing the handler and calling it with `Request` objects and injected fakes. DB/RLS correctness is verified in the Task 3 manual step against the dev Supabase project.

## UI Design (owner-provided reference — applies to all UI tasks)

**Direction: minimalist, fintech-UI inspired.** Clean, functional, approachable. Strong typography and generous whitespace. Neutral color palette with high-contrast primary actions. Clear transaction lists and easy-to-read financial summaries — translated to this app: the version list, profile section lists, JD chip row, and match panel are the "transactions/summaries," and they must scan at a glance. Simple charts that communicate insights without visual clutter — v1 has no charts; the spirit governs completeness hints, the fit badge, and cut lists. Subtle borders, restrained card usage, consistent spacing. Responsive layout optimized for mobile, polished desktop. **Avoid**: excessive gradients, glassmorphism, glowing cards, generic SaaS dashboard aesthetics. Goal: effortless, understandable, quick.

Builder rules (my translation, owner veto): Tailwind `neutral`/`zinc` scale + exactly **one accent color reserved for primary actions** (Generate, Accept, Download PDF); destructive actions (Reject, Delete account) get a distinct muted warning tone, never the accent; system font stack; 8px spacing rhythm; cards only for the version list and preview frame; max shadow `shadow-sm`. **Exempt from all of this: the rendered resume PDF (Task 9)** — that stays plain, single-column, ATS-strict; the fintech aesthetic governs the app chrome, never the document a recruiter reads (my call, consistent with the spec's single-template constraint). Vibe, one line: a calculator, not a carnival. Every UI task (5, 7, 11, 12, 13, 14) follows this section.

## Review Focus

The spec implies these inputs/failures; no other task tests them, so each line is pinned by a test in the owning task:

1. **Incomplete profile** (no career_snapshot, empty awards) must still generate a valid CV — summary section is skipped, not fabricated. *(Task 10)*
2. **Junk JD** (a sentence, spam, paste of a meme) — extraction returns a typed, retryable 400 "this doesn't look like a job description", never a 500 and never a garbage CV. *(Task 7)*
3. **Pinned content alone exceeds one page** — the API/UI report "won't fit" honestly and require un-pinning or the 2-page toggle; nothing is dropped. *(Task 9 engine, Task 12 UI)*
4. **Expired session during generate/export** — API returns 401; UI redirects to login preserving the pasted JD text. *(Task 10)*
5. **Quota/budget boundary** — the cap and cost-ceiling checks happen *before* any LLM call; breaker tripping mid-generation disables enhance/summary with the visible notice, never a silent as-is downgrade. *(Task 10)*

---

### Task 1: Scaffold app + tooling

**Files:**
- Create: Next.js app at repo root (`pnpm create next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"` — accept non-interactive defaults), `vitest.config.ts`, `vitest.setup.ts`, `src/app/layout.tsx` (title/meta only)
- Modify: `package.json` (scripts), `tsconfig.json` (ensure `strict: true`)

**Interfaces:**
- Consumes: nothing.
- Produces: working `pnpm dev`, `pnpm test` (Vitest, jsdom env, `@testing-library` registered), `pnpm build` clean; alias `@/ -> src/`.

- [ ] **Step 1: Scaffold** — run the create command above; `pnpm add -D vitest vitest-fail-on-console @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @types/node`; `pnpm add zod @supabase/supabase-js @supabase/ssr @react-pdf/renderer pdf-lib ai`.
- [ ] **Step 2: Configure Vitest** — `vitest.config.ts`: react plugin, `test: { environment: 'jsdom', setupFiles: ['vitest.setup.ts'], include: ['src/**/*.test.{ts,tsx}'] }`; setup imports `@testing-library/jest-dom/vitest`. Add `"test": "vitest run"`, `"test:watch": "vitest"` to scripts.
- [ ] **Step 3: Prove the toolchain** — create `src/smoke.test.ts` with one trivial assertion; run `pnpm test` (expect PASS) and `pnpm build` (expect success). Delete `src/smoke.test.ts` after passing? **No** — rename to `src/tooling.test.ts` asserting `expect(1).toBe(1)` with comment "toolchain smoke"; keep.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "chore: scaffold Next.js app with Vitest"`.

### Task 2: Domain types, zod schemas, provenance logic

**Files:**
- Create: `src/lib/domain/types.ts`, `src/lib/domain/schemas.ts`, `src/lib/domain/provenance.ts`
- Test: `src/lib/domain/provenance.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (exact names later tasks import):
  - `type ItemType = 'career_snapshot' | 'education' | 'experience' | 'project' | 'award' | 'skill' | 'language'`
  - `type GenMode = 'as_is' | 'enhance'`
  - `interface ProvenanceEntry { text: string; originalText: string; fromResumeId: string; at: string }`
  - `interface ProfileItem { id: string; profileId: string; type: ItemType; payload: Record<string, unknown>; canonicalText: string; source: 'manual' | 'import'; provenance: ProvenanceEntry[]; pinned: boolean; position: number }`
  - `interface JdExtraction { requiredSkills: string[]; preferredSkills: string[]; keywords: string[]; seniority: string; domain: string; tools: string[]; responsibilities: string[] }` + `JdExtractionSchema` (zod, camelCase keys)
  - `type SectionId = 'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'awards' | 'languages'`
  - `interface Suggestion { id: string; targetItemId: string; kind: 'bullet' | 'summary'; newText: string; basis: string }`, `type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'edited'`, `interface SuggestionState { suggestion: Suggestion; status: SuggestionStatus; finalText: string | null }`
  - `interface ResumeDoc { header: ResumeHeader; summary: string | null; sections: ResumeSection[] }`, `interface ResumeHeader { fullName: string; email: string; phone: string | null; location: string | null; links: string[] }`, `interface ResumeSection { id: SectionId; items: ResumeDocItem[] }`, `interface ResumeDocItem { sourceItemId: string; text: string; basis: string }`
  - `provenance.ts`: `applyAccept(prev: ProfileItem, newText: string, fromResumeId: string, at: string): ProfileItem` (sets canonicalText=newText, pushes `{text: newText, originalText: prev.canonicalText, fromResumeId, at}` onto provenance), `revertLast(item: ProfileItem): ProfileItem` (pops last provenance entry, restores its originalText; returns item unchanged if empty).

- [ ] **Step 1: Write failing tests** in `provenance.test.ts`: `applyAccept` keeps chain (two accepts produce 2 entries, originalText of 2nd = text of 1st); `revertLast` restores and pops; `revertLast` on empty provenance is a no-op. Build fixtures via a `makeItem()` helper (export it from the test file; Task 12 re-derives from it).
- [ ] **Step 2: Run, see fail** — `pnpm test src/lib/domain/provenance.test.ts`.
- [ ] **Step 3: Implement** `types.ts`, `schemas.ts` (per-type zod payloads: career_snapshot `{text}`; education `{school, degree, field, startYear, endYear}`; experience `{company, role, start, end, bullets: string[]}`; project `{name, description, tech: string[]}`; award `{title, issuer, year}`; skill `{name, level?: string}`; language `{name, level}` — each exported as `<Type>PayloadSchema`), `provenance.ts` per signatures above.
- [ ] **Step 4: Run, see pass; commit** — `git commit -m "feat: domain types, payload schemas, provenance"` (all of `src/lib/domain/`).

### Task 3: Database migrations, RLS, invites, quota

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `.env.local` (gitignored, values filled by owner), `docs/verify/task-3-rls.md` (manual checklist)

**Interfaces:**
- Consumes: `ItemType`, `GenMode` naming from Task 2 (column constraints must match those string values exactly).
- Produces tables (snake_case, referenced by later repos):
  - `profiles (id uuid pk default gen_random_uuid(), user_id uuid unique not null references auth.users on delete cascade, personal jsonb not null default '{}', created_at, updated_at)` — `personal`: `{full_name, email, phone, location, links[]}`
  - `profile_items (id uuid pk, profile_id references profiles on delete cascade, type text check in the 7 ItemTypes, payload jsonb, canonical_text text not null default '', source text check manual|import, provenance jsonb default '[]', pinned boolean default false, position int default 0)`
  - `job_descriptions (id uuid pk, owner uuid references auth.users on delete cascade, raw text, extraction jsonb, created_at)`
  - `generated_resumes (id uuid pk, owner uuid references auth.users on delete cascade, jd_id uuid references job_descriptions, mode text check as_is|enhance, page_limit int default 1, doc jsonb, suggestions jsonb default '[]', statuses jsonb default '[]', user_edits jsonb default '{}', fit jsonb, created_at, updated_at)`
  - `invites (code text pk, email text, claimed_by uuid references auth.users on delete set null, created_at, claimed_at)`
  - `generation_quota (user_id uuid references auth.users on delete cascade, month text not null, generations int default 0, llm_cost_micros bigint default 0, pk (user_id, month))` — `month` format `'YYYY-MM'`
  - RLS enabled on all: owner checks `owner = auth.uid()` / `user_id = auth.uid()` / `profiles.user_id = auth.uid()` and items via `profile_id in (select id from profiles where user_id = auth.uid())`. `invites` readable only by `anon`? No: claim happens server-side at signup with the new user's id; policy: `select` allowed for `authenticated` self (`claimed_by = auth.uid()`) plus insert allowed for `anon` (needed by signup check) — document both policies explicitly.

- [ ] **Step 1: Write the migration** exactly as the table sketch; include `updated_at` triggers (simple `set_updated_at()` fn).
- [ ] **Step 2: Owner setup steps** (written into `docs/verify/task-3-rls.md`, executed together): create free Supabase project, run `supabase link` + `supabase db push` (CLI or SQL editor paste), seed 2 invite codes with a fixed 12-char value, create disposable test users A and B via the project dashboard.
- [ ] **Step 3: Verify RLS by hand** — checklist with expected outcomes: as A, `select` own profile row succeeds; A querying B's profile_items returns 0 rows (not an error); A cannot insert into `profiles` with B's user_id. Record pass/fail lines in the doc file itself.
- [ ] **Step 4: Commit** — `git commit -m "feat: supabase schema with RLS, invites, quota"`.

### Task 4: Supabase client + repository layer

**Files:**
- Create: `src/lib/db/client.ts` (server `createServerClient` via `@supabase/ssr` + `createBrowserClient` export), `src/lib/db/profiles.ts`, `src/lib/db/items.ts`, `src/lib/db/jds.ts`, `src/lib/db/resumes.ts`, `src/lib/db/invites.ts`, `src/lib/db/quota.ts`, `src/lib/db/mappers.ts`
- Test: `src/lib/db/mappers.test.ts`, `src/lib/db/quota.test.ts`

**Interfaces:**
- Consumes: Task 2 types; Task 3 column names.
- Produces (exact signatures; all `Promise`s; take `supa: SupabaseClient` as first param so route tests inject a fake):
  - `mappers.ts`: `rowToProfileItem(r: DbRow): ProfileItem`, `profileItemToRow(i: ProfileItem): DbRow`
  - `profiles.ts`: `getOrCreateProfile(supa, userId): Promise<Profile>` where `interface Profile { id: string; userId: string; personal: PersonalInfo; }`, `interface PersonalInfo { fullName: string; email: string; phone: string | null; location: string | null; links: string[] }`, `updatePersonal(supa, userId, p: PersonalInfo)`
  - `items.ts`: `listItems(supa, profileId)`, `createItem(supa, profileId, input: { type: ItemType; payload: Record<string, unknown>; canonicalText: string; position?: number })`, `updateItem(supa, itemId, patch: Partial<Pick<ProfileItem, 'payload' | 'canonicalText' | 'pinned' | 'position'>>)` (accepts `null` patch values as no-change), `acceptText(supa, itemId, item: ProfileItem, newText: string, fromResumeId: string) -> ProfileItem` (computes via `applyAccept` then writes `canonical_text` + `provenance`), `revertText(supa, itemId, item: ProfileItem) -> ProfileItem`
  - `jds.ts`: `createJd(supa, userId, raw: string, extraction: JdExtraction): Promise<JobDescription>`, `getJd(supa, jdId)`, `interface JobDescription { id: string; owner: string; raw: string; extraction: JdExtraction; createdAt: string }`
  - `resumes.ts`: `saveResume(supa, userId, input: { jdId; mode: GenMode; pageLimit: 1|2; doc: ResumeDoc; suggestions: Suggestion[]; statuses: SuggestionState[]; userEdits: Record<string, string>; fit: FitResultSnapshot }): Promise<GeneratedResume>`, `updateResumeFields(supa, resumeId, patch)`, `listResumes(supa, userId)`, `getResume(supa, resumeId)`; `interface GeneratedResume extends ResumeFields { id: string; owner: string; createdAt: string; updatedAt: string }`; `FitResultSnapshot` = `Pick<FitResult,'chosen'|'cuts'|'overflow'>` serialized `{itemId, reason, score}[]` shapes — **define it in `src/lib/resume/fit.ts` in Task 9 and re-export; for now type it `FitResultSnapshot = { chosen: string[]; cuts: { itemId: string; reason: 'relevance' | 'space' }[]; overflow: boolean }` and keep identical in Task 9.**
  - `invites.ts`: `claimInvite(supa, code: string, userId: string): Promise<boolean>` (returns false if unknown/claimed), `inviteExists(code: string): Promise<boolean>` for signup validation (server, anon client)
  - `quota.ts`: `currentUsage(supa, userId): Promise<QuotaUsage>`, `interface QuotaUsage { generations: number; llmCostMicros: number }`, `recordGeneration(supa, userId, costMicros: number): Promise<void>` (upsert on (user_id, month)), constants `GENERATIONS_CAP = 50`, `monthKey(now: Date): string` (`'YYYY-MM'` UTC).

- [ ] **Step 1: Failing tests** — `mappers.test.ts`: round-trip row↔ProfileItem (snake↔camel, JSON fields); `quota.test.ts`: `monthKey(new Date('2026-10-15T23:30:00Z')) === '2026-10'`; caps exported values 50 and (from env default) documented.
- [ ] **Step 2: Run, see fail.**
- [ ] **Step 3: Implement** repos as thin typed wrappers over `supa.from(...)`; no logic beyond mappers.
- [ ] **Step 4: Run, see pass; commit** — `git commit -m "feat: db repositories with typed mappers"`.

### Task 5: Auth (invite-gated) + route protection

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/middleware.ts` (`@supabase/ssr` session refresh), `src/lib/auth/session.ts` (`getSessionUser(): Promise<{ id: string; email: string } | null>` server-side), `src/app/api/auth/logout/route.ts`
- Test: `src/lib/auth/session.test.ts`, `src/app/signup/signup-form.test.tsx`

**Interfaces:**
- Consumes: `invites.ts` (Task 4).
- Produces: `getSessionUser()` used by every API route; `POST /api/auth/login`, `POST /api/auth/signup` with body `{ email, password, inviteCode }` → 201, 400 `invalid_invite` (unknown/claimed), 409 `user_exists`; middleware redirects unauthenticated non-`/(login|signup)` paths to `/login`.

- [ ] **Step 1: Failing tests** — `session.test.ts`: null when no cookie header (fake request context); signup form test: submitting without invite code shows inline error and does not call the API (fetch mock).
- [ ] **Step 2: Run, see fail. Step 3: Implement** pages as client components (plain inputs + submit, no JSON anywhere), routes, middleware using `@supabase/ssr` template.
- [ ] **Step 4: Manual check** — `pnpm dev`: sign up with the seeded invite code from Task 3, log out, log back in, second sign-up with same code fails with "This invite code is already used." Record results in commit message.
- [ ] **Step 5: Commit** — `git commit -m "feat: invite-gated auth with session helper"`.

### Task 6: GenAI interface, fake provider, real provider

**Files:**
- Create: `src/lib/ai/types.ts`, `src/lib/ai/fake.ts`, `src/lib/ai/client.ts` (server only), `src/lib/ai/env.ts`
- Test: `src/lib/ai/env.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces:
  - `src/lib/ai/types.ts`: `interface GenAI { extractJd(jdText: string): Promise<JdExtraction>; enhance(req: EnhanceRequest): Promise<Suggestion[]>; composeSummary(req: SummaryRequest): Promise<string> }`, `interface EnhanceRequest { jd: JdExtraction; items: { itemId: string; text: string }[] }`, `interface SummaryRequest { jd: JdExtraction; snapshot: string; facts: string[] }`, `class JdNotParseableError extends Error`
  - `env.ts`: `aiConfig()` → `{ provider, extractionModel, enhanceModel, monthlyCostCeilingMicros }` read from env with defaults (`claude-haiku-class` extraction / `claude-sonnet-class` enhance documented as env values, not hardcoded); `estimateCostMicros(model: string, tokens: { input: number; output: number }): number` using per-model price table read from `PRICING_JSON` env (documented in README task 15; safe default `{}` → estimate 0 + `console.warn` on first call).
  - `client.ts`: implements `GenAI` via `ai` SDK `generateObject` with `JdExtractionSchema`; prompts built from spec rules: extraction = facts-only; enhance = rewrite bullets to mirror JD vocabulary, constrained to provided text, no invented facts; summary = 3 lines max from snapshot+facts only. On schema failure after 1 retry → `JdNotParseableError`.
  - `fake.ts`: `makeFakeGenAI(overrides: Partial<GenAI>): GenAI` returning canned extraction/enhancements per test; records calls: `calls: { extractJd: string[]; enhance: EnhanceRequest[]; composeSummary: SummaryRequest[] }`.

- [ ] **Step 1: Failing test** — `env.test.ts`: `aiConfig()` with empty env throws pointing to names of missing vars; with `AI_MODEL_EXTRACTION` + `AI_MODEL_ENHANCE` set returns them; `estimateCostMicros` returns >0 when `PRICING_JSON` set.
- [ ] **Step 2: Run, fail. Step 3: Implement** all four files.
- [ ] **Step 4: Run, pass; commit** — `git commit -m "feat: swappable GenAI provider behind env config"`.

### Task 7: JD extraction route + chips display

**Files:**
- Create: `src/app/api/jds/extract/route.ts`, `src/components/jd-chips.tsx`
- Test: `src/app/api/jds/extract/route.test.ts`, `src/components/jd-chips.test.tsx`

**Interfaces:**
- Consumes: `getSessionUser`, `GenAI.extractJd`, `jds.createJd`, `quota.currentUsage`, `aiConfig.monthlyCostCeilingMicros`.
- Produces: `POST /api/jds/extract { raw: string } -> 200 { jdId, extraction } | 401 | 400 { code: 'budget_exhausted' } | 400 { code: 'not_a_job_description' } | 400 'too_short' (raw.trim().length < 80)`. `<JdChips extraction={JdExtraction} />` renders required/preferred/tools/keywords as labeled chips, max 24 chips total, overflow `+N`.

- [ ] **Step 1: Failing tests** — route (fake GenAI + injected fake supa via a test `supaStub` helper built in this task and reused by later route tests): valid JD returns extraction and creates a row (fake supa records insert); junk text → fake `extractJd` throws `JdNotParseableError` → assert HTTP 400 `not_a_job_description` with retry-friendly message; **Review Focus 2**: two junk inputs (one word, emoji soup) both produce the same typed 400, no unhandled rejection. chips test: counts, overflow label.
- [ ] **Step 2: Run, fail. Step 3: Implement.** Route order: session -> quota/cost ceiling check (before LLM call) -> length guard -> extract -> persist.
- [ ] **Step 4: Run, pass; commit** — `git commit -m "feat: jd extraction api and chip display"`.

### Task 8: Scoring & section ordering (pure)

**Files:**
- Create: `src/lib/resume/scoring.ts`
- Test: `src/lib/resume/scoring.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces:
  - `interface ScoredItem { item: ProfileItem; score: number; matchedKeywords: string[]; section: SectionId }`
  - `sectionOf(item: ProfileItem): SectionId` (type→section map; career_snapshot→'summary')
  - `keywordScore(item: ProfileItem, jd: JdExtraction): ScoredItem` — case-insensitive, word-boundary match of `requiredSkills`(weight 3), `tools`(2), `preferredSkills`+`keywords`(1) over `canonicalText + JSON values of payload`; deduped `matchedKeywords`.
  - `orderSections(items: ScoredItem[], opts: { earlyCareer: boolean }): ResumeSection[]` — base order `summary, skills, experience, projects, education, awards, languages`; if `earlyCareer` true → `education` moves before `experience`, projects before experience; empty sections omitted.
  - `isEarlyCareer(profile: Profile): boolean` — no experience item with `payload.end` absent-or >= current year minus 2, or graduation within 3 years of today; simple deterministic rule, documented in code.
- [ ] **Step 1: Failing tests** — weights: item mentioning required skill 'Kubernetes' beats one mentioning only 'teamwork' (exact fixture: jd.requiredSkills=['Kubernetes'], keywords=['teamwork']); early-career reorder true/false cases; `matchedKeywords` no dupes.
- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass; commit** — `git commit -m "feat: keyword scoring and ATS section ordering"`.

### Task 9: Fit engine + single resume template + page-count proof

**Files:**
- Create: `src/lib/resume/fit.ts`, `src/lib/resume/render/document.tsx`, `src/lib/resume/render/render.ts`
- Test: `src/lib/resume/fit.test.ts`, `src/lib/resume/render/render.test.ts`

**Interfaces:**
- Consumes: `ScoredItem` (Task 8), `ResumeDoc` types, `FitResultSnapshot` (shape fixed in Task 4 — must match).
- Produces:
  - `fit.ts`: `const PAGE_UNITS: Record<1 | 2, number> = { 1: 78, 2: 156 }` — one unit = one A4 page budgeted as wrapped lines at 10pt single column (78 lines); `estimateLines` counts wrapped lines against this budget. Calibrate once against Task 11's real sample; adjust the two numbers only. `interface FitResult { chosen: ScoredItem[]; cuts: Cut[]; overflow: boolean }`, `interface Cut { item: ScoredItem; reason: 'relevance' | 'space' }`, `estimateLines(item: ProfileItem, width?: number): number`, `fitToPage(scored: ScoredItem[], pageLimit: 1 | 2): FitResult` — algorithm (the one step this plan decides for them): keep pinned first, then sort unpinned by score desc; accumulate until PAGE_UNITS; items dropped by relevance = score below `MIN_SCORE = 2`, reason `space`; pinned that still don't fit → set `overflow: true` and do not drop pinned. `snapshotOf(f: FitResult): FitResultSnapshot`.
  - `document.tsx`: `<ResumeDocument doc={ResumeDoc} pageLimit={1|2} />` — @react-pdf components: `<Document><Page size="A4">` single column, 10pt base, plain headings, no graphics; renders exactly the text in `doc` (source of truth for preview and PDF).
  - `render.ts`: `renderResumePdf(doc: ResumeDoc, pageLimit: 1 | 2): Promise<Uint8Array>` via `renderToBuffer` + `pdf-lib` `PDFDocument.load` + `getPageCount()` helper `pdfPageCount(bytes): number` (dev+test export).
- [ ] **Step 1: Failing tests** — fit: relevance cut below MIN_SCORE even with space left; space cut keeps higher-scoring items; pinned never appears in `cuts`; overflow true when pinned > PAGE_UNITS[1]; 2-page toggle doubles budget. render (node env): build a 1-page `ResumeDoc` fixture → `pdfPageCount` === 1; same doc padded with 25 fake experience bullets → count === 2 (proving renderer detects overflow — the engine, not the renderer, prevents it; assert both).
- [ ] **Step 2: Run, fail. Step 3: Implement.** (Render tests need `environment: 'node'` — add vitest docblock `@vitest-environment node` to render.test.ts.)
- [ ] **Step 4: Run, pass; commit** — `git commit -m "feat: one-page fit engine and react-pdf resume document"`.

### Task 10: Generation orchestration

**Files:**
- Create: `src/app/api/resumes/generate/route.ts`, `src/lib/resume/orchestrate.ts`
- Test: `src/lib/resume/orchestrate.test.ts`, `src/app/api/resumes/generate/route.test.ts`

**Interfaces:**
- Consumes: everything above (`extractJd` route pattern, scoring, fit, repos, `GenAI`, quota).
- Produces:
  - `orchestrate.ts`: `generateResume(deps: OrchestrateDeps, input: GenerateInput): Promise<GeneratedResume>` where `OrchestrateDeps = { supa; ai: GenAI; now: Date; user: {id:string;email:string} }`, `GenerateInput = { jdId: string; mode: GenMode; pageLimit: 1 | 2 }`. Pipeline: load profile+items+jd → score → fit → build `ResumeDoc` (as-is: user's canonicalText verbatim; summary = profile career_snapshot text verbatim in as-is) → if mode enhance (and budget not exhausted): `ai.enhance` for chosen bullets + `ai.composeSummary` from career_snapshot + chosen facts → persist `generated_resumes` (suggestions stored `status: 'pending'`, never part of `doc` until dispositioned), `quota.recordGeneration`. Budget exhausted: enhance unavailable → return with `notice: 'budget'` and fall back internally is forbidden — see Review Focus 5 — instead **throw `GenerationUnavailableError('budget')`** and the route responds 400.
  - `route.ts`: `POST /api/resumes/generate { jdId, mode, pageLimit }` → 201 `{ resume }` | 400 `budget_exhausted` | 400 `not_found` | 401 (also when `getSessionUser` null → **Review Focus 4**). `GET /api/resumes` list, `GET /api/resumes/:id` reuse standard `params`; 404 `not_found`. `QuotaExceededError` when usage >= 50 → 429 `{ code: 'quota' }` *before any LLM call*.
- [ ] **Step 1: Failing tests** — orchestrate with fake AI + supaStub: as-is run makes zero enhance/summary calls and doc text equals canonicalText verbatim (anti-generic + verbatim guarantee); enhance run yields suggestions all `pending` and doc contains original bullets only; accepting later (Task 12) replaces text — assert only that doc is unchanged pre-accept; career_snapshot missing + awards empty: generation succeeds, doc.summary is null, no awards section (**Review Focus 1**); quota boundary: 50th allowed, 51st → `QuotaExceededError`, fake AI `calls.extractJd.length` unchanged after the 51st (**Review Focus 5** pre-LLM); `GenerationUnavailableError` when `supa` stub cost usage above ceiling (**Review Focus 5** mid-mode). route test: 401 without session, 404 unknown jdId (**Review Focus 4**).
- [ ] **Step 2: Run, fail. Step 3: Implement** — keep orchestrate pure (no Next imports).
- [ ] **Step 4: Run, pass; commit** — `git commit -m "feat: generation pipeline with quotas, budget guard, pending suggestions"`.

### Task 11: Generate flow UI

**Files:**
- Create: `src/app/generate/page.tsx`, `src/components/generate-wizard.tsx`
- Test: `src/components/generate-wizard.test.tsx`

**Interfaces:**
- Consumes: `/api/jds/extract` (Task 7), `/api/resumes/generate` (Task 10).
- Produces: URL `/generate`; state machine in `generate-wizard.tsx`: step 1 textarea (paste JD) → `Extract` → chip display + mode radio (As-is / Enhance) + `Page limit: [1|2]` select → `Generate` → on 201 `router.push('/resume/{id}?new=1')`; on 401: persist raw text to sessionStorage key `jd-draft` and redirect `/login` (**Review Focus 4** continuation); on 400/429: inline honest message, no silent retry.

- [ ] **Step 1: Failing tests** — fetch mocks: junk extract shows the returned message and stays on step 1; 401 stores `jd-draft` and navigates to /login (assert via mocked router + sessionStorage).
- [ ] **Step 2: Run, fail. Step 3: Implement.** Step 4: run, pass.
- [ ] **Step 5: Manual pass** — with dev server + real keys in `.env.local`: generate a resume from a real JD (paste one from any job site), note the id, then stop; screenshot optional; results line in commit msg.
- [ ] **Step 6: Commit** — `git commit -m "feat: generate wizard wired to extraction and orchestration"`.

### Task 12: Profile editor + dashboard

**Files:**
- Create: `src/app/profile/page.tsx`, `src/app/dashboard/page.tsx`, `src/components/profile/section-form.tsx`, `src/components/profile/item-editor.tsx`, `src/app/api/profile/route.ts` (personal), `src/app/api/profile/items/route.ts` (CRUD), `src/components/dashboard/version-list.tsx`
- Test: `src/components/profile/item-editor.test.tsx`, `src/app/api/profile/items/route.test.ts`

**Interfaces:**
- Consumes: items/profile repos (Task 4), schemas (Task 2).
- Produces: routes `POST /api/profile/items { type, payload } -> ProfileItem`, `PATCH /api/profile/items/:id`, `DELETE /api/profile/items/:id`; `GET /api/profile/items` for editor. Version compare in v1 = reopening two versions side-by-side in browser tabs (no dedicated diff screen — my scope cut, noted in handoff). `<ItemEditor item onPatch>` renders form per ItemType schema, "Enhanced" provenance badge when `provenance.length > 0` with a Revert button calling `PATCH { revertText: true }`, and Pin toggle calling `PATCH { pinned }`. Dashboard lists completeness hints (sections with 0 items) and `listResumes` with links.

- [ ] **Step 1: Failing tests** — item-editor: two provenance entries → revert calls PATCH once with `{ revertText: true }`; pin toggle sends `{ pinned: true }` without touching canonicalText; route test: PATCH with `{ revertText: true }` invokes `items.revertText` with the stored item; DELETE cascades to nothing else (assert single delete call).
- [ ] **Step 2: Run, fail. Step 3: Implement** (forms use plain labels, validation from zod payloads inline; no markdown/JSON visible).
- [ ] **Step 4: Run, pass; manual:** create one entry of each ItemType on the running app; confirm dashboard counts. Step 5: commit — `git commit -m "feat: profile editor and dashboard with provenance revert and pins"`.

### Task 13: Preview, suggestion review, pins, live cut list, export

**Files:**
- Create: `src/app/resume/[id]/page.tsx`, `src/components/resume/preview.tsx`, `src/components/resume/suggestion-review.tsx`, `src/components/resume/match-panel.tsx`, `src/app/api/resumes/[id]/route.ts` (GET doc, PATCH userEdits/statuses), `src/app/api/resumes/[id]/fit/route.ts`, `src/app/api/resumes/[id]/pdf/route.ts`
- Test: `src/components/resume/suggestion-review.test.tsx`, `src/app/api/resumes/[id]/pdf/route.test.ts`, `src/app/api/resumes/[id]/fit/route.test.ts`

**Interfaces:**
- Consumes: render/fit/scoring (Task 8-9), `items.acceptText` (Task 4), orchestrate outputs.
- Produces: preview page renders `<ResumeDocument>` client-side inside `<PDFViewer>` (@react-pdf) — same component as PDF bytes route (single source). Suggestion rows with Accept / Edit / Reject: Accept → `PATCH /api/resumes/:id { status: 'accepted', suggestionId }` server writes doc item text AND calls `items.acceptText(supa, sourceItemId, item, newText, resumeId)` (Task 4 signature) so profile canon updates (spec: compounding asset). Reject leaves doc with original; Edit sets `finalText`. `<MatchPanel doc suggestions extraction fit cuts />` shows per-section matched keywords and live cuts with reason. Fit route: `POST /api/resumes/:id/fit { userEdits }` recomputes via `fitToPage` on edited texts; when `overflow` true the response includes `code: 'wont_fit'` and page shows the badge with 2-page toggle (**Review Focus 3**). PDF route: GET returns `Content-Type: application/pdf` bytes; 409 `{ code: 'pending_suggestions' }` when any status pending (anti-goal: never export unaccepted); quota usage unchanged on export (export does not count).

- [ ] **Step 1: Failing tests** — pdf route: pending suggestion exists → 409, no bytes; all dispositions terminal → 200 with non-empty body and page count matches stored pageLimit; fit route: userEdits inflating pinned content → 200 `{ overflow: true, code: 'wont_fit' }` and no automatic drops of pinned items in snapshot.cuts (**Review Focus 3**); suggestion-review component: Accept button disabled state never shown (accept is always clickable), after Accept the row flips to accepted and API called once with correct ids; Reject never modifies doc (assert PATCH body).
- [ ] **Step 2: Run, fail. Step 3: Implement.**
- [ ] **Step 4: Run, pass; manual:** accept all suggestions on the Task 11-generated resume, open the profile page — accepted bullet text now shows in profile with the Enhanced badge (compounding asset working end to end); download PDF, open, verify one page. Record in commit msg.
- [ ] **Step 5: Commit** — `git commit -m "feat: preview, suggestion review, match panel, gated pdf export"`.

### Task 14: Settings — delete all + JSON export

**Files:**
- Create: `src/app/settings/page.tsx`, `src/app/api/account/route.ts` (`DELETE`, `GET /api/account/export`)
- Test: `src/app/api/account/route.test.ts`

**Interfaces:**
- Consumes: all repos (owner-scoped deletes).
- Produces: `GET /api/account/export` → `application/json` attachment `{ profile, profile_items, job_descriptions, generated_resumes, month: 'YYYY-MM' }`; `DELETE /api/account` → after re-auth check (`supa.auth.getUser()`), deletes `generated_resumes`, `job_descriptions`, `generation_quota`, `profile_items` via `profiles`, then signs out; 401 otherwise. Settings page: two buttons, type-to-confirm `DELETE` text field before the destructive action.

- [ ] **Step 1: Failing test** — delete route without auth → 401 and zero table calls; export returns keys for all four stores (supaStub fixtures).
- [ ] **Step 2: Run, fail. Step 3: Implement.**
- [ ] **Step 4: Manual:** create throwaway account, populate, export JSON (file saved), delete, re-login fails. Step 5: commit — `git commit -m "feat: account json export and hard delete cascade"`.

### Task 15: Deploy Vercel + release notes

**Files:**
- Create: `README.md` (setup, env table, invite workflow, `docs/verify/deploy-smoke.md`)
- Modify: nothing app-level.

**Interfaces:** Consumes: everything. Produces: a public URL the owner shares; env values documented in README (no secrets committed).

- [ ] **Step 1: Write README** — local setup (Supabase project, `supabase db push`, `.env.local` keys, seeded invites, `pnpm dev`), production env list, model ID + pricing table guidance for Task 6 `PRICING_JSON`.
- [ ] **Step 2: Vercel deploy** — import repo, add env vars (Supabase URL/anon, AI key, model IDs, cost ceiling), deploy; run `docs/verify/deploy-smoke.md`: signup on live URL with fresh invite, build profile, paste JD, generate, accept, export PDF, delete test account. Expected: each step succeeds; paste failure lines into the doc if not.
- [ ] **Step 3: Note the Supabase free-project pause caveat** in README's deployment section (pause after ~1 week idle; upgrade or keep the weekly-activity habit until open signup).
- [ ] **Step 4: Commit + tag** — `git commit -m "docs: setup guide and deploy smoke checklist"; git tag v0.1.0`.

---

## Build-order notes (for the executor)

Tasks 1-6 are foundation, strictly ordered. 7-10 build the pipeline; 11-14 the surfaces. Task 15 last. If anything drifts between a task's Interfaces and what a neighbor implemented, fix the neighbor toward this plan — the plan is authoritative over incidental implementation, the spec is authoritative over both.
