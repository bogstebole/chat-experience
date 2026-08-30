import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Context } from "../Context/Context";
import { ChatHeader } from "../ChatHeader/ChatHeader";

/**
 * How full the context window is.
 *
 * Small on purpose. It is a gauge, not a feature, and it earns its place for
 * one reason: it is the only honest way to explain why a long conversation
 * starts forgetting.
 */
const meta: Meta<typeof Context> = {
  title: "Components/Context",
  component: Context,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Context>;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
    <div
      style={{
        width: 260,
        fontFamily: "var(--ick-font-mono)",
        fontSize: 11,
        color: "var(--ick-ink-faint)",
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

const TOTAL = 1_000_000;

/** Filling up. It stays quiet until it is worth noticing. */
export const Filling: Story = {
  render: () => (
    <div style={{ maxWidth: 560 }}>
      {[0, 0.08, 0.3, 0.62, 0.79, 0.85, 0.97, 1].map((f) => (
        <Row key={f} label={`${Math.round(f * 100)}% — ${f >= 0.8 ? "past warnAt" : "quiet"}`}>
          <Context used={Math.round(TOTAL * f)} total={TOTAL} />
        </Row>
      ))}
    </div>
  ),
};

/** What it says beside the ring is yours. */
export const Labels: Story = {
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <Row label="default — the percentage">
        <Context used={128_000} total={TOTAL} />
      </Row>
      <Row label="label={false} — the ring alone, for a header">
        <Context used={128_000} total={TOTAL} label={false} />
      </Row>
      <Row label="a count instead">
        <Context used={128_000} total={TOTAL} label="128k / 1M" />
      </Row>
      <Row label="another language">
        <Context
          used={880_000}
          total={TOTAL}
          labels={{
            name: "Iskorišćen kontekst",
            of: "od",
            tokens: "tokena",
            nearlyFull: "Skoro pun — najstarije poruke počinju da otpadaju",
          }}
        />
      </Row>
    </div>
  ),
};

/** Where it actually goes. */
export const InAHeader: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ maxWidth: 640, border: "1px solid var(--ick-border)", borderRadius: 12 }}>
      <ChatHeader title="Higgs boson" subtitle="14 turns">
        <Context used={840_000} total={TOTAL} label={false} />
      </ChatHeader>
    </div>
  ),
};

/** Climbing, which is the only time anybody looks at it. */
export const Climbing: Story = {
  render: function Climbing() {
    const [used, setUsed] = useState(40_000);
    useEffect(() => {
      const t = setInterval(
        () => setUsed((u) => (u > TOTAL ? 40_000 : u + 90_000)),
        900
      );
      return () => clearInterval(t);
    }, []);
    return (
      <div style={{ maxWidth: 560 }}>
        <Row label="watch it pass warnAt">
          <Context used={used} total={TOTAL} />
        </Row>
      </div>
    );
  },
};
