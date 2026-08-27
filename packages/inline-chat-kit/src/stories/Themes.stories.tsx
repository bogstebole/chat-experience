import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageCircle, Trash2 } from "lucide-react";
import { Button } from "../Button/Button";
import { ChatInput } from "../ChatInput/ChatInput";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";
import { BRANDS, type Brand } from "./brands";

/**
 * The same components, four times, differing only by the custom properties on
 * the element they sit inside.
 *
 * Two things this is here to demonstrate, both of which were claims until
 * somebody rendered them:
 *
 * 1. A brand is a handful of values. Each panel below sets between six and
 *    nine, and nothing component-specific.
 * 2. A theme can be applied to a subtree. `.ick-theme` on a wrapper is enough,
 *    which is why four brands can share one page.
 */
const meta: Meta = {
  title: "Design tokens/Themes",
  parameters: { layout: "padded" },
};

export default meta;

const ANSWER =
  "The Standard Model organises twelve fermions — six quarks and six leptons — plus the force-carrying bosons into one framework.";

function Panel({ brand }: { brand: Brand | null }) {
  const [value, setValue] = useState("What holds a proton together?");

  return (
    <section
      // Without the class the custom properties below would set the channels
      // and change nothing: a derived token is substituted where it is
      // declared, and its finished value is what inherits.
      className={brand ? "ick-theme" : undefined}
      data-theme={brand?.dark ? "dark" : brand ? "light" : undefined}
      style={{
        ...(brand?.tokens as React.CSSProperties),
        padding: 24,
        borderRadius: 12,
        background: "var(--ick-surface)",
        color: "var(--ick-ink)",
        border: "1px solid var(--ick-border)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        // Equal widths, so the panels are compared rather than the space they
        // happen to be given.
        flex: "1 1 340px",
        maxWidth: 420,
      }}
    >
      <header>
        <div style={{ fontFamily: "var(--ick-font-mono)", fontSize: 12, color: "var(--ick-ink)" }}>
          {brand?.name ?? "Default"}
        </div>
        <div
          style={{
            fontFamily: "var(--ick-font-sans)",
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--ick-ink-faint)",
            marginTop: 4,
          }}
        >
          {brand?.note ?? "What the package ships with, for comparison."}
        </div>
      </header>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Button icon={<MessageCircle size={14} aria-hidden />}>Reply</Button>
        <Button variant="glass" size="m">
          Continue
        </Button>
        <Button
          variant="secondary"
          icon={<Trash2 size={14} aria-hidden />}
          aria-label="Remove highlight"
        />
      </div>

      <ChatInput
        state="typing"
        value={value}
        onChange={setValue}
        onSubmit={() => {}}
        placeholder="Ask me anything"
      />

      <div style={{ fontFamily: "var(--ick-font-sans)", fontSize: 13, lineHeight: 1.6 }}>
        <TextHighlighter text={ANSWER} />
      </div>

      <div
        style={{
          fontFamily: "var(--ick-font-mono)",
          fontSize: 11,
          color: "var(--ick-ink-faint)",
        }}
      >
        {brand ? `${Object.keys(brand.tokens).length} tokens` : "no overrides"}
      </div>
    </section>
  );
}

/** Drag across a paragraph in any panel — the marker is that brand's too. */
export const Brands: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
      <Panel brand={null} />
      {BRANDS.map((brand) => (
        <Panel key={brand.name} brand={brand} />
      ))}
    </div>
  ),
};
