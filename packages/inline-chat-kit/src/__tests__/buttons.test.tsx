import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../Button/Button";
import GlassButton from "../GlassButton/GlassButton";
import { ChatInput } from "../ChatInput/ChatInput";

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

/**
 * A host's buttons, not the kit's.
 *
 * Reported from a host that matched the kit's buttons by hashed class name
 * (`[class*='ick-primary-']`), by position (the button inside the composer's
 * surface is the send), and by `aria-label` (the stop is the one whose label
 * is "Zaustavi") — so translating a label changed its colour. Each button now
 * says what it is and what it is for, and its paint is tokens.
 */
describe("what a button says about itself", () => {
  const SRC = join(import.meta.dirname, "..");
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return ["stories", "__tests__", "demo", "examples"].includes(entry.name) ? [] : sources(path);
      }
      return entry.name.endsWith(".tsx") ? [path] : [];
    });

  /* Every `<Button` the kit draws, by the props written on it — up to the
     closing `>` of its opening tag, which is the first one not inside braces. */
  const openingTags = (text: string): string[] => {
    const tags: string[] = [];
    for (const match of text.matchAll(/<Button(?=[\s/>])/g)) {
      const at = match.index;
      let depth = 0;
      let end = at;
      for (; end < text.length; end++) {
        const c = text[end];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) break;
      }
      tags.push(text.slice(at, end));
    }
    return tags;
  };

  it("names its role, on every button the kit draws", () => {
    const missing = sources(SRC)
      .filter((path) => !/Button\/Button\.tsx$|GlassButton\.tsx$/.test(path))
      .flatMap((path) =>
        openingTags(readFileSync(path, "utf8"))
          .filter((tag) => !tag.includes("data-ick-role"))
          .map((tag) => `${path.slice(SRC.length + 1)}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`)
      );
    expect(missing, `no data-ick-role on:\n${missing.join("\n")}`).toEqual([]);
  });

  it("names its variant", () => {
    render(<Button variant="outline">Later</Button>);
    expect(screen.getByRole("button", { name: "Later" })).toHaveAttribute("data-ick-variant", "outline");
  });

  /* "Send" and "Stop" were one button with one look, and a host could tell
     them apart only by the words on them. */
  it("tells a send from a stop", () => {
    const props = { onChange: () => {}, onSubmit: () => {}, onStop: () => {} };
    const { rerender } = render(<ChatInput state="typing" value="Hi" {...props} />);
    expect(screen.getByRole("button", { name: /send/i })).toHaveAttribute("data-ick-role", "send");
    rerender(<ChatInput state="responding" value="Hi" {...props} />);
    expect(screen.getByRole("button", { name: /stop/i })).toHaveAttribute("data-ick-role", "stop");
  });

  it("paints every variant from its own tokens", () => {
    const css = readFileSync(join(SRC, "Button", "Button.module.css"), "utf8");
    const tokens = readFileSync(join(SRC, "styles", "tokens.css"), "utf8");
    for (const variant of ["primary", "secondary", "outline", "ghost", "glass"]) {
      /* The button's own states, not its pseudo-elements: the glass rim and
         edge drawn with ::before and ::after are glass tokens. */
      const rules = [...css.matchAll(new RegExp(`\\.${variant}((?::[^{]*)?)\\s*\\{([^}]*)\\}`, "g"))]
        .filter((m) => !m[1].includes("::"))
        .map((m) => m[2])
        .join("\n");
      /* What a variant is painted with — its fill and its ink. The glass
         shadows and rim are the shared glass tokens, which is their own tier. */
      const paint = [...rules.matchAll(/(?:^|\n)\s*(background|color):\s*([^;]+);/g)];
      expect(paint.length, `${variant} paints something`).toBeGreaterThan(0);
      for (const [, property, value] of paint) {
        if (value.trim() === "transparent") continue;
        expect(value, `${variant} ${property}`).toMatch(new RegExp(`var\\(--ick-btn-${variant}-`));
      }
      for (const used of rules.match(/--ick-btn-[a-z-]+/g) ?? []) {
        expect(tokens, `${used} is declared`).toContain(`${used}:`);
      }
    }
  });
});
