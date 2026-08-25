import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // The kit is the thing being documented, so stories import from source
  // rather than from a build. What you see is what the next commit ships.
  core: { disableTelemetry: true },
};

export default config;
