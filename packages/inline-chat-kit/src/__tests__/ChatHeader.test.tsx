import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { Bookmark, Share2, Settings } from "lucide-react";
import { ChatHeader, type ChatHeaderAction } from "../ChatHeader/ChatHeader";

/**
 * A ResizeObserver jsdom does not have, and a handle to drive it.
 *
 * The header measures itself rather than the viewport, which is the behaviour
 * worth having and also the one jsdom cannot produce on its own — it lays
 * nothing out, so every element is zero wide. Faking the observer is the only
 * way to test collapsing at all; what it must not do is fake the *decision*,
 * which stays in the component.
 */
let notify: ((width: number) => void) | null = null;

class FakeResizeObserver {
  constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
    notify = (width: number) => cb([{ contentRect: { width } }]);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    notify = null;
  }
}

const resizeTo = (width: number) => act(() => notify?.(width));

const icon = <Bookmark size={16} aria-hidden />;

const ACTIONS: ChatHeaderAction[] = [
  { id: "bookmarks", label: "Bookmarks", icon, count: 3, pinned: true },
  { id: "share", label: "Share", icon: <Share2 size={16} aria-hidden /> },
  { id: "settings", label: "Settings", icon: <Settings size={16} aria-hidden /> },
];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  notify = null;
});

describe("the title", () => {
  it("is a level-2 heading by default, so it can be navigated to", () => {
    render(<ChatHeader title="Particle physics" />);
    expect(screen.getByRole("heading", { level: 2, name: "Particle physics" })).toBeInTheDocument();
  });

  it("takes the level from the host, whose document it is", () => {
    render(<ChatHeader title="Particle physics" headingLevel={4} />);
    expect(screen.getByRole("heading", { level: 4 })).toBeInTheDocument();
  });

  it("is plain text when the host says it is not a heading", () => {
    render(<ChatHeader title="Particle physics" headingLevel={false} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Particle physics")).toBeInTheDocument();
  });

  it("shows a subtitle beside it", () => {
    render(<ChatHeader title="Particle physics" subtitle="Claude Opus 5" />);
    expect(screen.getByText("Claude Opus 5")).toBeInTheDocument();
  });

  it("renders nothing at all when there is nothing to say", () => {
    const { container } = render(<ChatHeader />);
    expect(container.querySelector("h2")).toBeNull();
  });
});

describe("the status dot", () => {
  it("says in words what the colour shows", () => {
    render(<ChatHeader title="Chat" status="thinking" />);
    expect(screen.getByText("thinking")).toBeInTheDocument();
  });

  it("takes a spoken label of its own", () => {
    render(<ChatHeader title="Chat" status="online" statusLabel="Connected" />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByText("online")).not.toBeInTheDocument();
  });

  it("is absent when there is no status", () => {
    const { container } = render(<ChatHeader title="Chat" />);
    expect(container.querySelector("[data-status]")).toBeNull();
  });
});

describe("going back", () => {
  it("is an anchor when it navigates, so the browser's own affordances work", () => {
    render(<ChatHeader title="Chat" backHref="/" />);
    const back = screen.getByRole("link", { name: "Back" });
    expect(back).toHaveAttribute("href", "/");
  });

  it("is a button when it is a callback", () => {
    const onBack = vi.fn();
    render(<ChatHeader title="Chat" onBack={onBack} backLabel="Back to home" />);
    fireEvent.click(screen.getByRole("button", { name: "Back to home" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("is absent when neither is given", () => {
    render(<ChatHeader title="Chat" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("actions", () => {
  it("names every one of them, since an icon has no name of its own", () => {
    render(<ChatHeader title="Chat" actions={ACTIONS} collapseActionsAt={false} />);
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  /**
   * The badge is `aria-hidden`. If the count were not in the name too, a
   * reader would be told "Bookmarks" and never learn there are three.
   */
  it("folds a count into the accessible name", () => {
    render(<ChatHeader title="Chat" actions={ACTIONS} collapseActionsAt={false} />);
    expect(screen.getByRole("button", { name: "Bookmarks, 3" })).toBeInTheDocument();
  });

  it("draws the badge only when there is something to count", () => {
    const { container, rerender } = render(
      <ChatHeader title="Chat" actions={[{ id: "b", label: "Bookmarks", icon, count: 0 }]} />
    );
    expect(container.querySelector("[aria-hidden='true']:not(svg)")).toBeNull();

    rerender(<ChatHeader title="Chat" actions={[{ id: "b", label: "Bookmarks", icon, count: 2 }]} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("caps the badge but not the spoken count", () => {
    render(<ChatHeader title="Chat" actions={[{ id: "b", label: "Bookmarks", icon, count: 512 }]} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bookmarks, 512" })).toBeInTheDocument();
  });

  it("reports a toggle as pressed", () => {
    render(
      <ChatHeader title="Chat" actions={[{ id: "t", label: "Dark theme", icon, active: true }]} />
    );
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("leaves a plain command unpressed rather than saying it is off", () => {
    render(<ChatHeader title="Chat" actions={[{ id: "s", label: "Share", icon }]} />);
    expect(screen.getByRole("button", { name: "Share" })).not.toHaveAttribute("aria-pressed");
  });

  it("is an anchor when it carries an href", () => {
    render(<ChatHeader title="Chat" actions={[{ id: "d", label: "Docs", icon, href: "/docs" }]} />);
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
  });

  it("calls back on click", () => {
    const onClick = vi.fn();
    render(<ChatHeader title="Chat" actions={[{ id: "s", label: "Share", icon, onClick }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders custom children the kit does not manage", () => {
    render(
      <ChatHeader title="Chat" actions={ACTIONS}>
        <button type="button">Model</button>
      </ChatHeader>
    );
    expect(screen.getByRole("button", { name: "Model" })).toBeInTheDocument();
  });
});

describe("collapsing", () => {
  it("keeps everything visible while there is room", () => {
    render(<ChatHeader title="Chat" actions={ACTIONS} collapseActionsAt={520} />);
    resizeTo(800);
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });

  it("folds the unpinned ones once it is narrow", () => {
    render(<ChatHeader title="Chat" actions={ACTIONS} collapseActionsAt={520} />);
    resizeTo(360);
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bookmarks, 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  /**
   * An element nobody has laid out measures zero, which is not the same as
   * "narrow". Reading it as narrow would hide the actions in every hidden tab
   * and every test that never triggers a resize.
   */
  it("does not treat an unmeasured header as a narrow one", () => {
    render(<ChatHeader title="Chat" actions={ACTIONS} collapseActionsAt={520} />);
    resizeTo(0);
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("never folds when told not to", () => {
    render(<ChatHeader title="Chat" actions={ACTIONS} collapseActionsAt={false} />);
    resizeTo(120);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});

describe("the overflow menu", () => {
  const open = () => {
    render(<ChatHeader title="Chat" actions={ACTIONS} collapseActionsAt={520} />);
    resizeTo(360);
    const trigger = screen.getByRole("button", { name: "More actions" });
    fireEvent.click(trigger);
    return { trigger, menu: screen.getByRole("menu") };
  };

  it("announces itself as a menu before it is opened", () => {
    render(<ChatHeader title="Chat" actions={ACTIONS} collapseActionsAt={520} />);
    resizeTo(360);
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("lists the folded actions by name", () => {
    const { menu } = open();
    expect(within(menu).getByRole("menuitem", { name: "Share" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
  });

  it("puts focus on the first item", () => {
    const { menu } = open();
    expect(within(menu).getByRole("menuitem", { name: "Share" })).toHaveFocus();
  });

  it("moves with the arrows and wraps", () => {
    const { menu } = open();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(within(menu).getByRole("menuitem", { name: "Settings" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(within(menu).getByRole("menuitem", { name: "Share" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(within(menu).getByRole("menuitem", { name: "Settings" })).toHaveFocus();
  });

  it("jumps to the ends", () => {
    const { menu } = open();
    fireEvent.keyDown(menu, { key: "End" });
    expect(within(menu).getByRole("menuitem", { name: "Settings" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Home" });
    expect(within(menu).getByRole("menuitem", { name: "Share" })).toHaveFocus();
  });

  it("keeps exactly one item in the tab order", () => {
    const { menu } = open();
    const items = within(menu).getAllByRole("menuitem");
    expect(items.filter((item) => item.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("closes on Escape and hands focus back to the trigger", () => {
    const { trigger, menu } = open();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("runs the action and closes", () => {
    const onClick = vi.fn();
    render(
      <ChatHeader
        title="Chat"
        actions={[
          { id: "p", label: "Pinned", icon, pinned: true },
          { id: "s", label: "Share", icon, onClick },
        ]}
        collapseActionsAt={520}
      />
    );
    resizeTo(360);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  /** `menuitem` takes no pressed or checked state; a toggle is a checkbox. */
  it("describes a toggle as a menuitemcheckbox", () => {
    render(
      <ChatHeader
        title="Chat"
        actions={[
          { id: "p", label: "Pinned", icon, pinned: true },
          { id: "t", label: "Dark theme", icon, active: true },
        ]}
        collapseActionsAt={520}
      />
    );
    resizeTo(360);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const item = screen.getByRole("menuitemcheckbox", { name: "Dark theme" });
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item).not.toHaveAttribute("aria-pressed");
  });
});

describe("the landmark", () => {
  it("is a banner at the top of a page", () => {
    render(<ChatHeader title="Chat" />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  /** A header inside a panel claiming the page's banner would be a lie. */
  it("is not one inside a panel", () => {
    render(<ChatHeader title="Chat" landmark={false} />);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});

describe("elevation", () => {
  it("stays flat until something has scrolled under it", () => {
    const { container } = render(<ChatHeader title="Chat" sticky />);
    const header = container.firstElementChild!;
    expect(header).not.toHaveAttribute("data-scrolled");

    Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header).toHaveAttribute("data-scrolled");

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header).not.toHaveAttribute("data-scrolled");
  });

  it("does not listen at all when it is switched off", () => {
    const { container } = render(<ChatHeader title="Chat" elevateOnScroll={false} />);
    Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(container.firstElementChild).not.toHaveAttribute("data-scrolled");
  });
});
