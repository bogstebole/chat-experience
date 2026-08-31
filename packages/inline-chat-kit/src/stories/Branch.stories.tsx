import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Branch } from "../Branch/Branch";

/**
 * Which answer you are looking at, and how to reach the others.
 *
 * Regenerating used to overwrite: the answer you were comparing against was
 * gone the moment the second one started. The reason anybody presses
 * regenerate is to find out whether a second attempt is better, and there is
 * no better once the first has been thrown away.
 */
const meta: Meta<typeof Branch> = {
  title: "Components/Branch",
  component: Branch,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Branch>;

const Wrap = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 28 }}>
    <div
      style={{
        marginBottom: 8,
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

/** Walk it. The ends disable rather than wrap — there is no answer zero. */
export const Walking: Story = {
  render: function Walk() {
    const [index, setIndex] = useState(1);
    return (
      <Wrap label="three answers, on the second">
        <Branch total={3} index={index} onSelect={setIndex} />
      </Wrap>
    );
  },
};

/** At each end, so the disabled arrow can be looked at. */
export const Ends: Story = {
  render: () => (
    <div>
      <Wrap label="first — nothing behind it">
        <Branch total={3} index={0} onSelect={() => {}} />
      </Wrap>
      <Wrap label="last — nothing ahead of it">
        <Branch total={3} index={2} onSelect={() => {}} />
      </Wrap>
      <Wrap label="ten, where the count is two digits and must not jog">
        <Branch total={10} index={8} onSelect={() => {}} />
      </Wrap>
    </div>
  ),
};

/**
 * One answer is not a branch. A control reading "1 of 1" is a control offering
 * to take you nowhere, so it draws nothing at all.
 */
export const Alone: Story = {
  render: () => (
    <Wrap label="one answer — nothing is drawn">
      <Branch total={1} index={0} onSelect={() => {}} />
    </Wrap>
  ),
};
