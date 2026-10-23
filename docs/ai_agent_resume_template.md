# Resume Template — AI-Agent Friendly

> Purpose: A structured, ATS-friendly resume source that an AI agent can parse and tailor to a job description.
> Instructions: Replace every `[PLACEHOLDER]` with verified information. Delete optional sections that do not apply.
> Truthfulness rule: Never invent employers, dates, degrees, technologies, responsibilities, metrics, or achievements. If information is missing, leave the placeholder or ask the user.

---

## CANDIDATE

- **Full name:** [FULL_NAME]
- **Target role:** [TARGET_ROLE]
- **Location:** [CITY, COUNTRY]
- **Email:** [EMAIL]
- **Phone:** [PHONE]
- **LinkedIn:** [LINKEDIN_URL]
- **GitHub:** [GITHUB_URL]
- **Portfolio:** [PORTFOLIO_URL]
- **Work authorization / sponsorship:** [OPTIONAL — VERIFIED DETAILS]

## PROFESSIONAL SUMMARY

[Write 2–4 concise sentences. State years of relevant experience, strongest relevant technologies, domain experience, and evidence-backed strengths. Tailor to the target job without copying the job description verbatim.]

## TECHNICAL SKILLS

- **Programming languages:** [LANGUAGE_1], [LANGUAGE_2]
- **Backend / frameworks:** [TECHNOLOGY_1], [TECHNOLOGY_2]
- **Frontend:** [TECHNOLOGY_1], [TECHNOLOGY_2]
- **Databases:** [DATABASE_1], [DATABASE_2]
- **Cloud / DevOps / infrastructure:** [TECHNOLOGY_1], [TECHNOLOGY_2]
- **Testing:** [TOOLS_OR_METHODS]
- **Tools / integrations:** [TOOL_1], [TOOL_2]
- **Other relevant skills:** [SKILL_1], [SKILL_2]

## PROFESSIONAL EXPERIENCE

### [JOB_TITLE] — [COMPANY_NAME]

- **Employment dates:** [MMM YYYY] – [MMM YYYY OR Present]
- **Location:** [CITY, COUNTRY OR REMOTE]
- **Employment type:** [FULL-TIME / CONTRACT / INTERN / OTHER]

**Achievements and responsibilities**
- [ACTION VERB] [WHAT YOU BUILT, IMPROVED, DEBUGGED, OR DELIVERED] using [RELEVANT TECHNOLOGY], resulting in [VERIFIED OUTCOME OR METRIC].
- [ACTION VERB] [SYSTEM / FEATURE / INTEGRATION] to address [PROBLEM OR USER NEED].
- [ACTION VERB] [PERFORMANCE / RELIABILITY / QUALITY IMPROVEMENT]; measured result: [VERIFIED METRIC, IF AVAILABLE].
- [ACTION VERB] collaborated with [TEAM / STAKEHOLDERS] to deliver [FEATURE / BUSINESS OUTCOME].

**Technologies used:** [ONLY TECHNOLOGIES ACTUALLY USED IN THIS ROLE]

[Repeat this block for each role, in reverse chronological order.]

## PROJECTS

### [PROJECT_NAME] — [PROJECT_URL]

- **Dates:** [MMM YYYY – MMM YYYY OR Present]
- **Role:** [YOUR ROLE]
- **Problem / purpose:** [WHAT THE PROJECT SOLVES]
- **Implementation:** [WHAT YOU PERSONALLY BUILT AND HOW]
- **Outcome:** [VERIFIED RESULT, USAGE, PERFORMANCE, OR LEARNING]
- **Technologies:** [TECHNOLOGY_1], [TECHNOLOGY_2]

[Repeat for each relevant project. Prioritize projects that demonstrate requirements from the target job.]

## EDUCATION

### [DEGREE / QUALIFICATION] — [INSTITUTION_NAME]

- **Dates:** [MMM YYYY – MMM YYYY OR Graduation year]
- **Location:** [CITY, COUNTRY]
- **Relevant coursework / honors:** [OPTIONAL — VERIFIED DETAILS]

## CERTIFICATIONS

- **[CERTIFICATION_NAME]** — [ISSUING_ORGANIZATION], [YEAR] — [CREDENTIAL_URL]
[Remove this section if none.]

## ADDITIONAL INFORMATION

- **Languages:** [LANGUAGE — PROFICIENCY]
- **Open-source contributions:** [VERIFIED CONTRIBUTIONS]
- **Publications / talks / awards:** [VERIFIED DETAILS]
[Remove this section if none.]

---

# AI AGENT INSTRUCTIONS

When tailoring this resume to a job description:

1. Treat all candidate details above as the source of truth.
2. Do not fabricate or infer specific experience, metrics, dates, qualifications, or skill proficiency.
3. Extract job requirements into:
   - `required`
   - `preferred`
   - `responsibilities`
   - `domain_context`
4. Match each requirement to explicit evidence in this resume.
5. Use these evidence statuses:
   - `supported`: directly supported by resume evidence.
   - `partial`: related evidence exists, but the requirement is not fully demonstrated.
   - `missing`: no supporting evidence is present.
   - `needs_confirmation`: potentially relevant, but the candidate must confirm it.
6. Tailor the summary, skills ordering, and experience bullet ordering to the role. Do not add unsupported keywords.
7. Rewrite bullets using: **Action + technical approach + scope/problem + verified result**. If no metric is provided, do not invent one.
8. Keep the resume ATS-friendly:
   - single column
   - standard section headings
   - no tables, icons, charts, text boxes, or skill-rating bars
   - consistent date format: `MMM YYYY`
   - concise bullet points
9. Preserve factual meaning. Flag contradictions or missing information for the candidate.
10. Return:
    - tailored resume
    - job requirement-to-evidence matrix
    - unsupported/missing requirements
    - questions that would improve the resume
11. Do not include this instruction section in the final candidate-facing resume unless explicitly requested.

## OPTIONAL MACHINE-READABLE REQUIREMENT MATCH OUTPUT

Use this JSON shape when producing a job-match analysis. Return valid JSON only if the user explicitly requests JSON.

{
  "target_role": "[TARGET_ROLE]",
  "overall_match": {
    "status": "supported | partial | insufficient_evidence",
    "explanation": "[EVIDENCE-BASED SUMMARY]"
  },
  "requirements": [
    {
      "requirement": "[JOB REQUIREMENT]",
      "type": "required | preferred | responsibility | domain_context",
      "status": "supported | partial | missing | needs_confirmation",
      "resume_evidence": ["[EXACT RESUME FACT OR BULLET]"],
      "gap": "[WHAT IS NOT DEMONSTRATED]",
      "follow_up_question": "[QUESTION OR EMPTY STRING]"
    }
  ],
  "resume_changes": [
    {
      "section": "[SECTION NAME]",
      "change": "[PROPOSED CHANGE]",
      "reason": "[WHY IT HELPS]",
      "evidence_source": "[EXISTING RESUME FACT]"
    }
  ],
  "candidate_questions": ["[QUESTION]"]
}
