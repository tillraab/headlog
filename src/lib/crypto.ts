/**
 * Passphrase encryption of the gist backup: PBKDF2 (SHA-256) derives an AES-256-GCM key from the passphrase and a
 * random salt; every encryption uses a fresh random IV. The envelope keeps what decryption needs next to the data.
 */

export const ENCRYPTED_FORMAT = 'headlog-encrypted';
const ITERATIONS = 600_000;

export interface Envelope {
  format: typeof ENCRYPTED_FORMAT;
  version: 1;
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

/** The passphrase is missing or does not open the backup. */
export class PassphraseError extends Error {
  constructor(readonly reason: 'missing' | 'wrong') {
    super(reason === 'missing' ? 'Encrypted backup: passphrase needed' : 'Wrong passphrase');
  }
}

/** Base64 in chunks, since a backup has too many bytes to spread into one call. */
function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export function newSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

/** Derived keys by passphrase, salt and rounds, so uploads with the same salt do not derive the key again. */
const keys = new Map<string, Promise<CryptoKey>>();

function deriveKey(passphrase: string, salt: string, iterations: number): Promise<CryptoKey> {
  const id = `${iterations}:${salt}:${passphrase}`;
  let key = keys.get(id);
  if (!key) {
    key = crypto.subtle
      .importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
      .then((base) =>
        crypto.subtle.deriveKey(
          { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations },
          base,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        )
      );
    keys.set(id, key);
  }
  return key;
}

export function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && (value as Envelope).format === ENCRYPTED_FORMAT;
}

/** Encrypts `text` with a key from `passphrase` and `salt`. */
export async function encrypt(text: string, passphrase: string, salt: string, iterations = ITERATIONS): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  return { format: ENCRYPTED_FORMAT, version: 1, kdf: 'PBKDF2-SHA-256', iterations, salt, iv: toBase64(iv), data: toBase64(data) };
}

/** The text inside `envelope`; throws a PassphraseError when `passphrase` does not open it. */
export async function decrypt(envelope: Envelope, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, envelope.salt, envelope.iterations);
  try {
    const text = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.data));
    return new TextDecoder().decode(text);
  } catch {
    throw new PassphraseError('wrong');
  }
}
