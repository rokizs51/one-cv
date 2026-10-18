# CV Structure Reference — the ATS Standard

This is the canonical structure ResumeTailor generates against. Source: synthesis of
2026 recruiter/ATS guidance (Resume.io ATS guide, Indeed ATS template article,
Jobscan ATS anatomy, My Personal Recruiter ATS guide — see Sources at bottom).
When changing `src/lib/resume/` ordering, labels, or the PDF template, update this
doc in the same commit — it is the spec, the template is the implementation.

## The consensus format

**Reverse-chronological, single-column, no tables/columns/graphics/text boxes.**
Every source names this as the one format ATS parsers read reliably; functional
and hybrid formats parse worst.

## Fixed section order

| # | Section | Rule |
|---|---------|------|
| 1 | Contact header | Name; one line: email • phone • location; links line |
| 2 | Professional summary | 2–3 lines, labeled (never floating unlabeled) |
| 3 | Work experience | Reverse-chronological; the centerpiece |
| 4 | Skills | Hard skills matching the JD, compact block |
| 5 | Education | One line per degree |
| 6+ | Optional: Projects, Awards, Languages | Appended after Education |

Early-career deviation (pinned rule in `scoring.ts`): when the candidate is early
career, Education and Projects move **above** Work Experience. Skills still follows
experience; optional tail unchanged.

## Standard section labels (ATS parsers key on these exact strings)

| SectionId | Printed label |
|-----------|---------------|
| (doc.summary) | PROFESSIONAL SUMMARY |
| experience | WORK EXPERIENCE |
| skills | SKILLS |
| education | EDUCATION |
| projects | PROJECTS |
| awards | AWARDS |
| languages | LANGUAGES |

Never creative titles ("My Journey", "What I Bring") — parsers drop unrecognized
headings and their content mis-routes to the wrong fields.

## Formatting rules

- Font: Helvetica/Arial-class system sans, body **10–12 pt** (we use Helvetica 10).
- Margins ~0.5 in (we use 42pt ≈ 0.58 in).
- **Single column only**; dates stay inline with the entry line.
- Entry shape (experience): bold header line (`Role — Company (2020–present)`) +
  `•` bullets on indented lines.
- Skills render as one compact comma/•-separated block, not one line per skill.
- File: text-based PDF (vector text, selectable — never rasterized).
- Keywords: mirrored from the JD extraction — this is the whole product.

## Anti-patterns (never in generated output)

Multi-column layouts • tables • text boxes • images/icons • header/footer regions •
graphics/charts • emoji • custom fonts • creative section titles • unlabeled summary.

## Where implemented

- Section order: `src/lib/resume/scoring.ts` — `BASE_ORDER`, `EARLY_CAREER_ORDER`, `orderSections`
- Document shape: `ResumeDoc` in `src/lib/domain/types.ts` (header, summary, sections[])
- Printed structure/labels: `src/lib/resume/render/document.tsx`
- One-page fit engine budgets the same `text` strings this template renders: `src/lib/resume/fit.ts`

## Sources

- Resume.io — ATS Resume Templates & Format Guide 2026 (fixed five-section order)
  https://resume.io/resume-templates/ats
- Indeed — How to Write an ATS Resume (standard labels, no headers/footers)
  https://www.indeed.com/career-advice/resumes-cover-letters/ats-resume-template
- Jobscan — Anatomy of an ATS-friendly resume (single column, no tables)
  https://www.jobscan.co/blog/20-ats-friendly-resume-templates/
- Sensei Copilot — Best ATS Resume Format 2026 (reverse-chronological consensus)
  https://www.senseicopilot.com/blog/best-ats-resume-format-for-2026
- My Personal Recruiter — What ATSs actually look for in 2026
  https://mypersonalrecruiter.com/ats-resume-what-applicant-tracking-systems-actually-look-for-in-2026/
- Microsoft Word — Best resume formats (chronological = most recruiter-preferred)
  https://word.cloud.microsoft/create/en/blog/best-resume-formats/
