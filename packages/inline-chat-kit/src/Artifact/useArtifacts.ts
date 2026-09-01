"use client";

import { useCallback, useState } from "react";

export interface Artifacts {
  /** The one on screen, or `null`. */
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
  /** Press the card that is already open and it closes, which is what a reader expects. */
  toggle: (id: string) => void;
}

/**
 * Which artifact is open.
 *
 * A hook rather than state inside the pane, for the reason `useChatTurns` is a
 * hook: the card in the transcript and the pane beside it are in different
 * parts of the tree and both need the answer. A pane that owned it could not
 * tell a card it was the open one, and a card that owned it could not be told
 * the pane had closed.
 *
 * One at a time. A stack of open artifacts is a tab bar, and a tab bar is a
 * product's decision about how many things somebody is holding at once.
 */
export function useArtifacts(initial: string | null = null): Artifacts {
  const [openId, setOpenId] = useState<string | null>(initial);

  const open = useCallback((id: string) => setOpenId(id), []);
  const close = useCallback(() => setOpenId(null), []);
  const toggle = useCallback((id: string) => setOpenId((at) => (at === id ? null : id)), []);

  return { openId, open, close, toggle };
}
