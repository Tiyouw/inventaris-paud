import { cookies } from 'next/headers';
import { OBSERVATION_SCHOOLS } from './observation';

/**
 * Reads the school session cookie and validates it against known school codes.
 * Server-only — uses next/headers.
 */
export async function getSchoolCodeFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get('school_session')?.value ?? null;
  return val && OBSERVATION_SCHOOLS.some((s) => s.code === val) ? val : null;
}

/**
 * HTML-escapes a string for safe interpolation into HTML output.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
