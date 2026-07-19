import { describe, it, expect } from 'vitest';
import { mapField, bestOptionIndex, type MapperContext } from './mapper';
import { normalize, similarity, fieldSignature, type FieldSignals } from './signals';

const ctx: MapperContext = { learned: [], customKeys: [], semantic: true };

function signals(partial: Partial<FieldSignals>): FieldSignals {
  return {
    label: '', placeholder: '', name: '', id: '', ariaLabel: '', autocomplete: '',
    inputType: 'text', nearbyText: '', sectionHeading: '', className: '', dataAttrs: '',
    ...partial,
  };
}

describe('normalize', () => {
  it('splits camelCase and snake_case', () => {
    expect(normalize('candidateMailId')).toBe('candidate mail id');
    expect(normalize('user_email')).toBe('user email');
    expect(normalize('First-Name*')).toBe('first name');
  });
});

describe('similarity', () => {
  it('is 1 for identical, high for near strings', () => {
    expect(similarity('email', 'email')).toBe(1);
    expect(similarity('emailaddress', 'email address')).toBeGreaterThan(0.8);
    expect(similarity('email', 'phone')).toBeLessThan(0.3);
  });
});

describe('mapField — canonical cases', () => {
  it('maps standard autocomplete with top confidence', () => {
    const r = mapField(signals({ autocomplete: 'given-name', name: 'x1' }), ctx);
    expect(r.kind).toBe('firstName');
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it('maps label variants of first name', () => {
    for (const label of ['First Name', 'Given Name', 'Forename']) {
      expect(mapField(signals({ label }), ctx).kind).toBe('firstName');
    }
  });

  it('maps "Your Name" / "Applicant Name" to fullName', () => {
    for (const label of ['Your Name', 'Applicant Name', 'Full Name']) {
      expect(mapField(signals({ label }), ctx).kind).toBe('fullName');
    }
  });

  it('maps unusual email names semantically', () => {
    for (const name of ['candidate_mail', 'mailid', 'user_email', 'contactEmail']) {
      const r = mapField(signals({ name }), ctx);
      expect(r.kind, `name=${name}`).toBe('email');
    }
  });

  it('maps email label variants', () => {
    for (const label of ['Email Address', 'E-mail', 'Work Email', 'Personal Email']) {
      expect(mapField(signals({ label }), ctx).kind).toBe('email');
    }
  });

  it('does not confuse first and last name', () => {
    expect(mapField(signals({ label: 'Last Name' }), ctx).kind).toBe('lastName');
    expect(mapField(signals({ name: 'lname' }), ctx).kind).toBe('lastName');
  });

  it('vetoes fullName for company name', () => {
    const r = mapField(signals({ label: 'Company Name' }), ctx);
    expect(r.kind).toBe('company');
  });

  it('maps phone via type and label', () => {
    expect(mapField(signals({ inputType: 'tel' }), ctx).kind).toBe('phone');
    expect(mapField(signals({ label: 'Mobile Number' }), ctx).kind).toBe('phone');
  });

  it('distinguishes address lines', () => {
    expect(mapField(signals({ label: 'Address Line 1' }), ctx).kind).toBe('addressLine1');
    expect(mapField(signals({ label: 'Address Line 2' }), ctx).kind).toBe('addressLine2');
    expect(mapField(signals({ label: 'ZIP Code' }), ctx).kind).toBe('zip');
    expect(mapField(signals({ label: 'Postal Code' }), ctx).kind).toBe('zip');
  });

  it('maps professional/education fields', () => {
    expect(mapField(signals({ label: 'LinkedIn Profile' }), ctx).kind).toBe('linkedin');
    expect(mapField(signals({ label: 'GitHub URL' }), ctx).kind).toBe('github');
    expect(mapField(signals({ label: 'Current Employer' }), ctx).kind).toBe('company');
    expect(mapField(signals({ label: 'Job Title' }), ctx).kind).toBe('jobTitle');
    expect(mapField(signals({ label: 'University Name' }), ctx).kind).toBe('college');
    expect(mapField(signals({ label: 'Year of Passing' }), ctx).kind).toBe('graduationYear');
  });

  it('maps date of birth', () => {
    expect(mapField(signals({ label: 'Date of Birth' }), ctx).kind).toBe('dateOfBirth');
    expect(mapField(signals({ name: 'dob', inputType: 'date' }), ctx).kind).toBe('dateOfBirth');
  });

  it('returns unknown for unrelated fields', () => {
    const r = mapField(signals({ label: 'Coupon Code', name: 'coupon' }), ctx);
    expect(r.kind).toBe('unknown');
  });

  it('never maps confirm-email to email blindly', () => {
    const r = mapField(signals({ label: 'Confirm Email' }), ctx);
    // veto means low/no email signal from the label
    expect(r.confidence).toBeLessThan(0.9);
  });
});

describe('mapField — learned + custom', () => {
  it('prefers learned mappings', () => {
    const sig = fieldSignature(signals({ name: 'weird_x91' }));
    const r = mapField(signals({ name: 'weird_x91' }), {
      ...ctx,
      learned: [{ signature: sig, kind: 'phone', votes: 3, updatedAt: 0 }],
    });
    expect(r.kind).toBe('phone');
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it('matches custom field keys fuzzily', () => {
    const r = mapField(signals({ label: 'Passport Number' }), {
      ...ctx,
      customKeys: ['Passport Number'],
    });
    expect(r.kind).toBe('custom');
    expect(r.customKey).toBe('Passport Number');
  });
});

describe('bestOptionIndex', () => {
  it('matches select options by label', () => {
    const opts = ['-- Select --', 'India', 'United States', 'United Kingdom'];
    expect(bestOptionIndex(opts, 'United States')).toBe(2);
    expect(bestOptionIndex(opts, 'India')).toBe(1);
  });

  it('rejects weak matches', () => {
    expect(bestOptionIndex(['Red', 'Blue'], 'Software Engineer')).toBe(-1);
  });

  it('handles gender selects', () => {
    const opts = ['Select', 'Male', 'Female', 'Prefer not to say'];
    expect(bestOptionIndex(opts, 'Prefer not to say')).toBe(3);
  });
});
