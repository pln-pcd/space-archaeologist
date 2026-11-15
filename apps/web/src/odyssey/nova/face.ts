// Nova's face (swapped-texture rig): one 256 px canvas redrawn only when the expression, the blink or
// the mouth step changes. Big round eyes with two white highlights, small brows, rosy cheeks and a
// small mouth that opens with his voice (5 steps, rounder for "o" sounds).
import * as THREE from "three";
import type { Expression } from "./state";

const S = 256;
const INK = "#2B2230";
const BROW = "#6B4A3A";
const SKIN = "#F8DCC6";
const HAIR = "#6B3E35";

export type FaceKey = { expr: Expression; blink: boolean; mouth: number; round: boolean; gx?: number; gy?: number };

function eye(x: CanvasRenderingContext2D, cx: number, cy: number, e: Expression, blink: boolean, left: boolean, gx = 0, gy = 0) {
  x.fillStyle = INK;
  x.strokeStyle = INK;
  x.lineCap = "round";
  x.lineWidth = 9;
  if (blink || e === "sleepy") {
    // closed, or heavy-lidded for sleepy
    if (e === "sleepy" && !blink) {
      x.beginPath();
      x.ellipse(cx, cy + 8, 21, 13, 0, 0, Math.PI);
      x.fill();
      x.beginPath();
      x.moveTo(cx - 24, cy + 6);
      x.lineTo(cx + 24, cy + 6);
      x.stroke();
      return;
    }
    x.beginPath();
    x.moveTo(cx - 20, cy + 4);
    x.quadraticCurveTo(cx, cy + 14, cx + 20, cy + 4);
    x.stroke();
    return;
  }
  if (e === "happy") {
    // eyes become arcs
    x.beginPath();
    x.moveTo(cx - 21, cy + 8);
    x.quadraticCurveTo(cx, cy - 22, cx + 21, cy + 8);
    x.stroke();
    return;
  }
  const big = (e === "excited" || e === "listening" ? 1.12 : e === "sorry" ? 0.92 : 1) * 1.12;
  const up = e === "thinking" ? -10 : gy * 7;
  const side = e === "thinking" ? (left ? 4 : 4) : gx * 7;
  x.beginPath();
  x.ellipse(cx + side, cy + up, 22 * big, 28 * big, 0, 0, Math.PI * 2);
  x.fill();
  // two little lashes at the outer corner
  x.lineWidth = 5;
  const out = left ? -1 : 1;
  for (let i = 0; i < 2; i++) {
    x.beginPath();
    x.moveTo(cx + side + out * (14 + i * 6) * big, cy + up - (20 - i * 6) * big);
    x.lineTo(cx + side + out * (24 + i * 7) * big, cy + up - (30 - i * 5) * big);
    x.stroke();
  }
  // two highlights (sparkles when excited)
  x.fillStyle = "#FFFFFF";
  if (e === "excited") {
    star(x, cx - 7 + side, cy - 9 + up, 10);
    x.beginPath();
    x.arc(cx + 8 + side, cy + 9 + up, 4.5, 0, Math.PI * 2);
    x.fill();
  } else {
    x.beginPath();
    x.arc(cx - 7 + side, cy - 10 + up, 8 * big, 0, Math.PI * 2);
    x.fill();
    x.beginPath();
    x.arc(cx + 8 + side, cy + 9 + up, 4 * big, 0, Math.PI * 2);
    x.fill();
    // a soft glint along the bottom of the eye
    x.fillStyle = "rgba(160, 200, 255, 0.55)";
    x.beginPath();
    x.ellipse(cx + side, cy + up + 18 * big, 10 * big, 4 * big, 0, 0, Math.PI * 2);
    x.fill();
  }
}

function star(x: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.38 : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
  x.fill();
}

function brows(x: CanvasRenderingContext2D, e: Expression) {
  x.strokeStyle = BROW;
  x.lineWidth = 7;
  x.lineCap = "round";
  const pair = (lx: number, ly: number, la: number, rx: number, ry: number, ra: number) => {
    for (const [cx, cy, a] of [
      [lx, ly, la],
      [rx, ry, ra],
    ]) {
      x.beginPath();
      x.moveTo(cx - 13 * Math.cos(a), cy - 13 * Math.sin(a));
      x.lineTo(cx + 13 * Math.cos(a), cy + 13 * Math.sin(a));
      x.stroke();
    }
  };
  // the fringe hides the brows except when they matter (curious, sorry, thinking)
  if (!(e === "curious" || e === "sorry" || e === "thinking")) return;
  if (e === "curious") return pair(82, 70, 0.08, 174, 58, -0.25);
  if (e === "sorry") return pair(84, 72, -0.3, 172, 72, 0.3);
  if (e === "thinking") return pair(84, 66, -0.12, 172, 62, 0.05);
  if (e === "excited" || e === "listening") return pair(82, 62, -0.12, 174, 62, 0.12);
  if (e === "sleepy") return pair(84, 78, 0, 172, 78, 0);
  pair(84, 70, -0.08, 172, 70, 0.08);
}

function mouthShape(x: CanvasRenderingContext2D, e: Expression, step: number, round: boolean) {
  const cx = 128,
    cy = 178;
  x.lineCap = "round";
  if (step === 0) {
    x.strokeStyle = "#7A3443";
    x.lineWidth = 7;
    x.beginPath();
    if (e === "thinking" || e === "sleepy") {
      x.moveTo(cx - 10, cy);
      x.quadraticCurveTo(cx, cy + 4, cx + 10, cy);
    } else if (e === "sorry") {
      x.moveTo(cx - 12, cy + 2);
      x.quadraticCurveTo(cx, cy + 9, cx + 12, cy + 2);
    } else if (e === "excited") {
      // open smile
      x.fillStyle = "#7A3443";
      x.moveTo(cx - 20, cy - 4);
      x.quadraticCurveTo(cx, cy + 30, cx + 20, cy - 4);
      x.closePath();
      x.fill();
      x.fillStyle = "#F08C98";
      x.beginPath();
      x.ellipse(cx, cy + 10, 9, 5, 0, 0, Math.PI * 2);
      x.fill();
      return;
    } else {
      x.moveTo(cx - 16, cy - 2);
      x.quadraticCurveTo(cx, cy + 14, cx + 16, cy - 2);
    }
    x.stroke();
    return;
  }
  // talking: an open mouth, taller with each step, rounder for "o"
  const h = 6 + step * 5.5;
  const w = round ? 11 + step * 1.5 : 15 + step * 2.2;
  x.fillStyle = "#7A3443";
  x.beginPath();
  x.ellipse(cx, cy + h * 0.25, w, h, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = "#F08C98";
  x.beginPath();
  x.ellipse(cx, cy + h * 0.25 + h * 0.55, w * 0.6, h * 0.35, 0, 0, Math.PI * 2);
  x.fill();
}

export function makeFace() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  let last = "";
  const draw = (k: FaceKey) => {
    const key = `${k.expr}|${k.blink}|${k.mouth}|${k.round}|${k.gx ?? 0}|${k.gy ?? 0}`;
    if (key === last) return;
    last = key;
    const x = ctx;
    // skin with a soft darker rim (the inside of the helmet)
    const g = x.createRadialGradient(128, 120, 40, 128, 128, 132);
    g.addColorStop(0, SKIN);
    g.addColorStop(0.72, SKIN);
    g.addColorStop(1, "#C9A693");
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    // hair: a soft fringe of bangs and two side locks (chestnut with a pink shine)
    x.fillStyle = HAIR;
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(256, 0);
    x.lineTo(256, 70);
    for (let i = 0; i <= 6; i++) {
      const px = 256 - i * (256 / 6);
      const tip = 62 + (i % 2 ? 22 : 6);
      x.quadraticCurveTo(px - 14, tip, px - 256 / 12, 54 + (i % 2 ? 0 : 10));
    }
    x.lineTo(0, 0);
    x.fill();
    x.beginPath();
    x.ellipse(14, 120, 26, 70, 0.1, 0, Math.PI * 2);
    x.ellipse(242, 120, 26, 70, -0.1, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "rgba(255, 170, 210, 0.7)";
    x.lineWidth = 6;
    x.beginPath();
    x.arc(128, 10, 70, 0.35 * Math.PI, 0.6 * Math.PI);
    x.stroke();
    // cheeks
    x.fillStyle = "rgba(255, 110, 150, 0.55)";
    x.beginPath();
    x.ellipse(66, 156, 22, 13, 0, 0, Math.PI * 2);
    x.ellipse(190, 156, 22, 13, 0, 0, Math.PI * 2);
    x.fill();
    eye(x, 86, 126, k.expr, k.blink, true, k.gx, k.gy);
    eye(x, 170, 126, k.expr, k.blink, false, k.gx, k.gy);
    brows(x, k.expr);
    mouthShape(x, k.expr, k.mouth, k.round);
    tex.needsUpdate = true;
  };
  return { tex, draw };
}
