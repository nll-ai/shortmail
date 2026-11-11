/// <reference types="vite/client" />

/**
 * Convex function modules for convex-test. Tests and declaration files are
 * not function modules.
 */
const found = import.meta.glob("./**/*.*s");

export const modules = Object.fromEntries(
  Object.entries(found).filter(
    ([path]) => !path.includes(".test.") && !path.endsWith(".d.ts") && path !== "./test.setup.ts",
  ),
);
