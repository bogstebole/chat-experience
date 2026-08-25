import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenTable } from "./TokenTable";

const meta: Meta<typeof TokenTable> = {
  title: "Design tokens",
  component: TokenTable,
  parameters: { layout: "padded" },
};

export default meta;

export const All: StoryObj<typeof TokenTable> = {
  name: "Every token",
};
