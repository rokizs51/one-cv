import React from 'react';
import { Document, Page, Text, View, Link, StyleSheet } from '@react-pdf/renderer';
import type { ResumeDoc, ResumeDocItem, ResumeEntryHeader, SectionId } from '@/lib/domain/types';
import { structureFromText, formatDatesInText } from '@/lib/domain/canonical';

/**
 * The printed CV, structured to the ATS reference in
 * docs/cv-structure-reference.md:
 *   Contact header → PROFESSIONAL SUMMARY → WORK EXPERIENCE → SKILLS →
 *   EDUCATION → optional tail (PROJECTS, AWARDS, LANGUAGES).
 * Single column, Helvetica 10–16, standard section labels verbatim (ATS
 * parsers key on them), hairline rules only — no tables, boxes, or columns.
 */
const SECTION_LABEL: Record<SectionId, string> = {
  summary: 'PROFESSIONAL SUMMARY',
  experience: 'WORK EXPERIENCE',
  skills: 'SKILLS',
  education: 'EDUCATION',
  certifications: 'CERTIFICATIONS',
  projects: 'PROJECTS',
  awards: 'AWARDS',
  languages: 'LANGUAGES',
};

// Skills and languages read best (and scan fine) as one compact block per
// section rather than one line per entry.
const JOINED_SECTIONS: ReadonlySet<SectionId> = new Set(['skills', 'languages']);

const styles = StyleSheet.create({
  page: {
    padding: 42,
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.35,
    color: '#000000',
  },
  // --- contact header ---
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  contactLine: {
    fontSize: 10,
    marginBottom: 1,
  },
  // clickable but print-plain: black, no underline
  contactLink: {
    fontSize: 10,
    color: '#000000',
    textDecoration: 'none',
  },
  headerRule: {
    marginTop: 6,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  // --- sections ---
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 1,
    // keep ≥2 lines of the section's content on this page, else the title
    // moves to the next one — no orphaned headings at page bottom
    minPresenceAhead: 24,
  },
  sectionRule: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#666666',
    marginBottom: 5,
  },
  // --- entries ---
  entry: {
    marginBottom: 5,
  },
  entryHead: {
    fontWeight: 'bold',
  },
  // The renderer owns the marker: storage is plain text, and any marker a
  // legacy row still carries is stripped before this is drawn. The marker is
  // a fixed-width column so wrapped lines align past it (hanging indent).
  bulletRow: {
    flexDirection: 'row',
  },
  bulletMarker: {
    width: 12,
  },
  bulletText: {
    flex: 1,
  },
  body: {
    marginBottom: 2,
  },
  entryMeta: {
    fontSize: 9,
    marginBottom: 2,
  },
});

function headerLine(h: ResumeEntryHeader): React.ReactNode {
  return (
    <>
      {h.title}
      {h.company !== '' ? ` — ${h.company}` : ''}
      {h.dates !== '' ? ` (${h.dates})` : ''}
    </>
  );
}

/** Experience entry drawn from its typed fields; docs stored before the
 * structured change fall back to deriving them from `text` once. */
function ExperienceEntry({ item }: { item: ResumeDocItem }) {
  const s = item.header ? item : structureFromText('experience', item.text);
  const header = s.header;
  const bullets = s.bullets ?? [];
  const technologies = s.technologies ?? [];
  const meta = [header?.location, header?.employmentType].filter(Boolean).join('  •  ');
  return (
    // wrap={false}: an entry stays whole across page breaks where practical
    <View style={styles.entry} wrap={false}>
      {header && <Text style={bullets.length > 0 ? styles.entryHead : undefined}>{headerLine(header)}</Text>}
      {meta !== '' && <Text style={styles.entryMeta}>{meta}</Text>}
      {bullets.map((line, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletMarker}>•</Text>
          <Text style={styles.bulletText}>{line}</Text>
        </View>
      ))}
      {technologies.length > 0 && (
        <Text style={styles.entryMeta}>Technologies: {technologies.join(', ')}</Text>
      )}
    </View>
  );
}

/** Projects: name bold, one-line description, technologies bold — drawn from
 * typed fields, with the legacy text parse as the fallback. */
function ProjectEntry({ item }: { item: ResumeDocItem }) {
  const s = item.header ? item : structureFromText('projects', item.text);
  const name = s.header?.title ?? '';
  const description = s.description ?? '';
  const technologies = s.technologies ?? [];
  return (
    <View style={styles.entry}>
      <Text>
        <Text style={styles.entryHead}>{name}</Text>
        {description !== '' ? ` — ${description}` : ''}
        {technologies.length > 0 && <Text style={styles.entryHead}>{` (${technologies.join(', ')})`}</Text>}
      </Text>
    </View>
  );
}

/** Education / certifications / awards / languages: one display line each. */
function LineEntry({ text }: { text: string }) {
  return <Text style={styles.body}>{formatDatesInText(text)}</Text>;
}

/** Group categorized skill items for one labeled line per category
 * (first-appearance order); uncategorized items trail as one unlabeled group. */
function groupSkillsByCategory(
  items: ResumeDocItem[]
): { category: string | null; items: ResumeDocItem[] }[] {
  const order: (string | null)[] = [];
  const byCat = new Map<string | null, ResumeDocItem[]>();
  for (const item of items) {
    const cat = item.category ?? null;
    if (!byCat.has(cat)) {
      byCat.set(cat, []);
      order.push(cat);
    }
    byCat.get(cat)!.push(item);
  }
  // uncategorized last, whatever its position in the list
  order.sort((a, b) => (a === null ? 1 : b === null ? -1 : 0));
  return order.map((cat) => ({ category: cat, items: byCat.get(cat)! }));
}

interface ResumeDocumentProps {
  doc: ResumeDoc;
  pageLimit: 1 | 2;
}

// pageLimit is intentionally not consumed here: pagination is the honest
// auto-flow (breakInside/minPresenceAhead), and the ACTUAL rendered count is
// measured post-render in render.ts (pdfPageCount) — shrinking or truncating
// to hit the limit is a hard anti-goal.
export function ResumeDocument({ doc }: ResumeDocumentProps) {
  const { header, summary, sections } = doc;

  const contact = [header.email, header.phone, header.location].filter(Boolean).join('  •  ');
  const links = header.links.length > 0 ? header.links.join('  •  ') : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 1. Contact header */}
        <View>
          <Text style={styles.name}>{header.fullName}</Text>
          {contact !== '' && <Text style={styles.contactLine}>{contact}</Text>}
          {links && (
            <View style={styles.bulletRow}>
              {header.links.map((l, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <Text style={styles.contactLine}>  •  </Text>}
                  <Link
                    src={/^https?:\/\//.test(l) ? l : `https://${l}`}
                    style={styles.contactLink}
                  >
                    {l.replace(/^https?:\/\//, '')}
                  </Link>
                </React.Fragment>
              ))}
            </View>
          )}
          <View style={styles.headerRule} />
        </View>

        {/* 2. Professional summary — always labeled, never floating */}
        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{SECTION_LABEL.summary}</Text>
            <View style={styles.sectionRule} />
            <Text style={styles.body}>{summary}</Text>
          </View>
        )}

        {/* 3+. Sections in orderSections() order, standard labels */}
        {sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{SECTION_LABEL[section.id]}</Text>
            <View style={styles.sectionRule} />
            {JOINED_SECTIONS.has(section.id) ? (
              // Categorized skills: one "Category: a, b" line per group, in
              // first-appearance order; uncategorized entries trail unlabeled.
              section.id === 'skills' && section.items.some((i) => i.category) ? (
                groupSkillsByCategory(section.items).map((g) => (
                  <Text key={g.category ?? '_'} style={styles.body}>
                    {g.category ? (
                      <Text style={styles.entryHead}>{`${g.category}: `}</Text>
                    ) : null}
                    {g.items.map((i) => i.text).join(', ')}
                  </Text>
                ))
              ) : // Short names join into one compact block; once an entry carries
              // a description, comma-joining turns it into an unreadable blob
              // — give every entry its own line instead.
              section.items.some((i) => i.text.length > 48) ? (
                section.items.map((i) => (
                  <Text key={i.sourceItemId} style={styles.body}>
                    {i.text}
                  </Text>
                ))
              ) : (
                <Text style={styles.body}>{section.items.map((i) => i.text).join(', ')}</Text>
              )
            ) : (
              section.items.map((item) =>
                section.id === 'projects' ? (
                  <ProjectEntry key={item.sourceItemId} item={item} />
                ) : section.id === 'experience' ? (
                  <ExperienceEntry key={item.sourceItemId} item={item} />
                ) : (
                  <LineEntry key={item.sourceItemId} text={item.text} />
                )
              )
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
