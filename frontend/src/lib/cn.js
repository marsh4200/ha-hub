/**
 * Join class names, dropping anything falsy.
 * Deliberately tiny — the app has no need for tailwind-merge's conflict
 * resolution, and adding a dependency for string concatenation is not worth it.
 */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default cn;
