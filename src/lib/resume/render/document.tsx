import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ResumeDoc, SectionId } from '@/lib/domain/types';

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
  // canonicalText bullets arrive already prefixed with "• " — indent, don't re-add
  entryBullet: {
    paddingLeft: 12,
  },
  body: {
    marginBottom: 2,
  },
});

/** Canonical experience text is "Role — Company (dates)\n• b1\n• b2". */
function Entry({ text }: { text: string }) {
  const lines = text.split('\n');
  const head = lines[0];
  const rest = lines.slice(1).filter((l) => l.trim() !== '');
  return (
    <View style={styles.entry}>
      <Text style={rest.length > 0 ? styles.entryHead : undefined}>{head}</Text>
      {rest.map((line, i) => (
        <Text key={i} style={styles.entryBullet}>
          {line}
        </Text>
      ))}
    </View>
  );
}

interface ResumeDocumentProps {
  doc: ResumeDoc;
  pageLimit: 1 | 2;
}

export function ResumeDocument({ doc, pageLimit }: ResumeDocumentProps) {
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
          {links && <Text style={styles.contactLine}>{links}</Text>}
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
              // Short names join into one compact block; once an entry carries
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
              section.items.map((item) => <Entry key={item.sourceItemId} text={item.text} />)
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
