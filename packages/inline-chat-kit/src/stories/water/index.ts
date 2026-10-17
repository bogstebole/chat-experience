/**
 * The water's looks, one fragment shader each, all reading the uniforms that
 * `Cymatics` sets. Imported raw: a shader that does not compile fails when it
 * is chosen, in that story, rather than breaking the build of every other.
 *
 * Round two (interference): best, sources, plane, dish, hybrid.
 * Round one (kept to compare): glass, milk, ripple, caustic, chladni, current.
 */
import best from "./best.glsl?raw";
import sources from "./sources.glsl?raw";
import plane from "./plane.glsl?raw";
import dish from "./dish.glsl?raw";
import hybrid from "./hybrid.glsl?raw";
import glass from "./glass.glsl?raw";
import milk from "./milk.glsl?raw";
import ripple from "./ripple.glsl?raw";
import caustic from "./caustic.glsl?raw";
import chladni from "./chladni.glsl?raw";
import current from "./current.glsl?raw";

export const LOOKS = { best, sources, plane, dish, hybrid, glass, milk, ripple, caustic, chladni, current } as const;

export type Look = keyof typeof LOOKS;
