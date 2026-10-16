/**
 * Reads a candidate import file (JSON, optionally with comments) and pairs each entry with its CV, so
 * the importer can show what will happen before anything is sent. The server re-validates every entry;
 * this only buys the user an immediate pre-check. Rules mirror
 * server/Recruitment.Gorilla.API/Services/CandidateImportService.cs.
 */
import { validatePersonName } from './personName';

/** Same pattern as the server's EmailFormat, so the pre-check never passes what the import refuses. */
const EMAIL = /^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i;

const MAX_CV_BYTES = 10 * 1024 * 1024;
const CV_EXTENSIONS = ['.pdf', '.docx'];

/** Every key the template defines, so key casing can be normalised for the pre-check. */
const KNOWN_KEYS = [
  'cvFileName', 'fullName', 'email', 'phone', 'currentTitle', 'relevantExperience', 'location',
  'role', 'source', 'sourceDetail', 'skills', 'summary', 'linkedInUrl', 'githubUrl', 'gitLabUrl',
  'portfolioUrl', 'leetCodeUrl', 'codeforcesUrl', 'hackerRankUrl', 'educations', 'experiences',
];
const KEY_BY_LOWER = new Map(KNOWN_KEYS.map((k) => [k.toLowerCase(), k]));

export interface ImportRow {
  index: number;
  /** The entry as written, sent to the server unchanged. */
  entry: Record<string, unknown>;
  cvFileName: string | null;
  fullName: string | null;
  email: string | null;
  role: string | null;
  file: File | null;
  errors: string[];
  warnings: string[];
}

export interface ImportManifest {
  rows: ImportRow[];
  /** A problem with the file as a whole (unreadable JSON, wrong shape); no rows when set. */
  error: string | null;
  /** Dropped CVs that no entry names. */
  unusedFiles: string[];
}

/**
 * Removes // and block comments and trailing commas, leaving string contents alone so a value like
 * "https://example.com" survives.
 */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
      out += ' ';
    } else {
      out += ch;
    }
  }
  return removeTrailingCommas(out);
}

function removeTrailingCommas(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += text[i + 1] ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') inString = true;
    if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') continue;
    }
    out += ch;
  }
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accepts { "candidates": [...] }, a bare array, or a single candidate object. */
function entriesOf(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!isObject(parsed)) return null;
  const wrapped = Object.entries(parsed).find(([k]) => k.toLowerCase() === 'candidates')?.[1];
  if (wrapped !== undefined) return Array.isArray(wrapped) ? wrapped : null;
  return [parsed];
}

function text(entry: Record<string, unknown>, key: string): string | null {
  const actual = Object.keys(entry).find((k) => KEY_BY_LOWER.get(k.toLowerCase()) === key);
  const value = actual === undefined ? undefined : entry[actual];
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

export function parseImportManifest(json: string, cvFiles: File[]): ImportManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonComments(json));
  } catch (e) {
    return { rows: [], unusedFiles: [], error: `The JSON file could not be read: ${(e as Error).message}` };
  }

  const entries = entriesOf(parsed);
  if (!entries) {
    return { rows: [], unusedFiles: [], error: 'Expected a "candidates" list, a list of candidates, or one candidate object.' };
  }
  if (entries.length === 0) return { rows: [], unusedFiles: [], error: 'The JSON file has no candidates.' };

  const filesByName = new Map(cvFiles.map((f) => [f.name.toLowerCase(), f]));
  const usedFiles = new Set<string>();
  const seenFileNames = new Map<string, number>();
  const seenEmails = new Map<string, number>();

  const rows = entries.map((raw, i): ImportRow => {
    const index = i + 1;
    if (!isObject(raw)) {
      return {
        index, entry: {}, cvFileName: null, fullName: null, email: null, role: null, file: null,
        errors: ['This entry is not an object.'], warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const cvFileName = text(raw, 'cvFileName');
    const fullName = text(raw, 'fullName');
    const email = text(raw, 'email');

    let file: File | null = null;
    if (!cvFileName) {
      errors.push('cvFileName is required.');
    } else {
      const key = cvFileName.toLowerCase();
      file = filesByName.get(key) ?? null;
      if (!file) errors.push(`No CV named "${cvFileName}" was added.`);
      else {
        usedFiles.add(key);
        if (!CV_EXTENSIONS.includes(extensionOf(file.name))) errors.push('The CV must be a PDF or Word (.docx) file.');
        if (file.size > MAX_CV_BYTES) errors.push('The CV is larger than 10 MB.');
      }
      const earlier = seenFileNames.get(key);
      if (earlier !== undefined) errors.push(`Entry ${earlier} already uses this CV.`);
      else seenFileNames.set(key, index);
    }

    const nameError = validatePersonName(fullName, 'fullName');
    if (nameError) errors.push(nameError);

    if (!email) errors.push('email is required.');
    else if (!EMAIL.test(email)) errors.push(`email "${email}" is not a valid email address.`);
    else {
      const earlier = seenEmails.get(email.toLowerCase());
      if (earlier !== undefined) warnings.push(`Entry ${earlier} has the same email.`);
      else seenEmails.set(email.toLowerCase(), index);
    }

    const unknown = Object.keys(raw).filter((k) => !KEY_BY_LOWER.has(k.toLowerCase()));
    if (unknown.length > 0) warnings.push(`Unknown key(s) will be ignored: ${unknown.join(', ')}.`);

    return { index, entry: raw, cvFileName, fullName, email, role: text(raw, 'role'), file, errors, warnings };
  });

  const unusedFiles = cvFiles.filter((f) => !usedFiles.has(f.name.toLowerCase())).map((f) => f.name);
  return { rows, unusedFiles, error: null };
}
