"use client";

import { useCallback, useState } from "react";

export interface DisclosureOptions {
  /** Controlled. Leave it out and the row keeps its own. */
  open?: boolean;
  /** Where it starts, when the row's own preference is not what you want. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * What the row would do if nobody had an opinion.
   *
   * Read every render, so it follows the state: a tool call that fails later
   * opens itself, a reasoning block folds away when the answer starts.
   */
  preferOpen: boolean;
}

/**
 * Open or shut, decided by three sources in order of who gets the last word:
 * the host if it is controlling the row, then whoever clicked it, then the
 * row's own preference.
 *
 * That order is the whole point, and it is why this is not an effect. An
 * effect forcing the row open on a state change would also reopen one that
 * somebody had deliberately shut — showing a reader again what they have
 * already dismissed is not help. Derived, a reader's decision simply outlives
 * every state change after it, and a row nobody has touched still follows
 * along.
 */
export function useDisclosure({ open, defaultOpen, onOpenChange, preferOpen }: DisclosureOptions) {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const isOpen = open ?? toggled ?? defaultOpen ?? preferOpen;

  const toggle = useCallback(() => {
    const next = !isOpen;
    // Controlled: report, and wait to be told. Setting our own would make the
    // row move before the host agreed to it.
    if (open === undefined) setToggled(next);
    onOpenChange?.(next);
  }, [isOpen, onOpenChange, open]);

  return { isOpen, toggle };
}
