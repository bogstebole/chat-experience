/**
 * The field: the figure the voice draws above its own words.
 *
 * Loaded only when a dictation opens one, so a host that never asks for
 * `sand`, `plane` or `ripple` never downloads a line of it — it is a WebGL
 * engine and two shaders, and most chats are not going to want it.
 */
import plane from "./plane.glsl?raw";
import ripple from "./ripple.glsl?raw";
import { Water, modeForOrder, type Frame, type Mode } from "./water";
import { Sand } from "./sand";
import { BANDS, ToneTracker, detectPitch } from "./tone";

export type FieldLook = "sand" | "plane" | "ripple";

export interface Field {
  center: { x: number; y: number };
  mic: { x: number; y: number };
  radius: number;
  setMode: (mode: Mode) => void;
  setModeNow: (mode: Mode) => void;
  draw: (frame: Frame) => void;
  dispose: () => void;
}

/**
 * How far past its radius each look draws, so all three fill the same place:
 * the radius holding nine tenths of the ink was measured at 88px for the
 * sand, 56px for the plane and 42px for the ripple, which melt into the page
 * well inside the radius they are given.
 */
export const REACH: Record<FieldLook, number> = { sand: 1, plane: 1.55, ripple: 2.1 };

export const createField = (canvas: HTMLCanvasElement, look: FieldLook): Field =>
  look === "sand" ? new Sand(canvas) : new Water(canvas, look === "plane" ? plane : ripple);

export { BANDS, ToneTracker, detectPitch, modeForOrder };
export type { Frame, Mode };
