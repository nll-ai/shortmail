import { defineConfig } from "cypress";
import { startFaqFixture } from "./cypress/fixture-server";

export default defineConfig({
  e2e: {
    supportFile: false,
    specPattern: "cypress/e2e/**/*.cy.ts",
    video: false,
    screenshotOnRunFailure: true,
    screenshotsFolder: process.env.CI
      ? "cypress/screenshots"
      : "/opt/cursor/artifacts/cypress-screenshots",
    chromeWebSecurity: false,
    defaultCommandTimeout: 8000,
    async setupNodeEvents(_on, config) {
      config.baseUrl = await startFaqFixture();
      return config;
    },
  },
});
