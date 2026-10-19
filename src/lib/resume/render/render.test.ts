/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { ResumeDoc } from '@/lib/domain/types';
import { renderResumePdf, pdfPageCount } from './render';

// Minimal 1-page fixture
const onePageDoc: ResumeDoc = {
  header: {
    fullName: 'Test User',
    email: 'test@example.com',
    phone: null,
    location: null,
    links: [],
  },
  summary: 'A brief summary.',
  sections: [
    {
      id: 'experience',
      items: [
        {
          sourceItemId: 'exp1',
          text: 'Software Engineer at Acme Corp. Built features.',
          basis: 'scored',
        },
      ],
    },
  ],
};

describe('renderResumePdf + pdfPageCount', () => {
  it('renders a 1-page doc as exactly 1 page', async () => {
    const { bytes, pages } = await renderResumePdf(onePageDoc, 1);
    expect(pages).toBe(1);
    expect(await pdfPageCount(bytes)).toBe(1);
  });

  it('renders a padded doc (25 fake experience bullets) as 2 pages', async () => {
    const paddedDoc: ResumeDoc = {
      ...onePageDoc,
      sections: [
        {
          id: 'experience',
          items: Array.from({ length: 25 }, (_, i) => ({
            sourceItemId: `exp-${i}`,
            text: `Experience bullet ${i}: Did many things at company ${i} with responsibility ${i} and achievement ${i} and more text to fill space ${i}.`.repeat(2),
            basis: 'scored',
          })),
        },
      ],
    };

    const { pages } = await renderResumePdf(paddedDoc, 2);
    expect(pages).toBe(2);
  });

  it('marker-dirty and legacy-"• "-prefixed bullets paginate identically (renderer strips, never stacks)', async () => {
    const mk = (prefix: string): ResumeDoc => ({
      ...onePageDoc,
      sections: [
        {
          id: 'experience',
          items: Array.from({ length: 20 }, (_, i) => ({
            sourceItemId: `exp-${i}`,
            text: `Role ${i} — Co ${i} (2020-01–present)\n${prefix}Led thing ${i} and shipped many features with lots of measurable impact text ${i}`.repeat(1),
            basis: 'scored',
          })),
        },
      ],
    });
    // legacy rows stored "• x"; new storage is plain; dirty input stacks "• - "
    const legacy = await renderResumePdf(mk('• '), 2);
    const plain = await renderResumePdf(mk(''), 2);
    const dirty = await renderResumePdf(mk('• - '), 2);
    expect(legacy.pages).toBe(plain.pages);
    expect(dirty.pages).toBe(plain.pages);
  });
});
