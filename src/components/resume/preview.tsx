'use client';

import { PDFViewer } from '@react-pdf/renderer';
import { ResumeDocument } from '@/lib/resume/render/document';
import type { ResumeDoc } from '@/lib/domain/types';

/**
 * The on-screen preview IS the exported PDF: the same <ResumeDocument>
 * component the /pdf route renders server-side — what you see is literally
 * what you submit.
 */
export default function Preview({ doc, pageLimit }: { doc: ResumeDoc; pageLimit: 1 | 2 }) {
  return (
    <div className="h-[70vh] overflow-hidden rounded-md border border-zinc-200 shadow-sm dark:border-zinc-800">
      <PDFViewer showToolbar={false} width="100%" height="100%" style={{ border: 0 }}>
        <ResumeDocument doc={doc} pageLimit={pageLimit} />
      </PDFViewer>
    </div>
  );
}
