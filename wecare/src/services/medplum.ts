import type { MedplumConfig } from '../config';
import { visitBundle, visitOutcome } from '../domain/fhir';
import type { Visit } from '../domain/visit';

let token: { value: string; until: number } | null = null;

async function accessToken(c: MedplumConfig): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const res = await fetch(new URL('oauth2/token', c.baseUrl).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: [
      'grant_type=client_credentials',
      `client_id=${encodeURIComponent(c.clientId)}`,
      `client_secret=${encodeURIComponent(c.clientSecret)}`,
    ].join('&'),
  });
  if (!res.ok) throw new Error(`Medplum sign-in failed (${res.status})`);
  const body = await res.json();
  // Renew a minute early so a token never expires mid-request.
  token = {
    value: body.access_token,
    until: Date.now() + (body.expires_in - 60) * 1000,
  };
  return token.value;
}

/**
 * Writes one visit as a FHIR transaction. Safe to repeat: every create is
 * conditional, so a second push, from this phone or another, is a duplicate.
 */
export async function pushVisit(
  c: MedplumConfig,
  visit: Visit,
): Promise<'added' | 'duplicate'> {
  const res = await fetch(new URL('fhir/R4', c.baseUrl).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
      Authorization: `Bearer ${await accessToken(c)}`,
    },
    body: JSON.stringify(visitBundle(visit)),
  });
  if (res.status === 401) token = null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const why =
      body?.issue?.[0]?.details?.text ?? body?.issue?.[0]?.diagnostics;
    throw new Error(
      `Medplum refused the visit (${res.status}${why ? `: ${why}` : ''})`,
    );
  }
  const outcome = visitOutcome(body);
  if (!outcome) throw new Error('Medplum answered with an unexpected bundle');
  return outcome;
}

/** Test hook: forget the cached token. */
export const resetToken = () => {
  token = null;
};
