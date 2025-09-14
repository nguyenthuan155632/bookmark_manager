export function slugify(input: string): string {
  return (input || '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanum to dashes
    .replace(/^-+|-+$/g, '') // trim dashes
    .replace(/-{2,}/g, '-'); // collapse dashes
}

function hashTo6(input: string): string {
  // djb2 hash
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // Convert to unsigned 32-bit and base36, pad
  const unsigned = hash >>> 0;
  return unsigned.toString(36).slice(0, 6);
}

export function categorySlug(category: { id: number; name: string }): string {
  const base = slugify(category.name);
  const h = hashTo6(`${category.id}:${category.name}`);
  return `${base}-${h}`;
}
