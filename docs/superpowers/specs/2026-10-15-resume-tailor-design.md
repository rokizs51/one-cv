# ResumeTailor — Design Document

Date: 2026-10-15
Status: ready for owner approval
(Builder-checked once; all product-owner questions resolved in conversation. "ResumeTailor" is a working title — rename freely.)

## Intent and the why

Job seekers keep one generic CV (today: Google Docs + a downloaded ATS template) and either send it unchanged to every posting or hand-tweak it while guessing what each employer wants to see. That guessing is the pain. **ResumeTailor** lets a candidate record their complete professional story *once*, then produce the strongest possible one-page CV for a specific job by pasting that job's description.

Success, in the product owner's words: people get resumes that actually fit the jobs they apply to. The product must first work for its builder (user zero: Roki, software engineer, applying to jobs now), then serve "everyone" — strangers who sign up and want a CV they're proud of in minutes.

## Goals

1. **Master profile — a compounding asset.** Structured, private, permanent record: personal/contact info, career snapshot, education, work experience, projects, awards, technical skills, languages. Built field by field from day one. An accepted rewrite or hand-edit from any generation flows back into the profile as its canonical wording (provenance-tagged, reversible), so the profile gets sharper with every use — the "record once" promise made literal.
2. **Job-description tailoring.** Paste any JD; the app extracts what that employer wants (must-have skills, recurring keywords, seniority, tools, domain) and selects/orders profile content accordingly. Different JDs must visibly produce different CVs.
3. **Two generation modes** (user's choice per generation):
   - *As-is*: pure curation. The user's own words, untouched; the app only chooses what stays, what goes, and the ordering. Sole exception: the composed headline summary (see "Summary", below), which is always shown as a suggestion.
   - *Enhance*: curation plus wording sharpening — bullets rewritten to mirror the JD's language and sound professional. Every rewritten line is a suggestion the user can accept, edit, or reject before export. The app never invents experience the user hasn't recorded.
4. **One-page, ATS-clean output.** A single-column, parseable, print-quality PDF; one-page rule structurally enforced (Constraints).
5. **"Why this matched" panel.** Per section: which JD keywords each item hits; a live list of what was cut for space/relevance and why.
6. **Version history.** Every generated CV is saved with the JD it was made for; reopen, re-export, regenerate, compare.
7. **Private by default.** Sign-in required; each user's data visible only to them, enforced by Postgres RLS. Self-service **account deletion (hard cascade across all tables and storage objects) and full JSON export ship in v1**.

## Launch access model (product owner's answer)

Invite/waitlist-only at launch, with a per-user monthly generation cap (my call: 50 generations/user/month initially). Strangers sign up only after the cap and quota logic prove themselves at personal + friends scale. Email verification, rate limiting, and abuse handling are explicitly deferred to the open-signup phase, not v1.

## Non-goals (v1)

- No payments, billing, or monetization — the product proves itself free first.
- No cover letters, LinkedIn import, or application tracking.
- No multi-template gallery — one clean ATS template (my call; more templates later).
- No public profiles / job board / employer side.
- No translation (see Language).
- No open self-serve signup (see access model).
- No mobile app; responsive web is sufficient.

## Anti-goals (failure even if it technically works)

- **Fabrication**: a generated CV claims skills or achievements the profile doesn't contain. An embarrassed user in an interview is the product's worst outcome.
- **Data exploitation**: selling, sharing, or training on user profile data. The stored data is people's entire careers plus contact details.
- **Generic output**: producing the same CV regardless of the JD — that's just Google Docs again.
- **Walling off non-engineers**: profile building must work via plain forms; no markdown or JSON visible anywhere in the user path.
- **Silent destruction**: the app never quietly drops or overwrites the user's material — cuts are visible, edits reversible, provenance kept.

## Language (product owner's answer)

The app does not translate. Profile, JD, and CV are whatever language the user writes; v1 assumes English postings. Cross-language generation is out of scope by design.

## Constraints

- **One-page rule (locked with owner)**: one page default, structurally enforced. Overflow → compaction (spacing, shorter bullets via suggestions) → dropping lowest-relevance items, with the cut list shown live. A per-generation 2-pages toggle exists for senior candidates.
- **Editing model (my call)**: all user edits target the underlying data model (selections, bullet text, pins), never floating text on a rendered page. Every edit re-runs the fit computation and updates the cut list live. Users can **pin** any item so it is never dropped; if pinned content alone exceeds one page, an honest "won't fit" badge appears and the user either un-pins or flips to 2 pages. No silent surprises.
- **Stack (my call, accepted; verified against current sources Oct 2026)**:
  - **Next.js (TypeScript, App Router)** — one repo; AI orchestration in server routes so keys never touch the browser.
  - **Supabase** — Postgres + auth + RLS. Free tier (verified): 50k MAU, 500 MB DB, 1 GB file storage, 2 active projects. Known caveat: free projects **pause after ~1 week of inactivity** — acceptable while personal-scale, must upgrade before any open-signup launch.
  - **react-pdf (`@react-pdf/renderer`)** (verified: renders PDFs from the same React components in browser *and* Node) — the on-screen preview and the exported PDF are the same component: what you see is literally what you submit. Page overflow is detectable at render time, which powers the one-page rule.
  - **Deploy: Vercel + env API keys.** `pnpm dev` for the owner; one public URL for everyone.
- **LLM usage (my call)**: one thin internal `ai` module, provider-swappable. Extraction tasks (JD parse, future CV import) use a cheap structured-output tier (e.g. Haiku/Flash-class, verified ~$0.10–$0.50 per 1M tokens Oct 2026); enhance uses the stronger tier, **single call per generation** over the JD + relevant profile slice (never the whole profile) to keep cost bounded.
- **Budget mode (my call)**: a server-side circuit breaker, not a user-visible control. When the monthly LLM spend ceiling is hit, generation falls back to deterministic keyword scoring (no LLM); enhance and composed summaries are temporarily disabled with an honest notice. Keeps free-tier economics safe by construction.

## UI Design Direction (owner's)

Minimalist, fintech-UI inspired — the experience should feel effortless, understandable, and quick to use.

- Clean, functional, approachable. Strong typography, generous whitespace.
- Neutral color palette with high-contrast primary actions.
- Clear lists and easy-to-read summaries (dashboard versions, profile sections, JD chips, match keywords).
- Subtle borders, restrained card usage, consistent spacing. Mobile-first responsive, polished desktop.
- Avoid excessive gradients, glassmorphism, glowing cards, generic SaaS-dashboard aesthetics.

Two locked interpretations (my calls): exactly **one accent color**, reserved for each screen's primary action, with destructive actions in a distinct muted warning tone; and the direction governs **app chrome only — the rendered resume stays plain and ATS-clean**, never decorated. Concrete tokens (neutrals, font stack, spacing) are the builder's; the mood is fixed. Full builder-level detail and per-task pointers live in the plan's `UI Design` section.

## Screen map

1. **Dashboard** — after sign-in: profile completeness hints; saved JDs and generated versions; "New tailored CV" primary action.
2. **Profile editor** — one page, one section per content type (personal, career snapshot, education, experience, projects, awards, skills, languages); entries expandable/editable; provenance markers on enhanced wording with one-click revert to original text.
3. **Generate flow** — paste JD → compact "what this job wants" chip list → mode choice (as-is / enhance) → generated one-page preview.
4. **Preview & edit** — the rendered CV as the one source component: direct editing of any line; enhance-mode rewrites and the composed summary carry accept/edit/reject; "why this matched" panel alongside; pin controls; live cut list; PDF export only from an approved (fully accepted/edited) state.
5. **Versions** — every creation/export stored; reopen and compare.
6. **Settings** — account deletion (hard cascade) and JSON export.

## The AI behavior (spec-level)

- **JD extraction**: JSON-mode call → `{ required_skills[], preferred_skills[], keywords[], seniority, domain, tools, responsibilities[] }`, stored with the JD record for reuse and the match panel.
- **Relevance scoring & selection**: profile items scored against the JD extraction (LLM-assisted; deterministic keyword fallback under budget mode). Section order follows the ATS-standard hierarchy (contact → summary → skills → experience → projects → education → awards/languages), with experience/projects swapped for early-career profiles based on profile data (my call).
- **Summary composition (product owner's answer)**: the profile stores a user-written **career snapshot** (the raw material, e.g. "backend engineer, 3 yrs fintech, shipped X"). Each generation composes a short JD-tailored headline summary strictly from recorded facts, presented as a suggestion with accept/edit/reject in **both** modes. The snapshot itself is never overwritten by composition.
- **Enhance**: rewrite suggestions limited to bullets, career snapshot-derived summary, and section ordering rationale — constrained to recorded facts, preferring JD vocabulary, each carrying a basis-pointer to the source profile item. On accept: the new wording becomes the profile item's canonical text, original preserved under provenance. Unaccepted suggestions can never export.
- **Phase 2 (deferred, same schema)**: paste an existing free-text CV → JSON-mode extraction into the profile fields for per-field review and top-up.

## Data model (sketch)

- `profiles` (1:1 with auth user); `profile_items` — `type` (career_snapshot | education | experience | project | award | skill | language), `payload` JSONB, `source` (manual | import), `canonical_text`, `provenance` JSONB (original text + accepted-rewrite lineage), `pinned` default state per section.
- `job_descriptions` (owner, raw text, extraction JSONB, created_at).
- `generated_resumes` (owner, jd_id, mode, selections JSONB, suggestion dispositions JSONB, user_edits JSONB, rendered snapshot, page_count, created_at).
- `invites` (email claim code, status) for launch gating.
- Quota bookkeeping: generations-this-month counter per user (simple table; incremented in the generate route, checked before any LLM call).
- RLS on all tables: `owner = auth.uid()`; no cross-user reads; no analytics on profile content. Deletion cascades from `profiles` → items, JDs, versions, storage objects.

## Decisions ledger

**The owner's:** web app for self + everyone; as-is/enhance modes with a switch; enhance may sharpen wording, always under accept/edit/reject; field-by-field first, CV-import phase 2; compounding profile (accepts flow back); composed per-JD headline summary from a stored career snapshot; no translation in v1; invite/waitlist launch with a monthly cap; purpose = people getting CVs that fit the jobs they apply to, free and honest while it proves itself; minimalist fintech-inspired UI direction for app chrome.

**My calls (check while reading):** name "ResumeTailor"; Next.js + Supabase + react-pdf + Vercel stack; single ATS-clean template; one-page hard rule with visible cuts, pins, and a 2-page escape hatch; model-driven editing (no free-floating text); section ordering incl. early-career swap; 50 gens/user/month cap; budget-mode circuit breaker as server-side fallback; deletion + JSON export in v1; English postings assumption; email sign-in.

## Open questions owned by the product owner

None.

## Revisions (owner decisions after this doc's draft)

- **2026-10-17 — invite gating dropped.** The "Launch access model" (invite/waitlist-only at launch) is superseded: open email/password signup from day one, handled directly by Supabase Auth. The `invites` table and all signup/login invite checks are removed. The per-user 50-generation monthly cap and the server-side budget circuit breaker **stand**. Email verification (dashboard toggle, no code) can be enabled anytime now that open signup is the mode.
- **2026-10-17 — provider gate opened.** Per the "LLM usage" constraint's provider-swappable intent: `AI_PROVIDER` now accepts `anthropic` (default) or `qwen` (Anthropic-wire-compatible endpoint via `AI_BASE_URL` + `AI_API_KEY`); the owner runs a Qwen token plan. Model tiers (cheap extraction / stronger enhance) unchanged as a rule.
