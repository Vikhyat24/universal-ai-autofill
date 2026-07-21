/**
 * Résumé text → profile fields (heuristic, 100% offline).
 *
 * Given the plain text of a résumé (from paste, .txt, .pdf or .docx), extract
 * best-guess values for canonical FieldKinds. Everything here is deterministic
 * and dependency-free so it is easily unit-tested; the Import UI lets the user
 * review and correct every value before it touches a profile.
 */
import type { FieldKind } from '@/shared/types';

export interface ExtractedResume {
  /** Canonical field values we recognized (only non-empty keys present). */
  fields: Partial<Record<FieldKind, string>>;
  /** The normalized source text (for preview / debugging). */
  raw: string;
}

const DEGREE_RE =
  /\b(ph\.?d|doctorate|m\.?b\.?a|b\.?tech|m\.?tech|b\.?sc|m\.?sc|b\.?s\.?|m\.?s\.?|b\.?e\.?|b\.?a\.?|m\.?a\.?|bachelor(?:'?s)?|master(?:'?s)?|associate(?:'?s)?)\b[^\n,]*/i;

const TITLE_KEYWORDS = [
  'engineer', 'developer', 'manager', 'designer', 'analyst', 'consultant',
  'intern', 'lead', 'director', 'scientist', 'architect', 'administrator',
  'specialist', 'coordinator', 'associate', 'officer', 'accountant', 'nurse',
  'teacher', 'recruiter', 'marketer', 'strategist', 'researcher', 'president',
];

const SECTION_HEADERS = {
  education: /\b(education|academic(?:s| background)?|qualifications?)\b/i,
  experience: /\b(experience|employment|work history|professional background)\b/i,
};

/** Collapse whitespace but keep line breaks — the heuristics rely on lines. */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0020\t\u00A0]+/g, ' ') // collapse spaces, tabs, NBSP (common in PDFs)
    .replace(/[\u0020\t]*\n[\u0020\t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstMatch(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m ? m[0].trim() : undefined;
}

function extractEmail(text: string): string | undefined {
  return firstMatch(text, /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.toLowerCase();
}

/** Pick a plausible phone number (7–15 digits) from the first lines. */
function extractPhone(text: string): string | undefined {
  const candidates = text.match(/\+?[\d][\d\s().-]{6,}\d/g) ?? [];
  for (const c of candidates) {
    const digits = c.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) return c.trim();
  }
  return undefined;
}

function extractUrl(text: string, host: RegExp): string | undefined {
  const re = new RegExp(`(https?://)?(www\\.)?${host.source}[^\\s)|,]*`, 'i');
  const m = text.match(re);
  if (!m) return undefined;
  const url = m[0].replace(/[.,)]+$/, '');
  return url.startsWith('http') ? url : `https://${url}`;
}

/** A general website that isn't email/linkedin/github. */
function extractWebsite(text: string): string | undefined {
  const urls = text.match(/(https?:\/\/)?(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/[^\s)|,]*)?/gi) ?? [];
  for (const raw of urls) {
    const u = raw.replace(/[.,)]+$/, '');
    if (/@/.test(u)) continue;
    if (/linkedin\.com|github\.com/i.test(u)) continue;
    if (/\.(png|jpg|jpeg|gif|pdf)$/i.test(u)) continue;
    // must look like a domain, not a stray "e.g" or "i.e"
    if (!/\.[a-z]{2,}/i.test(u)) continue;
    if (u.length < 5) continue;
    return u.startsWith('http') ? u : `https://${u}`;
  }
  return undefined;
}

const NON_NAME_RE = /\b(resume|curriculum vitae|c\.?v\.?|profile|portfolio)\b/i;

/** The candidate's name — usually the first prominent line of the document. */
function extractName(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 8)) {
    const l = line.trim();
    if (!l || l.length > 45) continue;
    if (/[@\d]/.test(l)) continue;
    if (NON_NAME_RE.test(l)) continue;
    const words = l.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    // Mostly capitalized words (allow ALL CAPS names too).
    const looksName = words.every((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w) || /^[A-Z.'-]+$/.test(w));
    if (looksName) {
      return words
        .map((w) => (w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w))
        .join(' ');
    }
  }
  return undefined;
}

/** "City, ST" / "City, Country" near the top (contact block). */
function extractLocation(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 12)) {
    const m = line.match(/\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*),\s*([A-Z]{2}|[A-Z][a-zA-Z]+)\b/);
    if (m && !NON_NAME_RE.test(line) && !/@/.test(m[0])) return m[0].trim();
  }
  return undefined;
}

/** Index range [start, end) of a résumé section by its header regex. */
function sectionSlice(lines: string[], header: RegExp): string[] {
  const start = lines.findIndex((l) => header.test(l) && l.trim().length < 40);
  if (start < 0) return [];
  const allHeaders = Object.values(SECTION_HEADERS);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().length < 40 && allHeaders.some((h) => h !== header && h.test(lines[i]))) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function pickYear(text: string): string | undefined {
  const years = (text.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
  const cap = new Date().getFullYear() + 8;
  const valid = years.filter((y) => y >= 1950 && y <= cap);
  return valid.length ? String(Math.max(...valid)) : undefined;
}

export function extractResume(rawInput: string): ExtractedResume {
  const raw = normalizeText(rawInput);
  const lines = raw.split('\n');
  const fields: Partial<Record<FieldKind, string>> = {};

  const set = (k: FieldKind, v: string | undefined) => {
    if (v && v.trim()) fields[k] = v.trim();
  };

  // --- contact ---
  set('email', extractEmail(raw));
  set('phone', extractPhone(raw));
  set('linkedin', extractUrl(raw, /linkedin\.com\//));
  set('github', extractUrl(raw, /github\.com\//));
  set('website', extractWebsite(raw));
  set('location', extractLocation(lines));

  // --- name ---
  const name = extractName(lines);
  if (name) {
    set('fullName', name);
    const parts = name.split(/\s+/);
    set('firstName', parts[0]);
    if (parts.length > 1) set('lastName', parts[parts.length - 1]);
  }

  // --- education ---
  const eduLines = sectionSlice(lines, SECTION_HEADERS.education);
  const eduText = (eduLines.length ? eduLines : lines).join('\n');
  set('degree', firstMatch(eduText, DEGREE_RE));
  const college = eduLines.find((l) => /\b(university|college|institute|school of|academy)\b/i.test(l));
  set('college', college?.replace(/\s*[|•,–-].*$/, '').trim());
  set('graduationYear', pickYear(eduText));

  // --- experience (best-effort) ---
  const expLines = sectionSlice(lines, SECTION_HEADERS.experience);
  const titleLine = (expLines.length ? expLines : lines).find((l) =>
    TITLE_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(l)) && l.length < 70,
  );
  if (titleLine) {
    // Split "Title — Company" / "Company | Title" style lines conservatively.
    const parts = titleLine.split(/\s*[|•–—-]\s*|\s+at\s+/i).map((p) => p.trim()).filter(Boolean);
    const titlePart = parts.find((p) => TITLE_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(p)));
    set('jobTitle', titlePart ?? titleLine.trim());
    const companyPart = parts.find((p) => p !== titlePart && !/\d{4}/.test(p));
    if (parts.length > 1) set('company', companyPart);
  }

  return { fields, raw };
}
