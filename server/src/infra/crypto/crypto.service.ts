import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual,
} from 'node:crypto';

/**
 * Symmetric encryption for secrets we must be able to read back.
 *
 * Mail account passwords are the case that forces this: SMTP needs the actual
 * password at send time, so it cannot be hashed like a login credential. What we
 * can do is make a database leak useless on its own — the key lives in the
 * environment, not in Postgres.
 *
 * AES-256-GCM, so the ciphertext is authenticated: a tampered row fails to
 * decrypt rather than silently yielding garbage.
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const raw = this.config.get<string>('security.encryptionKey');

    if (!raw) {
      // Refuse to start rather than silently storing recoverable secrets under
      // a predictable key.
      throw new Error(
        'APP_ENCRYPTION_KEY is required. Generate one with:\n' +
          "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
    }

    // Accept a base64 32-byte key, or derive one from a longer passphrase.
    const decoded = Buffer.from(raw, 'base64');
    this.key = decoded.length === 32 ? decoded : createHash('sha256').update(raw).digest();

    if (decoded.length !== 32) {
      this.logger.warn(
        'APP_ENCRYPTION_KEY is not a 32-byte base64 value; deriving a key by SHA-256. ' +
          'Use a proper random key in production.',
      );
    }
  }

  /**
   * Returns `v1.<iv>.<tag>.<ciphertext>`, all base64url.
   * The version prefix means the scheme can change later without guessing.
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', b64(iv), b64(tag), b64(enc)].join('.');
  }

  decrypt(payload: string): string {
    const [version, ivPart, tagPart, dataPart] = payload.split('.');
    if (version !== 'v1' || !ivPart || !tagPart || !dataPart) {
      throw new Error('Malformed ciphertext');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, unb64(ivPart));
    decipher.setAuthTag(unb64(tagPart));
    return Buffer.concat([decipher.update(unb64(dataPart)), decipher.final()]).toString('utf8');
  }

  /** Never throws on a bad ciphertext — used where a failure should degrade. */
  tryDecrypt(payload: string | null | undefined): string | null {
    if (!payload) return null;
    try {
      return this.decrypt(payload);
    } catch {
      this.logger.error('Failed to decrypt a stored secret — wrong key, or the row was tampered with');
      return null;
    }
  }

  /** Constant-time compare, for anything that shouldn't leak length or prefix. */
  matches(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }
}

const b64 = (b: Buffer) => b.toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url');
