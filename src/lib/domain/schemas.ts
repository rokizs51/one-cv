import { z } from 'zod';
import type { ItemType } from './types';

// One requirement line of an extraction. Model output has no `id` (assigned
// post-parse); old stored extractions have no `requirements` at all — both
// must keep parsing, hence optional pieces.
export const JdRequirementSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1),
  category: z.enum([
    'technical_skill',
    'responsibility',
    'experience',
    'seniority',
    'domain_knowledge',
    'education_cert',
    'communication',
  ]),
  importance: z.enum(['mandatory', 'preferred']),
  aliases: z.array(z.string()).default([]),
  sourceExcerpt: z.string().nullable().default(null),
}).strict();

// Job description extraction schema
export const JdExtractionSchema = z.object({
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  keywords: z.array(z.string()),
  seniority: z.string(),
  domain: z.string(),
  tools: z.array(z.string()),
  responsibilities: z.array(z.string()),
  requirements: z.array(JdRequirementSchema).optional(),
}).strict();

// Per-type payload schemas

// Career snapshot
export const CareerSnapshotPayloadSchema = z.object({
  text: z.string(),
}).strict();

// Education
export const EducationPayloadSchema = z.object({
  school: z.string(),
  degree: z.string(),
  field: z.string(),
  startYear: z.number(),
  endYear: z.number(),
}).strict();

// Experience
export const ExperiencePayloadSchema = z.object({
  company: z.string(),
  role: z.string(),
  start: z.string(),
  end: z.string(),
  bullets: z.array(z.string()),
}).strict();

// Project
export const ProjectPayloadSchema = z.object({
  name: z.string(),
  description: z.string(),
  tech: z.array(z.string()),
}).strict();

// Award
export const AwardPayloadSchema = z.object({
  title: z.string(),
  issuer: z.string(),
  year: z.number(),
}).strict();

// Skill (level and category are optional — stored payloads predate both)
export const SkillPayloadSchema = z.object({
  name: z.string(),
  level: z.string().optional(),
  category: z.string().optional(),
}).strict();

// Language
export const LanguagePayloadSchema = z.object({
  name: z.string(),
  level: z.string(),
}).strict();

// Type → payload schema map for API validation (all schemas are .strict()).
export const PAYLOAD_SCHEMAS: Record<ItemType, z.ZodType<{ [k: string]: unknown }>> = {
  career_snapshot: CareerSnapshotPayloadSchema,
  education: EducationPayloadSchema,
  experience: ExperiencePayloadSchema,
  project: ProjectPayloadSchema,
  award: AwardPayloadSchema,
  skill: SkillPayloadSchema,
  language: LanguagePayloadSchema,
};

export const ITEM_TYPES = Object.keys(PAYLOAD_SCHEMAS) as ItemType[];

// Personal info shape stored on profiles.personal (camelCase app-side;
// the DB stores snake_case via the mapper if that ever changes).
export const PersonalInfoSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  links: z.array(z.string()),
});

// The generated CV document. Stored docs were built by this same code and
// read back through this schema, so drift fails loudly at the DB boundary
// instead of rendering a corrupted page.
export const ResumeDocSchema = z.object({
  // Shape only: a stored CV must render even if its contact strings are
  // quirky. Email-format validation belongs at profile entry, not here.
  header: z.object({
    fullName: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    links: z.array(z.string()),
  }),
  summary: z.string().nullable(),
  sections: z.array(
    z.object({
      id: z.enum(['summary', 'skills', 'experience', 'projects', 'education', 'awards', 'languages']),
      items: z.array(
        z.object({
          sourceItemId: z.string(),
          text: z.string(),
          basis: z.string(),
          category: z.string().optional(),
        })
      ),
    })
  ),
});
