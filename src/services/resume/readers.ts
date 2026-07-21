/**
 * Résumé source → plain text dispatcher.
 *
 * PDF and DOCX readers are code-split and imported on demand so their parsing
 * libraries (pdf.js, fflate) never load unless the user actually opens such a
 * file. TXT and pasted text need no dependencies.
 */
export type ResumeSource = { kind: 'file'; file: File } | { kind: 'text'; text: string };

export const ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt,text/plain,application/pdf';

export async function readResumeText(src: ResumeSource): Promise<string> {
  if (src.kind === 'text') return src.text;

  const { file } = src;
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { pdfToText } = await import('./pdfReader');
    return pdfToText(file);
  }
  if (name.endsWith('.docx') || file.type.includes('officedocument.wordprocessingml')) {
    const { docxToText } = await import('./docxReader');
    return docxToText(file);
  }
  if (name.endsWith('.txt') || file.type.startsWith('text/')) {
    return file.text();
  }
  if (name.endsWith('.doc')) {
    throw new Error('Legacy .doc files are not supported — save as .docx or PDF, or paste the text.');
  }
  throw new Error('Unsupported file. Use a PDF, DOCX, or TXT file, or paste the text.');
}
