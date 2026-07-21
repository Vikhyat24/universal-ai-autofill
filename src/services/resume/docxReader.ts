/**
 * DOCX → text extraction, fully offline.
 *
 * A .docx is a ZIP whose main text lives in `word/document.xml`. We unzip with
 * fflate (tiny, no network), turn paragraph/break tags into newlines, strip the
 * remaining XML, and decode entities. Isolated for lazy-loading via readers.ts.
 */
import { unzipSync, strFromU8 } from 'fflate';

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

export async function docxToText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = unzipSync(buf, { filter: (f) => f.name === 'word/document.xml' });
  const doc = files['word/document.xml'];
  if (!doc) throw new Error('Not a valid .docx (missing word/document.xml).');

  const xml = strFromU8(doc);
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/?>/g, ' ')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ''));
}
