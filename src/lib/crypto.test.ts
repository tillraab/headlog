import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, isEnvelope, newSalt, PassphraseError } from './crypto';

describe('encrypt and decrypt', () => {
  const salt = newSalt();

  it('opens with the passphrase it was locked with', async () => {
    const envelope = await encrypt('{"diary":1}', 'blue kettle', salt, 1000);
    expect(await decrypt(envelope, 'blue kettle')).toBe('{"diary":1}');
  });

  it('keeps the text unreadable inside the envelope', async () => {
    const envelope = await encrypt('Ibuprofen 400 mg', 'blue kettle', salt, 1000);
    expect([isEnvelope(envelope), JSON.stringify(envelope).includes('Ibuprofen')]).toEqual([true, false]);
  });

  it('rejects a wrong passphrase', async () => {
    const envelope = await encrypt('secret', 'blue kettle', salt, 1000);
    await expect(decrypt(envelope, 'red kettle')).rejects.toBeInstanceOf(PassphraseError);
  });

  it('uses a fresh IV for every encryption', async () => {
    const [a, b] = await Promise.all([encrypt('same', 'p', salt, 1000), encrypt('same', 'p', salt, 1000)]);
    expect(a.iv).not.toBe(b.iv);
  });
});
