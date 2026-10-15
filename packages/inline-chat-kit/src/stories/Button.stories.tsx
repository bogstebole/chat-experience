import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageCircle, Trash2, Plus, ArrowRight } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "../Button/Button";
import { ChatInput } from "../ChatInput/ChatInput";

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

/**
 * A host's own buttons, from its own stylesheet.
 *
 * Every variant is painted from `--ick-btn-<variant>-*` tokens, and every
 * button the kit draws names what it is for in `data-ick-role` — so a host
 * sets its primary once, and gives one role its own look by setting the same
 * tokens on `[data-ick-role="…"]`. Here the send is the host's blue and the
 * stop beside it is red: two roles, where they used to be one button that a
 * host could tell apart only by its label.
 */
export const HostButtons: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="host-brand">
      <style>{`
        .host-brand {
          --ick-btn-radius: 10px;
          --ick-btn-primary-bg: #1d4ed8;
          --ick-btn-primary-ink: #ffffff;
          --ick-btn-primary-border: transparent;
          --ick-btn-primary-shadow: none;
          --ick-btn-primary-shadow-hover: 0 2px 6px rgb(29 78 216 / 0.35);
          --ick-btn-primary-shadow-press: none;
          --ick-btn-secondary-ink: #1d4ed8;
          --ick-btn-secondary-bg-hover: #e8eefc;
          --ick-btn-secondary-border-hover: transparent;
          --ick-btn-secondary-shadow-hover: none;
          --ick-btn-secondary-shadow-press: none;
          --ick-btn-outline-border: #1d4ed8;
          --ick-btn-outline-ink: #1d4ed8;
        }
        .host-brand [data-ick-role="stop"] {
          --ick-btn-primary-bg: #dc2626;
        }
      `}</style>
      {VARIANTS.filter((v) => v !== "glass").map((variant) => (
        <Row key={variant} label={variant}>
          <Button variant={variant} data-ick-role="example" icon={<MessageCircle size={14} aria-hidden />}>
            Reply in thread
          </Button>
          <Button
            variant={variant}
            data-ick-role="example"
            icon={<Plus size={14} aria-hidden />}
            aria-label="Add"
          />
        </Row>
      ))}
      <Row label="send">
        <div style={{ width: 320 }}>
          <ChatInput state="typing" value="When is the next visit?" onChange={() => {}} onSubmit={() => {}} />
        </div>
      </Row>
      <Row label="stop">
        <div style={{ width: 320 }}>
          <ChatInput
            state="typing"
            value=""
            busy
            onStop={() => {}}
            onChange={() => {}}
            onSubmit={() => {}}
          />
        </div>
      </Row>
    </div>
  ),
};
