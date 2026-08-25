/**
 * vitest-axe ships an `extend-expect` declaration that augments the old global
 * `Vi` namespace, which Vitest 3 no longer reads. The matcher is registered in
 * setup.ts; this is the type half of the same registration.
 *
 * Both interfaces are deliberately empty and the type parameter deliberately
 * unused: a module augmentation has to restate the original declaration —
 * including its defaults — and adds only what it inherits.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
