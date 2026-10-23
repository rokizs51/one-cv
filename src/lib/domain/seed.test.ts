import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalTextFor } from './canonical';
import { PAYLOAD_SCHEMAS, JdExtractionSchema } from './schemas';
import type { ItemType } from './types';

/**
 * Guards supabase/seed.sql: every seeded payload must pass the same strict
 * schema the API uses, carry exactly the canonical text canonicalTextFor()
 * would derive, and the pre-filled JD extraction must cite verbatim JD text
 * (finalizeRequirements would silently drop an unverifiable excerpt).
 */
const sql = readFileSync(resolve(__dirname, '../../../supabase/seed.sql'), 'utf8');

describe('supabase/seed.sql', () => {
  it('every profile item payload validates and its canonical_text matches canonicalTextFor', () => {
    const row =
      /\(\s*'[0-9a-f-]+',\s*'[0-9a-f-]+',\s*'(career_snapshot|education|experience|project|certification|award|skill|language)',\s*'(\{[\s\S]*?\})'(?:::jsonb)?,\s*'([\s\S]*?)',\s*'manual'/g;

    const checked: string[] = [];
    for (let m = row.exec(sql); m !== null; m = row.exec(sql)) {
      const [, type, payloadJson, canonical] = m;
      const parsed = PAYLOAD_SCHEMAS[type as ItemType].safeParse(JSON.parse(payloadJson));
      if (!parsed.success) throw new Error(`${type} payload invalid: ${parsed.error.message}`);
      expect(canonicalTextFor(type as ItemType, parsed.data), `${type} canonical`).toBe(canonical);
      checked.push(type);
    }
    expect(checked.length).toBe(29);
  });

  it('the JD extraction validates and every sourceExcerpt is verbatim in raw', () => {
    const raw = /\$jd\$([\s\S]*?)\$jd\$/.exec(sql)![1];
    const extractionJson = /\$json\$([\s\S]*?)\$json\$::jsonb/.exec(sql)![1];
    const extraction = JdExtractionSchema.parse(JSON.parse(extractionJson));

    for (const req of extraction.requirements ?? []) {
      expect(raw.toLowerCase()).toContain(req.sourceExcerpt!.toLowerCase());
    }
    expect(extraction.requirements).toHaveLength(10);
  });
});