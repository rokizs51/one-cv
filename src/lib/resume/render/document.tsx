import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ResumeDoc } from '@/lib/domain/types';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  contact: {
    fontSize: 9,
    marginBottom: 2,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  item: {
    marginBottom: 4,
  },
  summary: {
    marginBottom: 10,
  },
});

interface ResumeDocumentProps {
  doc: ResumeDoc;
  pageLimit: 1 | 2;
}

export function ResumeDocument({ doc, pageLimit }: ResumeDocumentProps) {
  const { header, summary, sections } = doc;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{header.fullName}</Text>
          <Text style={styles.contact}>{header.email}</Text>
          {header.phone && <Text style={styles.contact}>{header.phone}</Text>}
          {header.location && <Text style={styles.contact}>{header.location}</Text>}
          {header.links.length > 0 && (
            <Text style={styles.contact}>{header.links.join(' | ')}</Text>
          )}
        </View>

        {/* Summary */}
        {summary && <Text style={styles.summary}>{summary}</Text>}

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.id}</Text>
            {section.items.map((item, idx) => (
              <Text key={idx} style={styles.item}>
                {item.text}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
