import { describe, it, expect } from 'vitest';
import { extractResume } from './extract';

const SAMPLE = `JANE M. DOE
San Francisco, CA
jane.doe@example.com | +1 (555) 123-4567
linkedin.com/in/janedoe · github.com/janedoe · janedoe.dev

SUMMARY
Passionate software engineer with 6 years of experience.

EXPERIENCE
Senior Software Engineer — Acme Corp
2021 - Present
- Built things.

Software Engineer at Globex
2019 - 2021

EDUCATION
Massachusetts Institute of Technology
B.S. in Computer Science, 2019

SKILLS
TypeScript, React, Node.js
`;

describe('extractResume', () => {
  const { fields } = extractResume(SAMPLE);

  it('extracts contact fields', () => {
    expect(fields.email).toBe('jane.doe@example.com');
    expect(fields.phone?.replace(/\D/g, '')).toBe('15551234567');
    expect(fields.linkedin).toBe('https://linkedin.com/in/janedoe');
    expect(fields.github).toBe('https://github.com/janedoe');
    expect(fields.location).toBe('San Francisco, CA');
  });

  it('extracts and splits the name', () => {
    expect(fields.fullName).toBe('Jane M. Doe');
    expect(fields.firstName).toBe('Jane');
    expect(fields.lastName).toBe('Doe');
  });

  it('extracts education', () => {
    expect(fields.college).toMatch(/Massachusetts Institute of Technology/);
    expect(fields.degree).toMatch(/B\.?S\.?/i);
    expect(fields.graduationYear).toBe('2019');
  });

  it('extracts a job title from the experience section', () => {
    expect(fields.jobTitle).toMatch(/Engineer/i);
  });

  it('returns no fields for empty input', () => {
    expect(Object.keys(extractResume('').fields)).toHaveLength(0);
  });

  it('does not treat a section heading as a name', () => {
    const { fields: f } = extractResume('RESUME\nActually Nothing Here 12345');
    expect(f.fullName).toBeUndefined();
  });
});
