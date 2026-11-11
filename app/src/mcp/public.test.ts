import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_AUTHKIT_ISSUER,
  PRODUCTION_MCP_RESOURCE,
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
    expect(authkitIssuer({})).toBe(PRODUCTION_AUTHKIT_ISSUER);
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

  it("matches the issuer the preview build writes", () => {
    const source = readFileSync(
      new URL("../../scripts/preview/deploy-plan.mjs", import.meta.url),
      "utf8",
    );
    expect(source).toContain(PRODUCTION_AUTHKIT_ISSUER);
    expect(source).toContain("SHORTMAIL_MCP_RESOURCE");
  });
});
