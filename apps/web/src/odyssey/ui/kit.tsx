// Starship Odyssey design kit (v4.6 §9): Card, Button, Tag, SpeakerBadge, DialogueBox, ChatBubble,
// Avatar and the star burst. Every screen builds its 2D UI from these (tokens in kit.css).
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { Satellite, Sparkles, Star } from "lucide-react";
import { play } from "../../audio/sfx";
import { motion } from "../../anim/kit";
import "@fontsource/fredoka/400.css";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "@fontsource/lilita-one/400.css";
import "./kit.css";
import { HAIR_STYLES, SKIN_TONES, SUIT_COLORS, VISORS, useAvatar } from "../../missions/avatar";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ stitched, starred, pop = true, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { stitched?: boolean; starred?: boolean; pop?: boolean }) {
  return (
    <div className={cx("k-card od-free", stitched && "stitched", starred && "starred", pop && "k-pop", className)} {...rest}>
      {children}
    </div>
  );
}

/** a few stars fly out from a point (skipped in reduced motion) */
export function burst(x: number, y: number, n = 7) {
  if (motion.reduced || typeof document === "undefined") return;
  const host = document.createElement("div");
  host.className = "k-burst";
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = 38 + Math.random() * 30;
    const s = document.createElement("i");
    s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
    s.style.animationDelay = `${Math.random() * 60}ms`;
    host.appendChild(s);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 800);
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" | "secondary" | "sky" | "lilac" | "plain" | "ghost"; size?: "sm" | "md" | "lg"; round?: boolean; icon?: ReactNode; quiet?: boolean };
/** tactile pill: hover wiggle, press-down, ZzFX pop and a small star burst */
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "plain", size = "md", round, icon, quiet, className, children, onClick, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("k-btn od-free", variant !== "plain" && variant, size !== "md" && size, round && "round", className)}
      onClick={(e) => {
        if (!quiet) {
          if (e.clientX || e.clientY) burst(e.clientX, e.clientY, 6);
          else {
            const r = e.currentTarget.getBoundingClientRect();
            burst(r.left + r.width / 2, r.top + r.height / 2, 6);
          }
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function Tag({ kind }: { kind: "true" | "imagine" }) {
  return kind === "true" ? (
    <span className="k-tag true od-free" title="This really happened">
      <Satellite size={18} strokeWidth={2.4} aria-hidden="true" /> True story
    </span>
  ) : (
    <span className="k-tag imagine od-free" title="A pretend part of the story">
      <Sparkles size={18} strokeWidth={2.4} aria-hidden="true" /> Imagine
    </span>
  );
}

export function SpeakerBadge({ name, kind = "nova" }: { name: string; kind?: "nova" | "narrator" | "kid" | "other" }) {
  return (
    <span className={cx("k-speaker od-free", kind)}>
      {kind === "nova" && <Star size={17} strokeWidth={2.6} fill="#FFD23F" color="#241D48" aria-hidden="true" />}
      {name}
    </span>
  );
}

/** the dialogue box: a header row (speaker badge left, True/Imagine sticker right) above the card body */
export function DialogueBox({ speaker, speakerKind, tag, tools, className, children, ...rest }: HTMLAttributes<HTMLElement> & { speaker?: string; speakerKind?: "nova" | "narrator" | "kid" | "other"; tag?: "true" | "imagine" | null; tools?: ReactNode }) {
  return (
    <section className={cx("k-card k-dialogue od-free", className)} {...rest}>
      {(speaker || tag || tools) && (
        <div className="k-dhead">
          {speaker ? <SpeakerBadge name={speaker} kind={speakerKind} /> : <span />}
          <span className="k-dhead-right">
            {tag ? <Tag kind={tag} /> : null}
            {tools}
          </span>
        </div>
      )}
      {children}
    </section>
  );
}

export function ChatBubble({ side, name, avatar, children }: { side: "nova" | "kid"; name?: string; avatar?: ReactNode; children: ReactNode }) {
  return (
    <div className={cx("k-chat od-free", side)}>
      {avatar}
      <div className="k-bubble">
        {name && <small>{name}</small>}
        {children}
      </div>
    </div>
  );
}

// ---------- avatars: the four explorer kids + simple preset faces (our own drawings) ----------
export const AVATARS = ["maya", "leo", "amara", "migo", "star", "comet"] as const;
export type AvatarId = (typeof AVATARS)[number];
const SKIN: Record<string, string> = { maya: "#E9B48F", leo: "#F5CDA8", amara: "#B97A55", migo: "#D79E77", star: "#F8DCC6", comet: "#F1C7A5" };
const BG: Record<string, string> = { maya: "#BFE3DF", leo: "#FAD9B8", amara: "#D3EEDF", migo: "#DDE8C9", star: "#E4DBFA", comet: "#CFE5F6" };

function hair(id: string) {
  switch (id) {
    case "maya": // messy dark hair with a braid and a cowlick
      return (
        <>
          <path d="M18 44c-2-18 10-28 22-28s24 9 22 28c-4-8-10-12-22-12s-18 4-22 12z" fill="#2E2420" />
          <path d="M40 16c2-5 7-6 9-4-4 0-6 2-7 5z" fill="#2E2420" />
          <path d="M60 42c4 8 4 18 0 26l-4-2c3-7 3-14 0-22z" fill="#2E2420" />
        </>
      );
    case "leo": // fluffy bob + round glasses
      return (
        <>
          <path d="M16 50c-4-22 8-34 24-34s28 12 24 34c-2-6-4-12-8-14-6 4-24 4-32 0-4 2-6 8-8 14z" fill="#7A4A2A" />
          <circle cx="32" cy="46" r="6.5" fill="none" stroke="#241D48" strokeWidth="2.5" />
          <circle cx="50" cy="46" r="6.5" fill="none" stroke="#241D48" strokeWidth="2.5" />
          <path d="M38.5 46h5" stroke="#241D48" strokeWidth="2.5" />
        </>
      );
    case "amara": // wavy chestnut hair
      return <path d="M14 56c-6-26 8-40 26-40s32 14 26 40c-2-4-2-12-6-16-2 4-6 4-8 0-2 4-8 4-10 0-2 4-8 4-10 0-4 4-4 12-6 16-6-2-10-0-12 0z" fill="#8A4B2C" />;
    case "migo": // high ponytail with bobbles, blunt bangs
      return (
        <>
          <path d="M18 42c0-16 10-26 22-26s22 10 22 26c-2-2-6-4-10-4H28c-4 0-8 2-10 4z" fill="#3B2A22" />
          <path d="M44 14c8-10 20-6 18 6-4-4-10-6-16-2z" fill="#3B2A22" />
          <circle cx="45" cy="15" r="3.5" fill="#B9CF3A" stroke="#241D48" strokeWidth="1.5" />
        </>
      );
    case "star": // a little star helmet
      return (
        <>
          <circle cx="40" cy="44" r="27" fill="none" stroke="#FFFFFF" strokeWidth="5" />
          <path d="M40 6l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#FFD23F" stroke="#241D48" strokeWidth="1.5" />
        </>
      );
    default: // comet: short tuft
      return <path d="M20 40c2-14 10-22 20-22 8 0 14 4 18 10 4-2 8-2 10 0-4 0-6 2-8 4 2 4 2 6 2 8-6-6-14-8-22-8s-14 2-20 8z" fill="#C46A3A" />;
  }
}

/** Nova's little helmet face for chat bubbles and headers */
export function NovaAvatar({ size = 52 }: { size?: number }) {
  return (
    <span className="k-avatar od-free" style={{ ["--av" as string]: `${size}px`, background: "#FFE3F1" }} aria-hidden="true">
      <svg viewBox="0 0 80 80">
        <circle cx="40" cy="42" r="31" fill="#FFF7FB" stroke="#241D48" strokeWidth="2.5" />
        <circle cx="40" cy="44" r="23" fill="#F8DCC6" stroke="#FF8FBE" strokeWidth="4" />
        <path d="M18 40q2-20 22-20t22 20q-6-8-11-6q-4-6-11-1q-7-5-11 1q-5-2-11 6z" fill="#6B3E35" />
        <path d="M44 11l2-7" stroke="#A9A2B8" strokeWidth="2.5" />
        <path d="M46.5 0.5l1.6 3.2 3.5 0.5-2.5 2.4 0.6 3.5-3.2-1.7-3.1 1.7 0.6-3.5-2.5-2.4 3.5-0.5z" fill="#FFD23F" stroke="#241D48" strokeWidth="1" />
        <path d="M22 13q-8-6-8 2t8 2zM30 13q8-6 8 2t-8 2z" fill="#FF8FBE" stroke="#241D48" strokeWidth="1.5" transform="translate(-6 0)" />
        <ellipse cx="32" cy="46" rx="3.8" ry="4.8" fill="#241D48" />
        <ellipse cx="48" cy="46" rx="3.8" ry="4.8" fill="#241D48" />
        <circle cx="31" cy="44.5" r="1.4" fill="#FFF" />
        <circle cx="47" cy="44.5" r="1.4" fill="#FFF" />
        <ellipse cx="26" cy="53" rx="4" ry="2.4" fill="rgba(255,110,150,0.55)" />
        <ellipse cx="54" cy="53" rx="4" ry="2.4" fill="rgba(255,110,150,0.55)" />
        <path d="M37 54q3 3 6 0" stroke="#241D48" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="10" cy="42" r="6" fill="#FF8FBE" stroke="#241D48" strokeWidth="1.5" />
        <circle cx="70" cy="42" r="6" fill="#FF8FBE" stroke="#241D48" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

export function Avatar({ id = "star", size = 56, label }: { id?: string; size?: number; label?: string }) {
  const config = useAvatar((s) => s.config);
  const k = config?.base ?? ((AVATARS as readonly string[]).includes(id) ? id : "star");
  const hairStyle = config ? HAIR_STYLES[config.hair] : null;
  const hairId = hairStyle === "bob-messy" ? "leo" : hairStyle === "ponytail" ? "migo" : hairStyle === "wavy-flick" ? "amara" : "maya";
  return (
    <span className="k-avatar od-free" style={{ ["--av" as string]: `${size}px`, background: BG[k] }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 80 80">
        {config && <path d="M12 80q2-20 28-20t28 20" fill={SUIT_COLORS[config.suitColor]} stroke="#241D48" strokeWidth="2.5" />}
        <circle cx="40" cy="48" r="22" fill={config ? SKIN_TONES[config.skin] : SKIN[k]} stroke="#241D48" strokeWidth="2.5" />
        {config && hairStyle === "curls" ? Array.from({ length: 7 }, (_, i) => <circle key={i} cx={19 + i * 7} cy={26 - Math.sin(i / 6 * Math.PI) * 7} r={8} fill="#3F3A42" />) : config && hairStyle === "crew" ? <path d="M18 38q0-22 22-22t22 22q-22-12-44 0" fill="#3F3A42" /> : config && hairStyle === "bun" ? <><circle cx="40" cy="14" r="10" fill="#3F3A42" />{hair("maya")}</> : hair(config ? hairId : k)}
        {config && <ellipse cx="40" cy="43" rx={config.helmet === 1 ? 32 : 28} ry={config.helmet === 2 ? 36 : 30} fill="none" stroke={VISORS[config.visor]} strokeWidth="4" />}
        {config && <circle cx="56" cy="72" r={4} fill={config.accessory === 4 ? "#5FA39C" : "#FFD23F"} />}
        <circle cx="32" cy="48" r="3.2" fill="#241D48" />
        <circle cx="50" cy="48" r="3.2" fill="#241D48" />
        <circle cx="31" cy="47" r="1" fill="#FFF" />
        <circle cx="49" cy="47" r="1" fill="#FFF" />
        <ellipse cx="26" cy="56" rx="4" ry="2.4" fill="rgba(240,130,145,0.45)" />
        <ellipse cx="56" cy="56" rx="4" ry="2.4" fill="rgba(240,130,145,0.45)" />
        <path d="M35 58q5 5 10 0" stroke="#241D48" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
