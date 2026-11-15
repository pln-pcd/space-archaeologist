// Passport stamp art (bible §11): rubber-stamp style, one ink colour, a rough ink texture,
// perforated edge, curved place name and a little picture of the machine. Never a NASA insignia.
import { useId, type ReactElement } from "react";

type StampProps = { size?: number; earned?: boolean; tilt?: number };

function Ink({ id, rough = 1.6 }: { id: string; rough?: number }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={rough} xChannelSelector="R" yChannelSelector="G" result="d" />
      <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="1" seed="9" result="s" />
      <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.45" result="mask" />
      <feComposite in="d" in2="mask" operator="in" />
    </filter>
  );
}

function Frame({ ink, top, bottom, uid }: { ink: string; top: string; bottom: string; uid: string }) {
  return (
    <>
      <circle cx="100" cy="100" r="92" fill="none" stroke={ink} strokeWidth="5" strokeDasharray="2 6" strokeLinecap="round" />
      <circle cx="100" cy="100" r="84" fill="none" stroke={ink} strokeWidth="4" />
      <circle cx="100" cy="100" r="60" fill="none" stroke={ink} strokeWidth="2.5" />
      <path id={`${uid}-t`} d="M 30 100 A 70 70 0 0 1 170 100" fill="none" />
      <path id={`${uid}-b`} d="M 26 100 A 74 74 0 0 0 174 100" fill="none" />
      <text fill={ink} fontFamily="Stylish, sans-serif" fontWeight="400" fontSize="15" letterSpacing="2">
        <textPath href={`#${uid}-t`} startOffset="50%" textAnchor="middle">
          {top}
        </textPath>
      </text>
      <text fill={ink} fontFamily="Stylish, sans-serif" fontWeight="400" fontSize="14" letterSpacing="2">
        <textPath href={`#${uid}-b`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">
          {bottom}
        </textPath>
      </text>
      {[38, 162].map((x) => (
        <path key={x} d={`M${x} 96 l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1 z`} fill={ink} />
      ))}
    </>
  );
}

/** Chapter 1: Eagle's descent stage on the Moon, Earth above. */
export function StampEagle({ size = 120, earned = true, tilt = -8 }: StampProps) {
  const uid = useId().replace(/:/g, "");
  const ink = "#6f8088";
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ rotate: `${tilt}deg` }} className={`stamp-art ${earned ? "" : "ghost"}`} aria-label="Eagle stamp: Sea of Tranquility, 1969" role="img">
      <defs>
        <Ink id={`${uid}-ink`} />
      </defs>
      <g filter={`url(#${uid}-ink)`} opacity="0.92">
        <Frame ink={ink} top="SEA OF TRANQUILITY" bottom="EAGLE · 1969" uid={uid} />
        {/* Earth */}
        <circle cx="122" cy="70" r="11" fill="none" stroke={ink} strokeWidth="3.5" />
        <path d="M114 66 q6 -4 10 2 q4 6 10 2" fill="none" stroke={ink} strokeWidth="2.5" />
        {/* descent stage + legs */}
        <path d="M80 98 h40 l6 12 h-52 z" fill={ink} />
        <path d="M86 110 l-14 22 M114 110 l14 22 M94 110 l-6 22 M106 110 l6 22" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M64 132 h16 M120 132 h16" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        {/* ground */}
        <path d="M50 138 q50 -8 100 0" fill="none" stroke={ink} strokeWidth="3" />
        <circle cx="84" cy="80" r="2.5" fill={ink} />
        <circle cx="70" cy="90" r="1.8" fill={ink} />
      </g>
    </svg>
  );
}

/** Chapter 2: Opportunity under the blue Martian sunset. */
export function StampOpportunity({ size = 120, earned = true, tilt = 7 }: StampProps) {
  const uid = useId().replace(/:/g, "");
  const ink = "#7f7563";
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ rotate: `${tilt}deg` }} className={`stamp-art ${earned ? "" : "ghost"}`} aria-label="Opportunity stamp: Meridiani Planum, 2004 to 2018" role="img">
      <defs>
        <Ink id={`${uid}-ink`} />
      </defs>
      <g filter={`url(#${uid}-ink)`} opacity="0.92">
        <Frame ink={ink} top="MERIDIANI PLANUM" bottom="OPPORTUNITY · 2004" uid={uid} />
        {/* the setting Sun with its blue glow (one accent ink) */}
        <circle cx="122" cy="84" r="16" fill="none" stroke="#66757c" strokeWidth="3" strokeDasharray="3 4" />
        <circle cx="122" cy="84" r="7" fill="#66757c" />
        {/* rover: deck, mast, wheels */}
        <path d="M66 104 h52 v6 h-52 z" fill={ink} />
        <path d="M76 110 h30 v10 h-30 z" fill={ink} />
        <path d="M100 104 v-18 M94 84 h12" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        {[74, 91, 108].map((x) => (
          <circle key={x} cx={x} cy="128" r="6" fill="none" stroke={ink} strokeWidth="4" />
        ))}
        <path d="M50 136 q24 -6 50 -2 t50 0" fill="none" stroke={ink} strokeWidth="3" />
      </g>
    </svg>
  );
}

/** A sealed chapter: dashed outline, lock, and the machine's name. */
export function StampSealed({ size = 120, label }: { size?: number; label: string }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="stamp-art sealed" aria-label={`${label}: sealed`} role="img">
      <circle cx="100" cy="100" r="86" fill="none" stroke="#8a99a0" strokeWidth="4" strokeDasharray="10 9" />
      <rect x="78" y="86" width="44" height="34" rx="7" fill="none" stroke="#8a99a0" strokeWidth="5" />
      <path d="M86 86 v-8 a14 14 0 0 1 28 0 v8" fill="none" stroke="#8a99a0" strokeWidth="5" />
      <text x="100" y="150" textAnchor="middle" fill="#8a99a0" fontFamily="Stylish, sans-serif" fontWeight="400" fontSize="16" letterSpacing="1.5">
        {label.toUpperCase()}
      </text>
    </svg>
  );
}

/** The final "all stories home" badge. */
export function StampExplorer({ size = 120, earned = false }: StampProps) {
  const uid = useId().replace(/:/g, "");
  const ink = earned ? "#918672" : "#8a99a0";
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={`stamp-art ${earned ? "" : "ghost"}`} aria-label="Starship explorer badge" role="img">
      <defs>
        <Ink id={`${uid}-ink`} />
      </defs>
      <g filter={earned ? `url(#${uid}-ink)` : undefined}>
        <Frame ink={ink} top="STARSHIP ODYSSEY" bottom="EXPLORER" uid={uid} />
        <path d="M100 62 l11 24 l26 3 l-19 18 l5 26 l-23 -13 l-23 13 l5 -26 l-19 -18 l26 -3 z" fill={earned ? ink : "none"} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export const CHAPTER_STAMP: Record<string, (p: StampProps) => ReactElement> = { eagle: StampEagle, opportunity: StampOpportunity };
