import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import configPrettier from "eslint-config-prettier";

export default defineConfig([
  globalIgnores(["dist", ".vite"]),

  // -------------------------------------------------------------------------
  // TypeScript source files — full type-aware strict linting
  // -------------------------------------------------------------------------
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      configPrettier,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prefer type imports to keep the emitted JS clean
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      // Disallow non-null assertions — use proper narrowing instead
      "@typescript-eslint/no-non-null-assertion": "error",
      // No explicit `any`
      "@typescript-eslint/no-explicit-any": "error",
      // Require explicit return types on exported functions
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Prefer nullish coalescing over || for nullable values
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      // Prefer optional chaining
      "@typescript-eslint/prefer-optional-chain": "error",
      // No floating promises
      "@typescript-eslint/no-floating-promises": "error",
      // Require awaiting promises used as statements
      "@typescript-eslint/no-misused-promises": "error",
      // No unnecessary type assertions
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      // No unsafe operations (complements no-explicit-any)
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
    },
  },

  // -------------------------------------------------------------------------
  // Test files — relax rules that are noisy/impractical in tests
  // -------------------------------------------------------------------------
  {
    files: ["src/**/*.test.{ts,tsx}"],
    plugins: { vitest },
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.test.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...vitest.configs.recommended.rules,
      // Type assertions are unavoidable when using testing-library
      "@typescript-eslint/no-non-null-assertion": "off",
      // Empty no-op callbacks are common in tests (e.g. onConnect={() => {}})
      "@typescript-eslint/no-empty-function": "off",
      // Unsafe operations are common in test mocks/fixtures
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },

  // -------------------------------------------------------------------------
  // Scripts — type-aware linting via checkJs + tsconfig.scripts.json
  // -------------------------------------------------------------------------
  {
    files: ["scripts/**/*.js"],
    ignores: ["scripts/**/*.test.js"],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, configPrettier],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node },
      parserOptions: {
        projectService: false,
        project: "./tsconfig.scripts.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Untyped JS produces pervasive any — suppress unsafe-* noise
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      // No floating promises
      "@typescript-eslint/no-floating-promises": "error",
      // No misused promises
      "@typescript-eslint/no-misused-promises": "error",
      // Not applicable to plain JS — catch params can't be annotated as unknown
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
    },
  },

  // -------------------------------------------------------------------------
  // Script test files — plain JS baseline + vitest rules, no type-checking
  // (mock types from vi.fn() don't survive checkJs type inference)
  // -------------------------------------------------------------------------
  {
    files: ["scripts/**/*.test.js"],
    plugins: { vitest },
    extends: [js.configs.recommended, configPrettier],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node },
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
  },

  // -------------------------------------------------------------------------
  // Vite/Vitest config — plain JS baseline, node globals
  // -------------------------------------------------------------------------
  {
    files: ["vite.config.ts", "vitest.config.ts"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
]);
