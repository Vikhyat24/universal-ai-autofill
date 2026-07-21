/**
 * Shared type definitions used across background, content, popup and options.
 */

/** Canonical field kinds the extension understands. Extend freely. */
export type FieldKind =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'middleName'
  | 'email'
  | 'phone'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'state'
  | 'country'
  | 'zip'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'website'
  | 'company'
  | 'jobTitle'
  | 'college'
  | 'degree'
  | 'graduationYear'
  | 'dateOfBirth'
  | 'nationality'
  | 'gender'
  | 'password'
  | 'username'
  | 'salary'
  | 'coverLetter'
  | 'yearsExperience'
  // Job-application specifics
  | 'pronouns'
  | 'location'
  | 'workAuthorization'
  | 'sponsorship'
  | 'noticePeriod'
  | 'startDate'
  | 'relocate'
  | 'references'
  // Equal-opportunity (optional, off by default)
  | 'veteranStatus'
  | 'disabilityStatus'
  | 'ethnicity'
  | 'custom'
  | 'unknown';

/** A single stored value inside a profile. */
export interface ProfileField {
  /** Canonical kind, or 'custom' with a user-supplied key. */
  kind: FieldKind;
  /** For custom fields: user-defined key, e.g. "Passport Number". */
  customKey?: string;
  value: string;
}

/** A user profile ("Personal", "Job Applications", ...). */
export interface Profile {
  id: string;
  name: string;
  emoji?: string;
  fields: ProfileField[];
  createdAt: number;
  updatedAt: number;
}

/** Learned alias: maps a site-specific signature to a field kind. */
export interface LearnedMapping {
  /** Normalized signature (e.g. "candidate_mail" or hostname::fieldsig). */
  signature: string;
  kind: FieldKind;
  customKey?: string;
  /** Confidence votes — bumped each time the user confirms. */
  votes: number;
  updatedAt: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';

/** Per-site autofill behavior override. */
export type SiteRuleMode = 'auto' | 'review' | 'off';

export interface Settings {
  aiMappingEnabled: boolean;
  theme: ThemeMode;
  defaultProfileId: string | null;
  ignoredHosts: string[];
  autofillOnLoad: boolean;
  confirmBeforeFill: boolean;
  showFloatingButton: boolean;
  smartLearning: boolean;
  /** Per-hostname preferred profile. */
  siteProfiles: Record<string, string>;
  /** Per-hostname behavior override: auto-fill / always-review / off. */
  siteRules: Record<string, SiteRuleMode>;
  encryptionEnabled: boolean;
}

/** Aggregate usage statistics (local only). */
export interface FillStats {
  /** Total individual fields filled, all-time. */
  totalFilled: number;
  /** Total fill actions (forms) performed. */
  totalForms: number;
  /** Fields filled per hostname. */
  perHost: Record<string, number>;
  /** Timestamp of the first recorded fill. */
  firstAt: number;
}

/** Serializable description of a detected form field (content → UI). */
export interface DetectedFieldInfo {
  /** Stable per-scan id used to reference the live element. */
  fieldId: string;
  /** Best human label we derived for the field. */
  label: string;
  /** Input element type: text, email, select, radio, checkbox, textarea... */
  elementType: string;
  /** Matched canonical kind (or unknown). */
  kind: FieldKind;
  customKey?: string;
  /** 0..1 match confidence. */
  confidence: number;
  /** Value that would be filled (from active profile). */
  proposedValue: string;
  /** Current value in the field, if any. */
  currentValue: string;
  /** Nearest section heading / fieldset legend (for grouping in review UI). */
  section?: string;
  /** Raw signals for debugging / learning. */
  signature: string;
}

export interface DetectionSummary {
  url: string;
  hostname: string;
  formCount: number;
  fields: DetectedFieldInfo[];
}

/** A record of a past fill, shown in popup "Recent Forms". */
export interface RecentForm {
  hostname: string;
  url: string;
  filledCount: number;
  profileId: string;
  timestamp: number;
}

/** Message protocol between contexts. */
export type RuntimeMessage =
  | { type: 'PING' }
  | { type: 'DETECT_FIELDS'; profileId?: string }
  | { type: 'AUTOFILL'; profileId?: string; onlyFieldIds?: string[]; overrides?: Record<string, string> }
  | { type: 'AUTOFILL_RESULT'; filled: number; total: number }
  | { type: 'OPEN_REVIEW' }
  | { type: 'GET_STATE' }
  | { type: 'COMMAND'; command: string }
  | { type: 'LEARN_MAPPING'; mapping: LearnedMapping }
  | { type: 'CONTEXT_AUTOFILL' };

export interface RuntimeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Exported backup shape (versioned for forward compatibility). */
export interface BackupPayload {
  version: 1 | 2;
  exportedAt: number;
  profiles: Profile[];
  settings: Settings;
  learned: LearnedMapping[];
  recentForms: RecentForm[];
  /** v2+: aggregate usage stats. */
  stats?: FillStats;
}

/** Password-protected export envelope (AES-GCM, PBKDF2-derived key). */
export interface EncryptedBackup {
  format: 'uaf-encrypted';
  v: 1;
  /** Base64 PBKDF2 salt. */
  salt: string;
  /** Base64 AES-GCM iv. */
  iv: string;
  /** PBKDF2 iteration count. */
  iterations: number;
  /** Base64 ciphertext of a JSON BackupPayload. */
  data: string;
}
