import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import type { ResumeDoc } from '@/lib/domain/types';
import { ResumeDocument } from './document';

/**
 * Renders a ResumeDoc to a PDF buffer.
 * Returns Uint8Array for portability.
 */
export async function renderResumePdf(
  doc: ResumeDoc,
  pageLimit: 1 | 2,
): Promise<Uint8Array> {
  // renderToBuffer's type demands a <Document>-rooted element; the component
  // produces that <Document> at render time, but React.createElement can only
  // infer the component's own props type. Cast to the renderer's expected arg.
  const element = React.createElement(ResumeDocument, { doc, pageLimit });
  const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  return new Uint8Array(buffer);
}

/**
 * Counts the number of pages in a PDF buffer.
 * Dev+test export for verifying page counts.
 */
export async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  // pdf-lib expects the bytes to be mutable, so copy if needed
  const mutableBytes = bytes.slice();
  const pdfDoc = await PDFDocument.load(mutableBytes);
  return pdfDoc.getPageCount();
}
