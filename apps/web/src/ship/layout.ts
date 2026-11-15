/**
 * Odyssey Base layout (bible §6): one round hangar ~24 units across, a short tube north to the
 * Launch Bay. Shared by the logic (Ship3D, controls, colliders) and the dressed set.
 */
export const HUB_R = 12;
export const DOOR1 = -12;
export const DOOR2 = -15.5;
export const CTRL_R = 7.5;
export const CTRL_Z = DOOR2 - CTRL_R;
/** Story Library: five books on an arc around the Memory Core Globe, facing the airlock (south). */
export const LIB_R = 3.7;
export const BOOK_ANGLES = [-1.0, -0.5, 0, 0.5, 1.0];
export const BOOK_POS: [number, number][] = BOOK_ANGLES.map((a) => [Math.sin(a) * LIB_R, Math.cos(a) * LIB_R]);
/** Zone anchors */
export const ZONES = {
  cozy: { x: -8.2, z: 1.5 },
  echoes: { x: 8.4, z: 0.5 },
  airlock: { x: 0, z: HUB_R - 0.6 },
};
/** Where the explorer is, for set pieces that react or step aside for the camera. */
export const where = { x: -1.6, z: 6.6 };
