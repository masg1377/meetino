/**
 * Copy text to clipboard with a fallback for older browsers.
 * Resolves true on success, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  // Fallback for non-secure contexts.
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** Build a shareable meeting URL from a slug. */
export function buildMeetingUrl(slug: string): string {
  if (typeof window === 'undefined') return `/m/${slug}`;
  return `${window.location.origin}/m/${slug}`;
}
