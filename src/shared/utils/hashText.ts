import crypto from 'crypto';

export function hashText(input: string): string {
  return crypto
    .createHash('sha256')
    .update(input)
    .digest('hex');
}
