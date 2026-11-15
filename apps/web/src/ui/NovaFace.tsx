// 2D Nova (bible §3 MASTER): a line drawing of the matte drone, no face. The cream light ring is
// the only colour; it brightens when Nova "speaks" (`lit`). Used on dialogs and step cards.
export default function NovaFace({ size = 96, lit = false }: { size?: number; mood?: "happy" | "surprised" | "curious"; spin?: boolean; lit?: boolean }) {
  return (
    <svg className="nova-face" viewBox="0 0 120 80" width={size} height={(size * 80) / 120} aria-hidden="true">
      <g fill="none" stroke="#716C66" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M14 40 C18 18 102 18 106 40" />
        <path d="M12 40 L108 40 L106 48 L14 48 Z" />
        <path d="M16 48 C24 64 96 64 104 48" />
        <path d="M54 62 L54 66 L66 66 L66 62" />
      </g>
      <rect x="14" y="42.5" width="92" height="3" rx="1.5" fill={lit ? "#FFE9C7" : "#D8CDB8"} />
    </svg>
  );
}

/** 28 px line silhouette of a speaker for the dialogue box (no portraits, no faces). */
export function SpeakerMark({ who, size = 28 }: { who: "nova" | "eagle" | "opportunity" | "ranger"; size?: number }) {
  const p =
    who === "nova"
      ? "M3 15 C4 8 24 8 25 15 L25 17 L3 17 Z M5 17 C8 22 20 22 23 17"
      : who === "eagle"
        ? "M7 9 L21 9 L23 13 L23 17 L5 17 L5 13 Z M7 17 L3 25 M21 17 L25 25 M12 17 L12 25 M16 17 L16 25 M1 25 L5 25 M23 25 L27 25"
        : who === "opportunity"
          ? "M8 14 L20 14 L20 18 L8 18 Z M2 12 L26 12 M17 12 L17 5 L21 5 M6 23 A2.5 2.5 0 1 0 6 22.9 M14 23 A2.5 2.5 0 1 0 14 22.9 M22 23 A2.5 2.5 0 1 0 22 22.9"
          : "M14 3 A3.5 3.5 0 1 0 14 10 A3.5 3.5 0 1 0 14 3 M9 26 L10 13 L18 13 L19 26 M10 13 L6 21 M18 13 L22 21";
  return (
    <svg className="speaker-mark" viewBox="0 0 28 28" width={size} height={size} aria-hidden="true">
      <path d={p} fill="none" stroke="#716C66" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
