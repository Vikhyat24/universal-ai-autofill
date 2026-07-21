/**
 * PDF → text extraction using pdf.js, fully offline.
 *
 * This module is intentionally isolated so it can be lazy-loaded (`readers.ts`
 * only imports it when the user actually opens a PDF), keeping pdf.js out of
 * the initial options bundle. The worker is bundled by Vite (`?worker`) and
 * loaded from the extension origin, which is CSP-safe under MV3.
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
// Vite compiles this into a bundled module worker asset.
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

export async function pdfToText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  try {
    let out = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const t = item as TextItem;
        out += t.str;
        out += t.hasEOL ? '\n' : ' ';
      }
      out += '\n';
      page.cleanup();
    }
    return out;
  } finally {
    await doc.destroy();
  }
}
