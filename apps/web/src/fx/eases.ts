// Motion language (bible §12): slow, calm custom eases, registered once with GSAP (CustomEase is
// part of the free GSAP package). CSS uses the same curve as inOut1.
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);
export const EASES = {
  inOut1: CustomEase.create("inOut1", "M0,0 C0.5,0 0.1,1 1,1"),
  inOut2: CustomEase.create("inOut2", "M0,0 C0.56,0 0,1 1,1"),
  inOut3: CustomEase.create("inOut3", "M0,0 C0.6,0 0,1 1,1"),
  inOut4: CustomEase.create("inOut4", "M0,0 C0.4,0 -0.06,1 1,1"),
};
export const CSS_EASE = "cubic-bezier(0.5, 0, 0.1, 1)";
/** frame-rate independent damping: `rate` is the per-frame amount at 60 fps */
export const damp = (rate: number, dt: number) => 1 - Math.pow(1 - rate, dt * 60);
