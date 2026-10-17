import type { ItemType } from '@/lib/domain/types';

/**
 * Plain-form field definitions per item type — the "no markdown or JSON
 * visible" rule (anti-goal: walling off non-engineers). Both the add form
 * (SectionForm) and the editor (ItemEditor) render from these, so the shapes
 * stay in one place and match the zod payload schemas.
 */
export type FieldKind = 'text' | 'textarea' | 'number' | 'lines' | 'list';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  optional?: boolean;
}

export const TYPE_LABELS: Record<ItemType, string> = {
  career_snapshot: 'Career summary',
  education: 'Education',
  experience: 'Work experience',
  project: 'Project',
  award: 'Award',
  skill: 'Skill',
  language: 'Language',
};

export const TYPE_FIELDS: Record<ItemType, FieldDef[]> = {
  career_snapshot: [
    { key: 'text', label: 'Career summary', kind: 'textarea' },
  ],
  education: [
    { key: 'school', label: 'School', kind: 'text' },
    { key: 'degree', label: 'Degree', kind: 'text' },
    { key: 'field', label: 'Field of study', kind: 'text' },
    { key: 'startYear', label: 'Start year', kind: 'number' },
    { key: 'endYear', label: 'End year', kind: 'number' },
  ],
  experience: [
    { key: 'company', label: 'Company', kind: 'text' },
    { key: 'role', label: 'Role', kind: 'text' },
    { key: 'start', label: 'Start (e.g. 2022 or 2022-03)', kind: 'text' },
    { key: 'end', label: 'End (leave empty if current)', kind: 'text', optional: true },
    { key: 'bullets', label: 'Bullets (one per line)', kind: 'lines' },
  ],
  project: [
    { key: 'name', label: 'Project name', kind: 'text' },
    { key: 'description', label: 'What it does', kind: 'textarea' },
    { key: 'tech', label: 'Tech used (comma separated)', kind: 'list' },
  ],
  award: [
    { key: 'title', label: 'Award title', kind: 'text' },
    { key: 'issuer', label: 'Given by', kind: 'text' },
    { key: 'year', label: 'Year', kind: 'number' },
  ],
  skill: [
    { key: 'name', label: 'Skill name', kind: 'text' },
    { key: 'level', label: 'Level (optional)', kind: 'text', optional: true },
  ],
  language: [
    { key: 'name', label: 'Language', kind: 'text' },
    { key: 'level', label: 'Level (e.g. native, fluent)', kind: 'text' },
  ],
};

export type FormValues = Record<string, string>;

export function payloadToForm(defs: FieldDef[], payload: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const def of defs) {
    const v = payload[def.key];
    if (def.kind === 'lines') {
      out[def.key] = Array.isArray(v) ? v.join('\n') : '';
    } else if (def.kind === 'list') {
      out[def.key] = Array.isArray(v) ? v.join(', ') : '';
    } else if (typeof v === 'number') {
      out[def.key] = String(v);
    } else if (typeof v === 'string') {
      out[def.key] = v;
    } else {
      out[def.key] = '';
    }
  }
  return out;
}

export function formToPayload(defs: FieldDef[], values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of defs) {
    const raw = (values[def.key] ?? '').trim();
    if (def.kind === 'lines') {
      out[def.key] = raw ? raw.split('\n').map((l) => l.trim()).filter((l) => l !== '') : [];
    } else if (def.kind === 'list') {
      out[def.key] = raw ? raw.split(',').map((s) => s.trim()).filter((s) => s !== '') : [];
    } else if (def.kind === 'number') {
      // Empty number → omit the key entirely: the strict schema then fails
      // with a Required error naming that field (surfaced to the user).
      // Never NaN — JSON silently coerces it to null and hides the cause.
      if (raw !== '' && Number.isFinite(Number(raw))) {
        out[def.key] = Number(raw);
      }
    } else {
      // Text/textarea keep '' — an empty `end` is meaningful ("current job"),
      // and ExperiencePayloadSchema requires the key to be present.
      out[def.key] = raw;
    }
  }
  return out;
}
