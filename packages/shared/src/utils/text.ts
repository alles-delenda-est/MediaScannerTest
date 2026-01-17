import { createHash } from 'crypto';

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function extractLede(html: string, maxLength = 500): string {
  // Remove HTML tags
  const text = html.replace(/<[^>]*>/g, '');
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();
  return truncate(normalized, maxLength);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function countCharacters(text: string): number {
  // Twitter counts differently, but for simplicity we use length
  return text.length;
}

export function isValidTwitterLength(text: string): boolean {
  return countCharacters(text) <= 280;
}

export function isValidMastodonLength(text: string): boolean {
  return countCharacters(text) <= 500;
}

export function isValidBlueskyLength(text: string): boolean {
  return countCharacters(text) <= 300;
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\wÀ-ÿ]+/g);
  return matches ? [...new Set(matches)] : [];
}

export function removeHashtags(text: string): string {
  return text.replace(/#[\wÀ-ÿ]+/g, '').replace(/\s+/g, ' ').trim();
}
