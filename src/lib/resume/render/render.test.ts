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
    const bytes = await renderResumePdf(onePageDoc, 1);
    const count = await pdfPageCount(bytes);
    expect(count).toBe(1);
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

    const bytes = await renderResumePdf(paddedDoc, 2);
    const count = await pdfPageCount(bytes);
    expect(count).toBe(2);
  });
});
