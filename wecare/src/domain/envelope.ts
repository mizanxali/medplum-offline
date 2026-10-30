import type { Envelope } from './visit';
import { str } from './visit';

/** What the SDK gives us to sign and check with: the phone's Ed25519 identity. */
export type Signer = {
  signData(data: number[]): Promise<number[]>;
  verifySignature(
    publicKey: number[],
    data: number[],
    signature: number[],
  ): Promise<boolean>;
  getIdentityPublicKey(): Promise<number[]>;
  deriveAddress(publicKey: number[]): Promise<string>;
};

export type Body = { id: string; created: string; bundle: any };

export const utf8 = (s: string): number[] =>
  Array.from(unescape(encodeURIComponent(s)), c => c.charCodeAt(0));
export const bytesToBase64 = (b: number[]) => btoa(String.fromCharCode(...b));
const base64ToBytes = (s: string) =>
  Array.from(atob(s), (c: string) => c.charCodeAt(0));

/** Signs at record time. Every hop after this carries `body` as is. */
export async function sign(signer: Signer, s: string): Promise<string> {
  return bytesToBase64(await signer.signData(utf8(s)));
}

export async function signEnvelope(
  signer: Signer,
  id: string,
  bundle: unknown,
): Promise<Envelope> {
  const body = JSON.stringify({
    id,
    created: new Date().toISOString(),
    bundle,
  });
  return {
    body,
    sig: await sign(signer, body),
    key: bytesToBase64(await signer.getIdentityPublicKey()),
  };
}

/**
 * Opens a record from `sender`: its key must be the sender's own, and its
 * signature must cover the body exactly as received. Never re-serialize first.
 */
export async function openEnvelope(
  signer: Signer,
  env: Envelope,
  sender: string,
): Promise<Body | null> {
  try {
    const key = base64ToBytes(env.key);
    if ((await signer.deriveAddress(key)) !== sender) return null;
    const ok = await signer.verifySignature(
      key,
      utf8(env.body),
      base64ToBytes(env.sig),
    );
    if (!ok) return null;
    const body = JSON.parse(env.body);
    return str(body?.id, 64) && str(body.created, 40) && body.bundle
      ? body
      : null;
  } catch {
    return null;
  }
}
