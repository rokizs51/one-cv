import { z } from 'zod';

// Job description extraction schema
export const JdExtractionSchema = z.object({
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  keywords: z.array(z.string()),
  seniority: z.string(),
  domain: z.string(),
  tools: z.array(z.string()),
  responsibilities: z.array(z.string()),
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

// Skill (level is optional)
export const SkillPayloadSchema = z.object({
  name: z.string(),
  level: z.string().optional(),
}).strict();

// Language
export const LanguagePayloadSchema = z.object({
  name: z.string(),
  level: z.string(),
}).strict();
