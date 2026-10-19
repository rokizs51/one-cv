# Task: Improve Sever's Resume Generation and Implement Job-Match Analysis

You are working on **Sever**, an AI-powered resume builder. Users maintain their career information in a profile, paste a job description, and generate a tailored resume based on their actual qualifications.

Your task is to improve the existing resume generation workflow and implement a reliable Job-Match Analysis feature.

## 1. Working Rules

Before making changes:

1. Inspect the existing codebase, architecture, database schema, migrations, AI prompts, resume-generation workflow, and PDF rendering implementation.
2. Identify the current implementation of each feature described below.
3. Create a concise implementation plan based on the existing code.
4. Reuse existing components, utilities, database tables, and conventions where appropriate.
5. Do not replace working implementations or introduce new dependencies without a clear reason.
6. Do not assume the proposed database schema or API routes already exist. Adapt the design to the actual codebase.
7. Do not modify unrelated features, run destructive database operations, expose secrets, or change production data.
8. Do not run Git commands or switch branches.
9. Implement the changes, validate them, and report the results. Do not stop after producing a plan.

## 2. Core Product Requirements

The system must optimize the representation of a user's real qualifications, not fabricate qualifications to improve their apparent suitability for a job.

Treat the user's profile as the source of truth for personal and professional facts.

The AI may:
- Rewrite experience bullets for clarity and relevance.
- Prioritize relevant skills, projects, and work experience.
- Extract requirements from a job description.
- Match requirements against existing profile evidence.
- Suggest questions that would help clarify incomplete information.
- Suggest improvements to wording without changing the underlying facts.

The AI must not:
- Invent achievements, metrics, certifications, technologies, responsibilities, employment dates, or job titles.
- Claim that a user has professional or production experience merely because they have completed a personal project.
- Convert an unknown qualification into a confirmed skill.
- Treat a missing profile entry as proof that the user lacks the qualification.
- Add unsupported claims to a generated resume.

## 3. Improve PDF and Resume Rendering

Inspect and fix the current PDF generation implementation.

Requirements:

- Eliminate duplicated bullet markers, such as `• -`.
- Store bullet content as plain text; let the renderer control bullet formatting.
- Use consistent typography, spacing, indentation, headings, and date formatting.
- Prevent headings and individual experience entries from splitting awkwardly across pages where practical.
- Implement correct text wrapping without unnecessary manual line breaks.
- Avoid orphaned headings and excessively sparse pages.
- Keep contact information and links readable.
- Preserve correct text order in the exported PDF.
- Validate embedded fonts and PDF text extraction.
- Support one-page and two-page resumes without truncating content.
- Do not force every resume onto one page if doing so would make the text unreadable.
- Ensure the preview and exported PDF are consistent.

Do not solve pagination problems by indiscriminately shrinking fonts or deleting relevant experience.

## 4. Improve Resume Content Generation

Replace inconsistent free-form resume generation with structured, validated output where practical.

Requirements:

- Use a consistent schema for resume sections, experience entries, projects, education, skills, and languages.
- Normalize experience bullets so that the renderer owns bullet markers.
- Group skills into relevant categories, such as Languages, Backend, Databases, and DevOps & Tools.
- Remove empty, duplicated, malformed, or ambiguous skill entries.
- Avoid generating generic AI-written descriptions for every individual skill.
- Use concise, action-oriented experience bullets.
- Prioritize the most relevant evidence for the target job.
- Keep experience in reverse chronological order by default.
- Allow section ordering to adapt when appropriate for the user's career stage and target role.
- Preserve factual details from the source profile.
- Never invent quantitative results. Ask the user for evidence when metrics would improve a bullet.
- Allow users to review and edit generated content before exporting it.

Use structured model outputs or schema validation supported by the existing AI integration. Handle invalid model responses gracefully.

## 5. Implement Job-Match Analysis

Build a feature that compares a job description against the user's existing profile.

### 5.1 Job description requirement extraction

Extract structured requirements from the job description, including:

- Required technical skills.
- Preferred or optional skills.
- Responsibilities.
- Experience requirements.
- Seniority requirements.
- Domain or industry knowledge.
- Education and certifications, where applicable.
- Communication and collaboration requirements.

Each requirement should have:

- A stable identifier within the analysis.
- A concise description.
- A requirement category.
- An importance classification.
- The original job-description text or a traceable source excerpt.
- Any relevant aliases or equivalent terminology.

Distinguish mandatory requirements from preferred qualifications. Do not treat every keyword as equally important.

Do not interpret vague language as a more specific requirement than the job description supports.

### 5.2 Evidence matching

Compare each extracted requirement against the user's profile.

Potential evidence sources include:

- Professional experience.
- Internships.
- Projects.
- Skills.
- Education and certifications.
- User-confirmed achievements.

For every requirement, return:

- The requirement.
- Its importance.
- The match status.
- Supporting profile evidence, if any.
- The source of that evidence.
- A concise explanation of the match.
- Any uncertainty or follow-up question.
- A recommendation for resume tailoring.

A requirement can match multiple evidence items. Preserve those relationships.

Distinguish professional experience from internship experience and personal projects.

Do not use unsupported assumptions or keyword overlap alone to claim that a requirement is satisfied.

### 5.3 Confidence and match states

Use explicit states rather than a single opaque confidence score.

Recommended states:

- `supported`: Relevant profile evidence adequately supports the requirement.
- `partial`: Some evidence exists, but it does not fully establish the requirement.
- `needs_review`: Evidence exists but is ambiguous or needs user confirmation.
- `not_established`: No supporting evidence was found in the available profile.
- `not_applicable`: The requirement cannot meaningfully be assessed against the profile, where appropriate.

Keep confidence separate from match status. Confidence describes the reliability of the assessment; it does not represent the user's qualification level.

Missing information must not automatically be treated as a confirmed skill gap.

### 5.4 Job-match summary

Provide a summary containing:

- Total requirements analyzed.
- Number of supported, partial, uncertain, and unestablished requirements.
- Breakdown by importance.
- Strongest matching qualifications.
- Important gaps or unverified requirements.
- Suggested follow-up questions.
- Recommended resume adjustments.

If displaying a score, define the calculation, explain its limitations, and show the underlying requirement breakdown. Do not claim to predict ATS success or interview probability.

## 6. Data Model and Persistence

Inspect the existing Supabase schema before designing migrations.

Implement the minimum persistent data model needed for:

- Job applications or analysis sessions.
- The original job description.
- Extracted job requirements.
- Requirement-to-profile-evidence matches.
- Match statuses and assessment explanations.
- Analysis status, errors, and timestamps.
- The relationship between an analysis and its generated resume.

Use the existing schema if equivalent tables already exist.

If new tables are needed, use appropriate foreign keys, indexes, timestamps, and constraints. Ensure user-owned records cannot be accessed by another user.

Use Supabase Row Level Security for user-owned data. Keep service-role credentials and privileged operations server-side.

Treat analysis results as snapshots. If the user edits their profile or the job description, provide a clear way to rerun the analysis rather than silently presenting stale results as current.

Do not store unnecessary copies of sensitive profile data.

## 7. API and Application Integration

Follow the existing API conventions. Adapt route names and request formats to the current project rather than creating duplicate APIs.

The implementation must support these logical operations:

1. Create an analysis from a job description and the authenticated user's profile.
2. Retrieve a persisted analysis.
3. Retrieve the requirement breakdown and evidence matches.
4. Update a match through an explicit user-confirmation workflow, if needed.
5. Rerun an analysis after profile or job-description changes.
6. Generate a tailored resume from the selected analysis and verified profile evidence.

Requirements:

- Authenticate all protected operations.
- Validate request bodies and route parameters.
- Enforce resource ownership.
- Handle malformed job descriptions and invalid model output.
- Avoid duplicate analysis creation when a request is retried.
- Represent processing, completion, and failure states clearly.
- Prevent partial or failed AI responses from being treated as completed analyses.
- Use the existing error-handling and logging conventions.
- Do not expose private prompts, API keys, or internal error details to users.

## 8. Job-Match Analysis UI

Build on the existing design system.

The interface should display:

- An overall summary with an understandable requirement breakdown.
- Separate counts for mandatory and preferred requirements.
- A list of requirements grouped by importance or status.
- Evidence and its source for every supported match.
- Clear explanations for partial or uncertain matches.
- Missing-information indicators without unsupported conclusions.
- Suggested questions the user can answer to improve the analysis.
- A button to rerun analysis when appropriate.
- A clear action to generate the tailored resume.
- Loading, empty, error, and completed states.

Users must be able to inspect the evidence behind a match rather than relying on an unexplained percentage.

Keep the UI responsive and accessible. Avoid unnecessary dashboards, animations, or unrelated redesigns.

## 9. Testing and Validation

Prioritize high-value tests rather than generating a large, redundant test suite.

At minimum, verify:

1. A requirement is supported by relevant, explicit profile evidence.
2. A personal project does not become professional experience.
3. A missing skill is marked `not_established`, not asserted to be absent from the user's actual capabilities.
4. A partial match remains partial when the evidence is insufficient.
5. The AI cannot add unsupported metrics or certifications to the generated resume.
6. Duplicate requirement extraction is handled appropriately.
7. Invalid structured model output is rejected or retried safely.
8. Users cannot access another user's analyses or resumes.
9. Repeated requests do not create unintended duplicate analyses.
10. PDF exports have correct bullet formatting, text order, page boundaries, and no content truncation.
11. Long and short resumes render correctly.
12. Editing profile data invalidates or marks existing analysis results as stale.

Use the project's existing testing framework. Add focused unit and integration tests for critical logic. Run existing relevant checks and report any failures.

Do not claim that tests passed unless they actually ran successfully.

## 10. Definition of Done

The feature is complete when:

- The existing resume workflow still works.
- The exported PDF is structurally consistent and readable.
- Resume content is generated through validated structured data.
- Job descriptions are transformed into traceable, structured requirements.
- Requirements are matched against actual profile evidence.
- Match statuses and uncertainty are represented accurately.
- Analysis results are persisted securely and scoped to the authenticated user.
- Users can inspect matches and understand recommendations.
- Resume generation uses the selected analysis without introducing unsupported claims.
- Critical tests and relevant project checks pass.

## 11. Execution Strategy

Work in small, coherent phases:

Phase 1: Inspect the repository and report the existing architecture, defects, and implementation plan.

Phase 2: Fix PDF rendering and structured resume output.

Phase 3: Implement requirement extraction, evidence matching, and validation.

Phase 4: Implement persistence, API integration, and authorization.

Phase 5: Implement the Job-Match Analysis UI and resume-generation integration.

Phase 6: Run targeted tests, validate exported PDFs, fix regressions, and summarize the results.

Start by inspecting the existing codebase. Then proceed with implementation without waiting for approval for ordinary, reversible code changes.

If you encounter a destructive migration, a production-data risk, an ambiguous product decision that materially changes the architecture, or an unavailable external dependency, stop that specific operation, explain the blocker, and continue with independent safe work.

At completion, provide:

1. What changed.
2. Important files and migrations created or modified.
3. Database and API changes.
4. Tests and validation actually performed.
5. Known limitations and remaining work.
6. Any manual setup required.

Do not report a feature as complete if only its UI or placeholder implementation exists.
