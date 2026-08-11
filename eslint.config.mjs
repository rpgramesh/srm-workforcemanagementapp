import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { fixupPluginRules } from "@eslint/compat";

const nextCoreWebVitalsConfig = {
  plugins: {
    "@next/next": fixupPluginRules(nextPlugin),
  },
  rules: {
    "@next/next/google-font-display": "warn",
    "@next/next/google-font-preconnect": "warn",
    "@next/next/inline-script-id": "error",
    "@next/next/next-script-for-ga": "warn",
    "@next/next/no-assign-module-variable": "error",
    "@next/next/no-async-client-component": "warn",
    "@next/next/no-before-interactive-script-outside-document": "warn",
    "@next/next/no-css-tags": "warn",
    "@next/next/no-document-import-in-page": "error",
    "@next/next/no-duplicate-head": "error",
    "@next/next/no-head-element": "warn",
    "@next/next/no-head-import-in-document": "error",
    "@next/next/no-html-link-for-pages": "off",
    "@next/next/no-img-element": "off",
    "@next/next/no-page-custom-font": "off",
    "@next/next/no-script-component-in-head": "error",
    "@next/next/no-styled-jsx-in-document": "warn",
    "@next/next/no-sync-scripts": "warn",
    "@next/next/no-title-in-document-head": "warn",
    "@next/next/no-typos": "warn",
    "@next/next/no-unwanted-polyfillio": "warn",
  },
};

const reactHooksConfig = {
  plugins: { "react-hooks": fixupPluginRules(reactHooks) },
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
};

export default [
  { ignores: [".next/**", "next-env.d.ts", "node_modules/**"] },
  {
    files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
    linterOptions: { reportUnusedDisableDirectives: true },
    ...reactHooksConfig,
    ...nextCoreWebVitalsConfig,
  },
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ["**/*.{ts,tsx,mts,cts}"],
  })),
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
