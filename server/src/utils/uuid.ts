import crypto from 'crypto';

/**
 * Normalizes any string ID (e.g. 'user-sarah', 'guest_123', device ID) into a valid RFC 4122 UUID.
 * If already a valid UUID, returns it lowercase.
 * Otherwise, generates a deterministic v4 UUID via MD5 hashing so that the same string ID
 * consistently maps to the exact same Postgres UUID.
 */
export function normalizeToUuid(id: string): string {
  if (!id) return '00000000-0000-0000-0000-000000000000';
  const simpleUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (simpleUuidRegex.test(id)) {
    return id.toLowerCase();
  }
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
}
