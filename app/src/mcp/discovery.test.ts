import { describe, expect, it } from "vitest";
import { authorizationServerResponse } from "./discovery";

describe("authorization server metadata", () => {
  it("proxies AuthKit and caches the document", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return Response.json({ issuer: "https://issuer.example", token_endpoint: "https://issuer.example/token" });
    }) as typeof fetch;
    const issuer = `https://issuer-${calls}-${Date.now()}.example`;
    const first = await authorizationServerResponse(issuer, fetchImpl, 1_000);
    const second = await authorizationServerResponse(issuer, fetchImpl, 1_500);
    expect(first.status).toBe(200);
    expect(await second.json()).toMatchObject({ issuer: "https://issuer.example" });
    expect(calls).toBe(1);
    expect(first.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("does not cache a failed fetch", async () => {
    const fetchImpl = (async () => {
      throw new Error("down");
    }) as typeof fetch;
    const response = await authorizationServerResponse(
      `https://down-${Date.now()}.example`,
      fetchImpl,
      1_000,
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "auth_metadata_unavailable" });
  });
});
