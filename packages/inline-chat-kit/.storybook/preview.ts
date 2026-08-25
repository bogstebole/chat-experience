import type { Preview } from "@storybook/react-vite";
import "../src/styles/tokens.css";
import "./storybook.css";

/**
 * The theme is set the way a host app sets it — `data-theme` on the root
 * element — rather than through a Storybook-only mechanism. If it works here
 * it works in an application, and if it stops working here it has stopped
 * working there too.
 */
const applyTheme = (theme: string) => {
  document.documentElement.setAttribute("data-theme", theme);
  document.body.style.background = theme === "dark" ? "rgb(18 18 18)" : "#ffffff";
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Light" },
          { value: "dark", icon: "moon", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      applyTheme(context.globals.theme as string);
      return Story();
    },
  ],
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
};

export default preview;
