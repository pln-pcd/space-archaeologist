/**
 * Starship Odyssey - Visual Style Mode Flag
 * Default: Mistwood Cottage diorama style (Amira Deuraseh, CC BY 4.0)
 * Legacy fallback: ?style=legacy (Summer Afternoon ramp/LUT style)
 */

export function isLegacyStyle(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("style") === "legacy";
  } catch {
    return false;
  }
}

