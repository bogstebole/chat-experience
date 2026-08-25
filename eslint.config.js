import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // `storybook-static` is build output, not source. Linting it reports on
  // Storybook's own bundled code, which is neither ours nor fixable.
  globalIgnores(["**/dist", "**/node_modules", "**/storybook-static"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Fast-refresh boundaries only matter for the app, not the library.
    files: ["apps/playground/**/*.{ts,tsx}"],
    extends: [reactRefresh.configs.vite],
  },
]);
