import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Dependency boundaries (FRONTEND-ARCHITECTURE.md §Layers), enforced with the built-in no-restricted-imports.
// `npm run check:architecture` enforces the same rules plus cycle detection over the whole graph.
const NO_PARENT_HOPS = { group: ["../../*"], message: 'Use the "@/" alias across folders instead of "../../".' };
const NO_DEEP_FEATURE = { group: ["@/features/*/**"], message: 'Import other features only through their public API: "@/features/<name>".' };
const restrict = (...patterns) => ["error", { patterns: [NO_PARENT_HOPS, ...patterns] }];

const PRODUCTION = { ignores: ["**/*.test.ts", "**/*.test.tsx", "src/test/**"] };

export default tseslint.config(
  { ignores: ["dist", "node_modules", "src/assets/icons/iconData.js", "src/assets/illustrations/lammaArt.js"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-restricted-imports": restrict(),
    },
  },
  {
    ...PRODUCTION,
    files: ["src/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict({ group: ["@/app/**", "@/features/**", "@/shared/**", "@/test/**"], message: "services/ is the lowest layer: it must not import app, features, shared or test code." }),
    },
  },
  {
    ...PRODUCTION,
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict({ group: ["@/app/**", "@/features/**", "@/test/**"], message: "shared/ must stay business-agnostic: it may import only services/ and assets/." }),
    },
  },
  {
    ...PRODUCTION,
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict(NO_DEEP_FEATURE, { group: ["@/app/**", "@/test/**"], message: "features/ must not import the app layer or test code." }),
    },
  },
  {
    ...PRODUCTION,
    files: ["src/app/layouts/app-shell/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict({ group: ["@/features", "@/features/**"], message: "AppShell is layout composition only; features plug in through AuthenticatedLayout's slots." }),
    },
  },
  {
    ...PRODUCTION,
    files: ["src/app/**/*.{ts,tsx}"],
    ignores: [...PRODUCTION.ignores, "src/app/layouts/app-shell/**"],
    rules: {
      "no-restricted-imports": restrict(NO_DEEP_FEATURE),
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
