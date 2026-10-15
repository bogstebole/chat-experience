"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ButtonHTMLAttributes,
  type ComponentType,
  type MouseEventHandler,
  type ReactNode,
  type RefAttributes,
} from "react";
import type { ButtonSize, ButtonVariant } from "../Button/Button";

/**
 * What every button the kit draws is for — the same names it carries in
 * `data-ick-role`. A host's button can switch on it.
 *
 * `send`, `stop` and `save` are listed because they are roles, but they are
 * never handed to a host's component: the composer's glyph morphs between the
 * three inside the button, and that animation is the kit's. They are themed
 * through the `--ick-btn-primary-*` tokens on `[data-ick-role="send"]` and its
 * siblings instead.
 */
export type KitButtonRole =
  | "send"
  | "stop"
  | "save"
  | "add"
  | "dictate"
  | "cancel-edit"
  | "add-close"
  | "read-more"
  | "message-action"
  | "answer-action"
  | "suggestion"
  | "back"
  | "header-action"
  | "header-more"
  | "header-menu-item"
  | "approval-once"
  | "approval-always"
  | "approval-deny"
  | "question-next"
  | "highlight-action"
  | "thread-save"
  | "thread-close"
  | "pane-expand"
  | "pane-close"
  | "remove-attachment";

/**
 * The box the kit has laid out for a button. A hint: a host's button is free
 * to draw its own corners.
 *
 * - `square` — an icon on its own. The box is as wide as it is tall.
 * - `pill` — a short text button standing on its own, as a chip: an opener in
 *   an empty conversation, an action over a highlight, "Read more".
 * - `default` — a text button in a row of actions.
 */
export type KitButtonShape = "pill" | "square" | "default";

/**
 * Everything the kit hands a host's button.
 *
 * The kit owns the layout and the behaviour: the box this button sits in, its
 * size, where it goes, how it arrives and leaves, its 44px hit area on a
 * touch screen, and what it does when pressed. The host owns the paint:
 * colour, border, radius, font, shadow, what hover and press look like, and
 * the focus ring.
 *
 * So a host's component has to:
 *
 * - **forward its ref** to the element (`forwardRef`) — focus is moved to it,
 *   and the header's "…" menu is anchored by it;
 * - **render a `<button>`** — the kit relies on its keyboard behaviour;
 * - **spread what it does not use** onto that `<button>`: the `aria-*`,
 *   `data-*`, `title`, `role`, `tabIndex`, `type`, `onClick` and the other
 *   handlers. `kitRole`, `variant`, `size`, `shape`, `icon`, `iconRight`,
 *   `loading` and `pressed` are the kit's words for things and are not
 *   attributes: take them out first;
 * - **fill the box it is given** — the kit sets its height, and on `square`
 *   its width, and positions it. Nothing the host draws should move it;
 * - **show focus** — the kit's own ring is not drawn on a host's button.
 *
 * In development the kit warns, once per role, about a button that breaks one
 * of the first two rules, drops the `aria-*` or `data-ick-*` it was given, or
 * shows no change on keyboard focus.
 */
export interface KitButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children" | "disabled" | "onClick"> {
  /** What the button is for. Also on the element as `data-ick-role`. */
  kitRole: KitButtonRole;
  /** What the kit would have drawn: a hint for picking the host's own variant. */
  variant: ButtonVariant;
  /** Which step of `--ick-control-*` the box is. The box is sized already. */
  size: ButtonSize;
  shape: KitButtonShape;
  /** Leading icon. With no `children` it is the whole button, and `aria-label` names it. */
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  /** Working: draw a spinner if you have one. `disabled` and `aria-busy` are set too. */
  loading?: boolean;
  /** A toggle that is on. `aria-pressed` is set too. */
  pressed?: boolean;
  /** Always `"button"`. A host's button inside a form must not submit it. */
  type: "button";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  "data-ick-role": KitButtonRole;
  "data-ick-variant": ButtonVariant;
  /** Which of several the role is — `copy`, `edit`, a header action's `id`. */
  "data-ick-action"?: string;
  /** Anything else the kit marks a button with, such as `data-voice` on the microphone. */
  [data: `data-${string}`]: string | number | boolean | undefined;
}

/** A host's button, as the kit takes it. It must forward its ref. */
export type KitButtonComponent = ComponentType<KitButtonProps & RefAttributes<HTMLButtonElement>>;

/**
 * The components a host can draw in place of the kit's.
 *
 * One, so far: `Button`, used for every button the kit draws but the
 * composer's send / stop / save glyph.
 */
export interface ChatComponents {
  Button?: KitButtonComponent;
}

const ComponentsContext = createContext<ChatComponents>({});

/**
 * Hands a host's components to every kit component beneath it, the way
 * `LabelsProvider` hands it the words. `ChatExperience` sets one up from its
 * `components` prop; a host assembling the pieces itself — `ChatTurnRow`,
 * `ChatHeader`, `Approval` — wraps them in this.
 *
 * Nests: an inner provider's components override the outer one's, one by one.
 */
export function ComponentsProvider({
  components,
  children,
}: {
  components?: ChatComponents;
  children?: ReactNode;
}) {
  const parent = useContext(ComponentsContext);
  const Button = components?.Button;
  /* Keyed on the components themselves, so an object literal written inline
     in a host's render costs nothing after the first time. A component
     declared inside a render would be a new one every time — and remount
     every button — which is the host's to avoid, as with any component. */
  const value = useMemo(
    () => (Button ? { ...parent, Button } : parent),
    [parent, Button]
  );
  return <ComponentsContext.Provider value={value}>{children}</ComponentsContext.Provider>;
}

/** The host's components, where there are any. */
export function useChatComponents(): ChatComponents {
  return useContext(ComponentsContext);
}
