import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Attachments, formatSize, type Attachment } from "../Attachments/Attachments";

const PICTURE: Attachment = {
  id: "a",
  name: "kitchen.png",
  type: "image/png",
  size: 284_112,
  url: "blob:kitchen",
};
const FILE: Attachment = {
  id: "b",
  name: "care-plan.pdf",
  type: "application/pdf",
  size: 482_000,
};

describe("a size", () => {
  it.each([
    [0, "0 B"],
    [900, "900 B"],
    [1024, "1.0 KB"],
    [1_204, "1.2 KB"],
    [284_112, "277 KB"],
    [482_000, "471 KB"],
    [1_284_112, "1.2 MB"],
    [3_221_225_472, "3.0 GB"],
  ])("%s bytes reads as %s", (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected);
  });

  /** A size nobody supplied is not "0 B" — it is nothing. */
  it.each([undefined, NaN, Infinity, -1])("says nothing for %s", (bytes) => {
    expect(formatSize(bytes as number)).toBe("");
  });
});

describe("the row", () => {
  it("draws nothing at all when there is nothing to draw", () => {
    const { container } = render(<Attachments attachments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * A picture shows itself. A PDF does not: a thumbnail of one at this size is
   * a grey rectangle with a corner turned down, and tells you less than the
   * filename does.
   */
  it("shows a picture as a picture and everything else by name", () => {
    render(<Attachments attachments={[PICTURE, FILE]} />);
    expect(screen.getByRole("img", { name: "kitchen.png" })).toBeInTheDocument();
    expect(screen.getByText("care-plan.pdf")).toBeInTheDocument();
    expect(screen.getByText("471 KB")).toBeInTheDocument();
    // The picture carries its name for anybody not looking at it, and its size
    // is not worth a line beside a thumbnail.
    expect(screen.queryByText("277 KB")).toBeNull();
  });

  /** An image with no URL has no picture to show, so it falls back to a name. */
  it("names an image it was given no url for", () => {
    render(<Attachments attachments={[{ id: "c", name: "pending.png", type: "image/png" }]} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("pending.png")).toBeInTheDocument();
  });

  /**
   * With a handler it is a control; without one it is a record. That is the
   * whole difference between the composer's copy and the sent message's.
   */
  it("offers no way to remove one unless it is given somewhere to report it", () => {
    const { rerender } = render(<Attachments attachments={[PICTURE, FILE]} />);
    expect(screen.queryByRole("button")).toBeNull();

    const onRemove = vi.fn();
    rerender(<Attachments attachments={[PICTURE, FILE]} onRemove={onRemove} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("names what each remove button removes", async () => {
    const onRemove = vi.fn();
    render(<Attachments attachments={[PICTURE, FILE]} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove care-plan.pdf" }));
    expect(onRemove).toHaveBeenCalledWith("b");
  });

  /**
   * In the composer this sits on the highlighter's surface, where a
   * pointerdown starts drawing a marker. The click is for the button.
   */
  it("does not let removing one start a marker", async () => {
    let started = false;
    render(
      <div onPointerDown={() => (started = true)}>
        <Attachments attachments={[FILE]} onRemove={() => {}} />
      </div>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(started).toBe(false);
  });
});
