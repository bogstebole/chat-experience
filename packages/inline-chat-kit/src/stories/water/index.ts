/**
 * The water's looks, one fragment shader each, all reading the uniforms that
 * `Cymatics` sets. Imported raw: a shader that does not compile fails when it
 * is chosen, in that story, rather than breaking the build of every other.
 *
 * Kept from the rounds of looks: plane (interference across the surface) and
 * ripple (rings from the centre). Sand is particles, in `../sand.ts`.
 */
import plane from "./plane.glsl?raw";
import ripple from "./ripple.glsl?raw";

export const LOOKS = { plane, ripple } as const;

export type Look = keyof typeof LOOKS;
