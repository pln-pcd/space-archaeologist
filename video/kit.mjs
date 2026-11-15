// THE VIDEO KIT: one look for the demo video and the 30-second cut. Everything comes from the game's
// art direction (bible §12, odyssey/ui/game.css): white cards, indigo ink, chunky offset shadows,
// sunny yellow, Lilita One + Fredoka, soft outlines. Reused by video/build.mjs; see video/README.md.
export const T = {
  ink: "#241D48",
  paper: "#FFFFFF",
  cream: "#FFF8EC",
  sun: "#FFD23F",
  coral: "#FF6B6B",
  mint: "#8EE6C4",
  sky: "#7CC8FF",
  lilac: "#C9B8FF",
  night: "#160E3A",
  dusk: "#2A1B66",
  muted: "#7A6FB0",
};
// the gameplay "screen": footage sits in a framed card, overlays live in the margins
export const SCREEN = { x: 160, y: 104, w: 1600, h: 900 };
export const PARTS = ["Intro", "Problem", "Solution", "Demo", "Features", "Impact"];

export const KIT_CSS = `
@font-face { font-family: "Lilita One"; src: url("assets/fonts/lilita-one-latin-400-normal.woff2") format("woff2"); font-weight: 400; }
@font-face { font-family: "Fredoka"; src: url("assets/fonts/fredoka-latin-500-normal.woff2") format("woff2"); font-weight: 500; }
@font-face { font-family: "Fredoka"; src: url("assets/fonts/fredoka-latin-600-normal.woff2") format("woff2"); font-weight: 600; }
@font-face { font-family: "Fredoka"; src: url("assets/fonts/fredoka-latin-700-normal.woff2") format("woff2"); font-weight: 700; }
.k-bg { position: absolute; inset: 0; background: radial-gradient(1200px 700px at 30% 20%, ${T.dusk}, ${T.night} 70%); }
.k-stars { position: absolute; inset: 0; background-image:
  radial-gradient(2px 2px at 120px 160px, #fff8 50%, transparent 51%), radial-gradient(2px 2px at 1720px 120px, #fff9 50%, transparent 51%),
  radial-gradient(1.5px 1.5px at 420px 940px, #fff7 50%, transparent 51%), radial-gradient(2px 2px at 1500px 980px, #fff8 50%, transparent 51%),
  radial-gradient(1.5px 1.5px at 980px 60px, #fff6 50%, transparent 51%), radial-gradient(2px 2px at 60px 620px, #fff7 50%, transparent 51%),
  radial-gradient(1.5px 1.5px at 1860px 560px, #fff7 50%, transparent 51%), radial-gradient(2.5px 2.5px at 760px 1030px, #fff6 50%, transparent 51%); }
.k-planet { position: absolute; border-radius: 50%; border: 5px solid ${T.ink}; }
.k-screen { position: absolute; left: ${SCREEN.x}px; top: ${SCREEN.y}px; width: ${SCREEN.w}px; height: ${SCREEN.h}px; border-radius: 28px;
  border: 6px solid ${T.ink}; box-shadow: 0 10px 0 ${T.ink}, 0 0 0 10px rgba(201,184,255,.18); overflow: hidden; background: #0d0826; }
.k-zoom { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; }
.k-zoom video, .k-zoom img.k-full { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; }
.k-cursor { position: absolute; left: 0; top: 0; width: 64px; height: 64px; margin: -6px 0 0 -10px; }
.k-card { background: ${T.paper}; border: 6px solid ${T.ink}; border-radius: 34px; box-shadow: 0 12px 0 ${T.ink}; color: ${T.ink}; }
.k-kicker { font: 700 26px/1 "Fredoka"; letter-spacing: .16em; text-transform: uppercase; color: ${T.muted}; }
.k-title { font: 400 116px/1 "Lilita One"; color: ${T.ink}; letter-spacing: .01em; }
.k-q { font: 600 42px/1.2 "Fredoka"; color: #4b4380; }
.k-line { font: 400 84px/1.05 "Lilita One"; color: #fff; text-shadow: 0 6px 0 ${T.ink}; -webkit-text-stroke: 3px ${T.ink}; paint-order: stroke fill; }
.k-line.ink { color: ${T.ink}; text-shadow: none; -webkit-text-stroke: 0; }
.k-hi { color: ${T.sun}; }
.k-bubble { position: absolute; background: #fff; border: 5px solid ${T.ink}; border-radius: 26px; box-shadow: 0 7px 0 ${T.ink}; padding: 16px 26px; font: 600 34px/1.2 "Fredoka"; color: ${T.ink}; white-space: nowrap; }
.k-bubble small { display: block; font: 700 18px/1 "Fredoka"; letter-spacing: .14em; text-transform: uppercase; color: ${T.muted}; margin-bottom: 6px; }
.k-chip { display: inline-flex; align-items: center; gap: 12px; padding: 10px 22px 10px 16px; border-radius: 999px; border: 4px solid ${T.ink}; background: #fff; box-shadow: 0 5px 0 ${T.ink}; font: 600 30px/1 "Fredoka"; color: ${T.ink}; white-space: nowrap; }
.k-chip svg { width: 34px; height: 34px; }
.k-chip.sun { background: ${T.sun}; } .k-chip.mint { background: ${T.mint}; } .k-chip.lilac { background: ${T.lilac}; } .k-chip.sky { background: ${T.sky}; } .k-chip.coral { background: ${T.coral}; color: #fff; }
.k-credit { position: absolute; left: ${SCREEN.x}px; bottom: 26px; padding: 7px 16px; border-radius: 999px; background: rgba(255,255,255,.12); border: 2px solid rgba(255,255,255,.35); font: 500 19px/1.2 "Fredoka"; color: #fff; white-space: nowrap; }
.k-label { position: absolute; padding: 10px 20px; border-radius: 14px; background: ${T.ink}; color: #fff; font: 600 28px/1.2 "Fredoka"; white-space: nowrap; border: 3px solid #fff; }
.k-tag-hole { position: absolute; width: 46px; height: 46px; border-radius: 50%; border: 6px solid ${T.ink}; background: ${T.night}; }
.k-dust { position: absolute; inset: 0; border-radius: 30px;
  background: radial-gradient(3px 3px at 20% 30%, #b9a98f 50%, transparent 52%) 0 0/38px 34px, radial-gradient(2px 2px at 60% 70%, #cbbda0 50%, transparent 52%) 0 0/29px 31px, linear-gradient(135deg, #d8c9ad, #c4b393);
  -webkit-mask-image: linear-gradient(100deg, #000 0 42%, rgba(0,0,0,.6) 50%, transparent 58%); -webkit-mask-size: 300% 100%; -webkit-mask-repeat: no-repeat; -webkit-mask-position: 0% 0; }
.k-ring { position: absolute; border-radius: 50%; border: 8px solid ${T.mint}; box-shadow: 0 0 0 6px ${T.ink} inset, 0 0 0 6px ${T.ink}; }
.k-stat { font: 400 150px/0.9 "Lilita One"; color: ${T.sun}; -webkit-text-stroke: 5px ${T.ink}; paint-order: stroke fill; text-shadow: 0 9px 0 ${T.ink}; }
`;

// small line icons (lucide-style, MIT): drawn inline so nothing is fetched at render time
export const ICON = {
  mouse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3l7 17 2.5-7.5L21 10z"/></svg>',
  hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.4 16.9a2 2 0 0 1 2.8-2.8L8 16"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg>',
  keys: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 15h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 5.2-2.8M19 12.6a10 10 0 0 0-2.3-1.6M12 20h.01"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M3 3l18 18"/></svg>',
  cc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="M12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/></svg>',
  cursor: '<svg viewBox="0 0 64 64"><path d="M10 6 L10 50 L22 39 L30 58 L39 54 L31 36 L48 36 Z" fill="#fff" stroke="#241D48" stroke-width="5" stroke-linejoin="round"/></svg>',
};
