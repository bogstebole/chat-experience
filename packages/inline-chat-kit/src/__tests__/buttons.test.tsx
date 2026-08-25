import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../Button/Button";
import GlassButton from "../GlassButton/GlassButton";

describe("Button", () => {
  it("renders as a real button so it is reachable by keyboard", () => {
    render(<Button icon={<svg />} aria-label="Add" />);
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("fires on click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button icon={<svg />} aria-label="Add" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("fires on Enter, since it is a button and not a div", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button icon={<svg />} aria-label="Add" onClick={onClick} />);

    await user.tab();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("stays silent while disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button icon={<svg />} aria-label="Add" onClick={onClick} disabled />);

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a label when given children", () => {
    render(<Button icon={<svg />}>Read more</Button>);
    expect(screen.getByRole("button", { name: /read more/i })).toBeInTheDocument();
  });

  it("keeps a caller's className rather than replacing it", () => {
    render(<Button icon={<svg />} aria-label="Add" className="caller-supplied" />);
    expect(screen.getByRole("button", { name: "Add" })).toHaveClass("caller-supplied");
  });

  it("forwards a ref to the underlying element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref} icon={<svg />} aria-label="Add" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe("GlassButton", () => {
  it("renders its label", () => {
    render(<GlassButton>Start experience</GlassButton>);
    expect(screen.getByRole("button", { name: /start experience/i })).toBeInTheDocument();
  });

  it("announces loading and refuses interaction while it lasts", async () => {
    // The stylesheet also sets pointer-events: none, which userEvent would
    // refuse to click through. Bypassing that check is deliberate: it proves
    // the `disabled` attribute carries the guarantee on its own, rather than
    // the button merely being hidden behind CSS a consumer could override.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onClick = vi.fn();
    render(
      <GlassButton loading onClick={onClick}>
        Saving
      </GlassButton>
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is not busy when it is not loading", () => {
    render(<GlassButton>Idle</GlassButton>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "false");
  });

  it("renders icons on either side without disturbing the accessible name", () => {
    render(
      <GlassButton iconLeft={<svg data-testid="left" />} iconRight={<svg data-testid="right" />}>
        Continue
      </GlassButton>
    );

    expect(screen.getByTestId("left")).toBeInTheDocument();
    expect(screen.getByTestId("right")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("accepts every documented size", () => {
    for (const size of ["s", "m", "l"] as const) {
      const { unmount } = render(<GlassButton size={size}>Sized</GlassButton>);
      expect(screen.getByRole("button", { name: /sized/i })).toBeInTheDocument();
      unmount();
    }
  });

  /**
   * The label used to be hidden with `visibility: hidden` while loading, which
   * takes it out of the accessibility tree — and the spinner is `aria-hidden`,
   * so the button announced as a button with no name at all. It is still
   * called what it was called; it is just busy.
   */
  it("keeps its name while loading", () => {
    render(<GlassButton loading>Continue</GlassButton>);
    const button = screen.getByRole("button", { name: /continue/i });
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
