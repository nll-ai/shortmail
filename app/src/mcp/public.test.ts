import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_AUTHKIT_ISSUER,
  PRODUCTION_CLIENT_ID,
  PRODUCTION_MCP_RESOURCE,
  STAGING_AUTHKIT_ISSUER,
  STAGING_CLIENT_ID,
  authkitIssuer,
  mcpAudiences,
  mcpResourceUrl,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  wwwAuthenticate,
} from "./public";

describe("MCP resource URL", () => {
  it("uses the production URL, the preview branch alias, or an explicit override", () => {
    expect(mcpResourceUrl({ VERCEL_ENV: "production" })).toBe(PRODUCTION_MCP_RESOURCE);
    expect(
      mcpResourceUrl({
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: "shortmail-git-feat-eric-mas-projects-a230afd1.vercel.app",
      }),
    ).toBe("https://shortmail-git-feat-eric-mas-projects-a230afd1.vercel.app/mcp");
    expect(mcpResourceUrl({ SHORTMAIL_MCP_RESOURCE: "https://example.test/mcp/" })).toBe(
      "https://example.test/mcp",
    );
    expect(authkitIssuer({})).toBeNull();
    expect(mcpAudiences({ WORKOS_CLIENT_ID: "client_test", VERCEL_ENV: "production" })).toEqual([
      PRODUCTION_MCP_RESOURCE,
      "client_test",
    ]);
  });

  it("points the challenge at protected-resource metadata", () => {
    const metadata = protectedResourceMetadata(PRODUCTION_MCP_RESOURCE, PRODUCTION_AUTHKIT_ISSUER);
    expect(metadata.authorization_servers).toEqual([PRODUCTION_AUTHKIT_ISSUER]);
    expect(metadata.bearer_methods_supported).toEqual(["header"]);
    expect(protectedResourceMetadataUrl(PRODUCTION_MCP_RESOURCE)).toBe(
      "https://shortmail.nonlinearlabs.ai/.well-known/oauth-protected-resource/mcp",
    );
    expect(wwwAuthenticate(PRODUCTION_MCP_RESOURCE)).toContain(
      'resource_metadata="https://shortmail.nonlinearlabs.ai/.well-known/oauth-protected-resource/mcp"',
    );
  });

  it("uses staging AuthKit for preview and production, and keeps the production resource", () => {
    const preview = "https://shortmail-git-cursor-mcp-page-2c5b4b-eric-mas-projects-a230afd1.vercel.app";
    expect(
      authkitIssuer({
        VERCEL_ENV: "preview",
        WORKOS_CLIENT_ID: STAGING_CLIENT_ID,
      }),
    ).toBe(STAGING_AUTHKIT_ISSUER);
    expect(
      authkitIssuer({
        VERCEL_ENV: "production",
        WORKOS_CLIENT_ID: STAGING_CLIENT_ID,
      }),
    ).toBe(STAGING_AUTHKIT_ISSUER);
    expect(
      authkitIssuer({
        VERCEL_ENV: "production",
        WORKOS_CLIENT_ID: PRODUCTION_CLIENT_ID,
      }),
    ).toBe(STAGING_AUTHKIT_ISSUER);
    expect(authkitIssuer({ WORKOS_CLIENT_ID: STAGING_CLIENT_ID })).toBe(STAGING_AUTHKIT_ISSUER);
    expect(authkitIssuer({ WORKOS_CLIENT_ID: PRODUCTION_CLIENT_ID })).toBe(
      PRODUCTION_AUTHKIT_ISSUER,
    );
    expect(
      authkitIssuer({
        VERCEL_ENV: "production",
        WORKOS_AUTHKIT_ISSUER: "https://override.example/",
      }),
    ).toBe("https://override.example");

    const productionIssuer = authkitIssuer({ VERCEL_ENV: "production" });
    const productionMetadata = protectedResourceMetadata(
      mcpResourceUrl({ VERCEL_ENV: "production" }),
      productionIssuer ?? "",
    );
    expect(productionMetadata.resource).toBe("https://shortmail.nonlinearlabs.ai/mcp");
    expect(productionMetadata.authorization_servers).toEqual([STAGING_AUTHKIT_ISSUER]);

    const metadata = protectedResourceMetadata(
      `${preview}/mcp`,
      authkitIssuer({ VERCEL_ENV: "preview", WORKOS_CLIENT_ID: STAGING_CLIENT_ID }) ?? "",
    );
    expect(metadata.authorization_servers).toEqual([STAGING_AUTHKIT_ISSUER]);
    expect(metadata.resource).toBe(`${preview}/mcp`);
  });

  it("lets the preview build import the same issuer resolver", () => {
    const source = readFileSync(
      new URL("../../scripts/preview/deploy-plan.mjs", import.meta.url),
      "utf8",
    );
    expect(source).toContain("resolveAuthkitIssuer");
    expect(source).toContain("SHORTMAIL_MCP_RESOURCE");
    expect(source).not.toContain(PRODUCTION_AUTHKIT_ISSUER);
  });
});
