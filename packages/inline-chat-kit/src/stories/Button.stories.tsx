import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageCircle, Trash2, Plus, ArrowRight } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "../Button/Button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "outline", "ghost", "glass"] },
    size: { control: "inline-radio", options: ["xs", "s", "m", "l", "xl"] },
  },
  args: { variant: "primary", size: "s", children: "Reply in thread" },
};

export default meta;
type Story = StoryObj<typeof Button>;

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "outline", "ghost", "glass"];
const SIZES: ButtonSize[] = ["xs", "s", "m", "l", "xl"];

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 16, minHeight: 56 }}>
    <span
      style={{
        width: 84,
        fontSize: 11,
        fontFamily: "var(--ick-font-mono)",
        color: "var(--ick-ink-faint)",
      }}
    >
      {label}
    </span>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>{children}</div>
  </div>
);

export const Playground: Story = {
  args: { icon: <MessageCircle size={14} aria-hidden /> },
};

/** The four materials, side by side, so a change to one is obvious against the rest. */
export const Variants: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <Button variant={variant} icon={<MessageCircle size={14} aria-hidden />}>
            Reply in thread
          </Button>
          <Button
            variant={variant}
            icon={<Trash2 size={14} aria-hidden />}
            aria-label="Remove highlight"
          />
          <Button variant={variant} iconRight={<ArrowRight size={14} aria-hidden />}>
            Continue
          </Button>
        </Row>
      ))}
    </div>
  ),
};

/**
 * One scale, from two that disagreed. Square while it holds only an icon,
 * growing to fit once it has words.
 */
export const Sizes: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <Button size={size} icon={<Plus size={14} aria-hidden />} aria-label="Add" />
          <Button size={size} icon={<Plus size={14} aria-hidden />}>
            With words
          </Button>
          <Button size={size} variant="glass">
            Glass
          </Button>
        </Row>
      ))}
    </div>
  ),
};

/**
 * Loading keeps the label in the accessibility tree — it is hidden with
 * opacity, not visibility, or the button would announce as one with no name.
 */
export const States: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <Button variant={variant}>Rest</Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
          <Button variant={variant} loading>
            Loading
          </Button>
        </Row>
      ))}
    </div>
  ),
};
