import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appPackage = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  "package.json",
);
const require = createRequire(appPackage);

export type PuppeteerPage = {
  goto: (url: string, options?: { waitUntil: "networkidle0" }) => Promise<unknown>;
  screenshot: (options: {
    path: string;
    fullPage?: boolean;
  }) => Promise<unknown>;
  setViewport: (viewport: { width: number; height: number }) => Promise<unknown>;
  emulateMediaFeatures: (
    features: { name: string; value: string }[],
  ) => Promise<unknown>;
  click: (selector: string) => Promise<unknown>;
  waitForSelector: (selector: string) => Promise<unknown>;
  waitForFunction: (
    fn: ((...args: string[]) => boolean) | (() => boolean),
    options?: { timeout: number },
    ...args: string[]
  ) => Promise<unknown>;
  evaluate: (fn: (...args: string[]) => unknown, ...args: string[]) => Promise<unknown>;
  setContent: (
    html: string,
    options?: { waitUntil: "networkidle0" },
  ) => Promise<unknown>;
  close: () => Promise<void>;
};

export const puppeteer = require("puppeteer-core") as {
  launch: (options: {
    executablePath: string;
    headless: string;
    args: string[];
  }) => Promise<{
    newPage: () => Promise<PuppeteerPage>;
    close: () => Promise<void>;
  }>;
};

export const CHROME_EXECUTABLE =
  process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
