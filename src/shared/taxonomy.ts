/**
 * Field taxonomy: the semantic knowledge base that powers field recognition.
 *
 * Each canonical FieldKind gets:
 *  - keywords:   token fragments matched against normalized signals
 *  - phrases:    multi-word phrases matched against label-ish text
 *  - autocomplete: HTML autocomplete attribute values (highest confidence)
 *  - inputTypes: HTML input types that hint the kind
 *  - negative:   tokens that veto a match (e.g. "last" vetoes firstName)
 *
 * This is deliberately data-driven so an LLM-based mapper can be swapped in
 * later (see services/mapping/): the taxonomy is just the offline default.
 */
import type { FieldKind } from './types';

export interface KindSpec {
  kind: FieldKind;
  label: string;
  keywords: string[];
  phrases: string[];
  autocomplete: string[];
  inputTypes?: string[];
  negative?: string[];
  /** Example value shown as placeholder in profile editor. */
  example?: string;
}

export const TAXONOMY: KindSpec[] = [
  {
    kind: 'email',
    label: 'Email',
    keywords: ['email', 'e-mail', 'mail', 'mailid', 'emailaddress', 'courriel', 'correo'],
    phrases: ['email address', 'e mail', 'work email', 'personal email', 'contact email', 'your email', 'candidate mail', 'user email'],
    autocomplete: ['email'],
    inputTypes: ['email'],
    negative: ['confirm', 'verify', 'mailing address', 'mail address line'],
    example: 'jane@example.com',
  },
  {
    kind: 'firstName',
    label: 'First Name',
    keywords: ['firstname', 'fname', 'first', 'given', 'givenname', 'forename', 'prenom'],
    phrases: ['first name', 'given name', 'fore name'],
    autocomplete: ['given-name'],
    negative: ['last', 'family', 'sur', 'middle', 'full'],
    example: 'Jane',
  },
  {
    kind: 'lastName',
    label: 'Last Name',
    keywords: ['lastname', 'lname', 'last', 'surname', 'familyname', 'family', 'apellido', 'nom'],
    phrases: ['last name', 'family name', 'sur name'],
    autocomplete: ['family-name'],
    negative: ['first', 'given', 'middle', 'full'],
    example: 'Doe',
  },
  {
    kind: 'middleName',
    label: 'Middle Name',
    keywords: ['middlename', 'middle', 'mname', 'middleinitial'],
    phrases: ['middle name', 'middle initial'],
    autocomplete: ['additional-name'],
    negative: ['first', 'last'],
    example: 'M.',
  },
  {
    kind: 'fullName',
    label: 'Full Name',
    keywords: ['fullname', 'name', 'yourname', 'applicantname', 'candidatename', 'contactname', 'displayname', 'realname'],
    phrases: ['full name', 'your name', 'applicant name', 'candidate name', 'complete name', 'legal name', 'name as per'],
    autocomplete: ['name'],
    negative: [
      'first', 'last', 'middle', 'user', 'company', 'business', 'school', 'college',
      'university', 'father', 'mother', 'file', 'project', 'card', 'bank', 'account', 'pet',
    ],
    example: 'Jane M. Doe',
  },
  {
    kind: 'phone',
    label: 'Phone',
    keywords: ['phone', 'mobile', 'tel', 'telephone', 'cell', 'phonenumber', 'mobileno', 'contactno', 'whatsapp', 'telefono'],
    phrases: ['phone number', 'mobile number', 'contact number', 'cell phone', 'daytime phone', 'telephone number'],
    autocomplete: ['tel', 'tel-national', 'tel-local'],
    inputTypes: ['tel'],
    negative: ['extension', 'country code'],
    example: '+1 555 123 4567',
  },
  {
    kind: 'addressLine1',
    label: 'Address Line 1',
    keywords: ['address', 'address1', 'addressline1', 'street', 'streetaddress', 'addr1', 'line1'],
    phrases: ['address line 1', 'street address', 'address 1', 'mailing address', 'home address', 'current address', 'permanent address'],
    autocomplete: ['address-line1', 'street-address'],
    negative: ['2', 'line 2', 'email', 'ip', 'web', 'city', 'state', 'zip', 'country'],
    example: '221B Baker Street',
  },
  {
    kind: 'addressLine2',
    label: 'Address Line 2',
    keywords: ['address2', 'addressline2', 'addr2', 'line2', 'apartment', 'suite', 'unit', 'apt', 'flat'],
    phrases: ['address line 2', 'address 2', 'apt suite', 'apartment suite', 'suite unit'],
    autocomplete: ['address-line2'],
    example: 'Apt 4',
  },
  {
    kind: 'city',
    label: 'City',
    keywords: ['city', 'town', 'locality', 'ciudad', 'ville', 'district'],
    phrases: ['city town', 'your city'],
    autocomplete: ['address-level2'],
    example: 'London',
  },
  {
    kind: 'state',
    label: 'State / Province',
    keywords: ['state', 'province', 'region', 'county', 'territory'],
    phrases: ['state province', 'state region'],
    autocomplete: ['address-level1'],
    negative: ['united states', 'statement'],
    example: 'California',
  },
  {
    kind: 'country',
    label: 'Country',
    keywords: ['country', 'nation', 'pais'],
    phrases: ['country region'],
    autocomplete: ['country', 'country-name'],
    negative: ['county', 'code'],
    example: 'United States',
  },
  {
    kind: 'zip',
    label: 'ZIP / Postal Code',
    keywords: ['zip', 'zipcode', 'postal', 'postcode', 'postalcode', 'pincode', 'pin'],
    phrases: ['zip code', 'postal code', 'post code', 'pin code'],
    autocomplete: ['postal-code'],
    example: '94105',
  },
  {
    kind: 'linkedin',
    label: 'LinkedIn',
    keywords: ['linkedin', 'linkedinurl', 'linkedinprofile'],
    phrases: ['linked in', 'linkedin profile', 'linkedin url'],
    autocomplete: [],
    example: 'https://linkedin.com/in/janedoe',
  },
  {
    kind: 'github',
    label: 'GitHub',
    keywords: ['github', 'githuburl', 'gitlab', 'bitbucket'],
    phrases: ['github profile', 'github url', 'git hub'],
    autocomplete: [],
    example: 'https://github.com/janedoe',
  },
  {
    kind: 'portfolio',
    label: 'Portfolio',
    keywords: ['portfolio', 'portfoliourl', 'worksamples'],
    phrases: ['portfolio url', 'portfolio link', 'work samples', 'personal portfolio'],
    autocomplete: [],
    example: 'https://janedoe.dev',
  },
  {
    kind: 'website',
    label: 'Website',
    keywords: ['website', 'site', 'homepage', 'url', 'weburl', 'blog', 'personalsite'],
    phrases: ['personal website', 'web site', 'your website', 'home page'],
    autocomplete: ['url'],
    inputTypes: ['url'],
    negative: ['linkedin', 'github', 'portfolio', 'company'],
    example: 'https://janedoe.dev',
  },
  {
    kind: 'company',
    label: 'Company',
    keywords: ['company', 'employer', 'organization', 'organisation', 'org', 'companyname', 'business', 'firm', 'workplace'],
    phrases: ['company name', 'current employer', 'organization name', 'current company', 'business name'],
    autocomplete: ['organization'],
    example: 'Acme Corp',
  },
  {
    kind: 'jobTitle',
    label: 'Job Title',
    keywords: ['jobtitle', 'title', 'designation', 'role', 'position', 'occupation', 'profession', 'currentrole'],
    phrases: ['job title', 'current title', 'current position', 'your role', 'current role', 'job role'],
    autocomplete: ['organization-title'],
    negative: ['mr', 'mrs', 'salutation', 'book', 'page'],
    example: 'Software Engineer',
  },
  {
    kind: 'college',
    label: 'College / University',
    keywords: ['college', 'university', 'school', 'institution', 'institute', 'almamater', 'campus'],
    phrases: ['college name', 'university name', 'school name', 'educational institution', 'alma mater'],
    autocomplete: [],
    negative: ['high school year', 'schooling'],
    example: 'MIT',
  },
  {
    kind: 'degree',
    label: 'Degree',
    keywords: ['degree', 'qualification', 'education', 'major', 'course', 'branch', 'specialization', 'fieldofstudy'],
    phrases: ['degree name', 'highest qualification', 'field of study', 'highest degree', 'education level'],
    autocomplete: [],
    example: 'B.S. Computer Science',
  },
  {
    kind: 'graduationYear',
    label: 'Graduation Year',
    keywords: ['graduationyear', 'gradyear', 'passingyear', 'yearofpassing', 'batch', 'classof'],
    phrases: ['graduation year', 'year of graduation', 'passing year', 'year of passing', 'class of', 'expected graduation'],
    autocomplete: [],
    example: '2024',
  },
  {
    kind: 'dateOfBirth',
    label: 'Date of Birth',
    keywords: ['dob', 'dateofbirth', 'birthdate', 'birthday', 'born'],
    phrases: ['date of birth', 'birth date', 'your birthday'],
    autocomplete: ['bday'],
    inputTypes: ['date'],
    example: '1998-04-12',
  },
  {
    kind: 'nationality',
    label: 'Nationality',
    keywords: ['nationality', 'citizenship', 'citizen'],
    phrases: ['your nationality', 'country of citizenship'],
    autocomplete: [],
    example: 'Indian',
  },
  {
    kind: 'gender',
    label: 'Gender',
    keywords: ['gender', 'sex'],
    phrases: ['your gender', 'gender identity'],
    autocomplete: ['sex'],
    example: 'Prefer not to say',
  },
  {
    kind: 'username',
    label: 'Username',
    keywords: ['username', 'userid', 'login', 'loginid', 'handle', 'screenname'],
    phrases: ['user name', 'user id', 'login id'],
    autocomplete: ['username'],
    negative: ['email'],
    example: 'janedoe',
  },
  {
    kind: 'password',
    label: 'Password',
    keywords: ['password', 'passwd', 'pwd', 'passcode'],
    phrases: ['your password', 'create password'],
    autocomplete: ['current-password', 'new-password'],
    inputTypes: ['password'],
    negative: ['confirm', 'retype', 'reenter'],
    example: '',
  },
  {
    kind: 'salary',
    label: 'Expected Salary',
    keywords: ['salary', 'ctc', 'compensation', 'expectedsalary', 'currentsalary', 'pay', 'remuneration'],
    phrases: ['expected salary', 'current salary', 'salary expectation', 'expected ctc', 'desired salary', 'expected compensation'],
    autocomplete: [],
    example: '100000',
  },
  {
    kind: 'yearsExperience',
    label: 'Years of Experience',
    keywords: ['experience', 'yearsofexperience', 'yoe', 'totalexperience', 'workexperience'],
    phrases: ['years of experience', 'total experience', 'work experience', 'relevant experience'],
    autocomplete: [],
    example: '3',
  },
  {
    kind: 'coverLetter',
    label: 'Cover Letter / About',
    keywords: ['coverletter', 'about', 'aboutme', 'summary', 'bio', 'introduction', 'message', 'comments', 'additionalinfo'],
    phrases: ['cover letter', 'about yourself', 'tell us about', 'why do you want', 'additional information', 'personal statement', 'about me'],
    autocomplete: [],
    example: 'I am a passionate engineer…',
  },
  {
    kind: 'pronouns',
    label: 'Pronouns',
    keywords: ['pronoun', 'pronouns'],
    phrases: ['preferred pronouns', 'your pronouns'],
    autocomplete: [],
    example: 'she/her',
  },
  {
    kind: 'location',
    label: 'Current Location',
    keywords: ['location', 'currentlocation', 'basedin', 'residence'],
    phrases: ['current location', 'your location', 'where are you based', 'city and state', 'current city'],
    autocomplete: [],
    negative: ['ip', 'timezone', 'zone', 'geolocation'],
    example: 'San Francisco, CA',
  },
  {
    kind: 'workAuthorization',
    label: 'Work Authorization',
    keywords: ['workauthorization', 'workauthorized', 'workpermit', 'righttowork', 'workeligibility', 'employmenteligibility'],
    phrases: ['work authorization', 'authorized to work', 'legally authorized', 'right to work', 'work eligibility', 'eligible to work', 'visa status', 'work status'],
    autocomplete: [],
    negative: ['sponsor', 'sponsorship'],
    example: 'Authorized to work in the US',
  },
  {
    kind: 'sponsorship',
    label: 'Visa Sponsorship',
    keywords: ['sponsorship', 'sponsor', 'visasponsorship'],
    phrases: ['require sponsorship', 'need sponsorship', 'visa sponsorship', 'require visa sponsorship', 'sponsorship required', 'require immigration'],
    autocomplete: [],
    example: 'No',
  },
  {
    kind: 'noticePeriod',
    label: 'Notice Period',
    keywords: ['noticeperiod', 'notice'],
    phrases: ['notice period', 'notice days', 'how much notice'],
    autocomplete: [],
    example: '30 days',
  },
  {
    kind: 'startDate',
    label: 'Available Start Date',
    keywords: ['startdate', 'availability', 'availablefrom', 'joiningdate', 'earlieststart'],
    phrases: ['start date', 'available start date', 'availability date', 'earliest start', 'joining date', 'when can you start', 'available from', 'date available'],
    autocomplete: [],
    negative: ['end date', 'birth'],
    example: '2026-08-01',
  },
  {
    kind: 'relocate',
    label: 'Willing to Relocate',
    keywords: ['relocate', 'relocation', 'willingtorelocate'],
    phrases: ['willing to relocate', 'open to relocation', 'able to relocate'],
    autocomplete: [],
    example: 'Yes',
  },
  {
    kind: 'references',
    label: 'References',
    keywords: ['references', 'referee', 'referees', 'reference'],
    phrases: ['professional references', 'reference contact'],
    autocomplete: [],
    negative: ['number', 'code', 'id', 'requisition', 'job', 'order', 'self'],
    example: 'Available on request',
  },
  {
    kind: 'veteranStatus',
    label: 'Veteran Status',
    keywords: ['veteran', 'veteranstatus', 'military'],
    phrases: ['veteran status', 'protected veteran', 'military service'],
    autocomplete: [],
    example: 'I am not a veteran',
  },
  {
    kind: 'disabilityStatus',
    label: 'Disability Status',
    keywords: ['disability', 'disabled', 'disabilitystatus'],
    phrases: ['disability status', 'do you have a disability'],
    autocomplete: [],
    example: 'No',
  },
  {
    kind: 'ethnicity',
    label: 'Race / Ethnicity',
    keywords: ['ethnicity', 'race', 'ethnic', 'hispanic', 'latino'],
    phrases: ['race ethnicity', 'ethnic background', 'racial background'],
    autocomplete: [],
    negative: ['racing', 'trace'],
    example: 'Prefer not to say',
  },
];

export const KIND_LABELS: Record<string, string> = Object.fromEntries(
  TAXONOMY.map((t) => [t.kind, t.label]),
);

/** Profile-editor field groups, in display order. */
export interface ProfileSection {
  title: string;
  kinds: FieldKind[];
}

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    title: 'Identity',
    kinds: ['fullName', 'firstName', 'lastName', 'middleName', 'pronouns', 'dateOfBirth', 'gender', 'nationality'],
  },
  {
    title: 'Contact',
    kinds: ['email', 'phone', 'location'],
  },
  {
    title: 'Address',
    kinds: ['addressLine1', 'addressLine2', 'city', 'state', 'country', 'zip'],
  },
  {
    title: 'Online presence',
    kinds: ['linkedin', 'github', 'portfolio', 'website'],
  },
  {
    title: 'Professional',
    kinds: [
      'company', 'jobTitle', 'yearsExperience', 'salary', 'noticePeriod',
      'startDate', 'workAuthorization', 'sponsorship', 'relocate', 'references',
    ],
  },
  {
    title: 'Education',
    kinds: ['college', 'degree', 'graduationYear'],
  },
  {
    title: 'Equal opportunity (optional)',
    kinds: ['veteranStatus', 'disabilityStatus', 'ethnicity'],
  },
];

/** Kinds shown by default in the profile editor, in display order. */
export const DEFAULT_PROFILE_KINDS: FieldKind[] = PROFILE_SECTIONS.flatMap((s) => s.kinds);

/** Kinds derivable from others when missing (e.g. fullName from first+last). */
export function deriveValue(
  kind: FieldKind,
  get: (k: FieldKind) => string | undefined,
): string | undefined {
  const direct = get(kind);
  if (direct) return direct;
  switch (kind) {
    case 'fullName': {
      const parts = [get('firstName'), get('middleName'), get('lastName')].filter(Boolean);
      return parts.length ? parts.join(' ') : undefined;
    }
    case 'firstName': {
      const full = get('fullName');
      return full ? full.trim().split(/\s+/)[0] : undefined;
    }
    case 'lastName': {
      const full = get('fullName');
      if (!full) return undefined;
      const parts = full.trim().split(/\s+/);
      return parts.length > 1 ? parts[parts.length - 1] : undefined;
    }
    case 'website':
      return get('portfolio') ?? undefined;
    case 'location': {
      const parts = [get('city'), get('state')].filter(Boolean);
      return parts.length ? parts.join(', ') : undefined;
    }
    default:
      return undefined;
  }
}
