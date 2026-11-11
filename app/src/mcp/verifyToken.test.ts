import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { AuthServerUnavailable, verifyMcpAccessToken } from "./verifyToken";

const ISSUER = "https://fair-rose-65.authkit.app";
const RESOURCE = "https://shortmail.nonlinearlabs.ai/mcp";
const CLIENT_ID = "client_test";
const USER = "user_01KHAAXV0B8WJDFMEKDDQBQ0A9";

async function signer() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.alg = "RS256";
  jwk.kid = "test";
  const jwks = createLocalJWKSet({ keys: [jwk] });
  return {
    jwks,
    async token(audience: string, options?: { subject?: string; expiresIn?: string | number }) {
      return new SignJWT({ email: "owner@example.com" })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer(ISSUER)
        .setAudience(audience)
        .setSubject(options?.subject ?? USER)
        .setIssuedAt()
        .setExpirationTime(options?.expiresIn ?? "2m")
        .sign(privateKey);
    },
  };
}

describe("MCP access tokens", () => {
  it("accepts the resource audience and the WorkOS client id", async () => {
    const keys = await signer();
    const resourceToken = await keys.token(RESOURCE);
    const clientToken = await keys.token(CLIENT_ID);
    const options = { jwks: keys.jwks, issuer: ISSUER, audiences: [RESOURCE, CLIENT_ID] };
    await expect(verifyMcpAccessToken(resourceToken, options)).resolves.toMatchObject({
      sub: USER,
      email: "owner@example.com",
    });
    await expect(verifyMcpAccessToken(clientToken, options)).resolves.toMatchObject({ sub: USER });
  });

  it("rejects a wrong audience, issuer, subject, or expired token", async () => {
    const keys = await signer();
    const options = { jwks: keys.jwks, issuer: ISSUER, audiences: [RESOURCE] };
    await expect(verifyMcpAccessToken(await keys.token("https://other.example/mcp"), options)).rejects.toThrow();
    const wrongIssuer = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://evil.example")
      .setAudience(RESOURCE)
      .setSubject(USER)
      .setExpirationTime("2m")
      .sign((await generateKeyPair("RS256")).privateKey);
    await expect(verifyMcpAccessToken(wrongIssuer, options)).rejects.toThrow();
    await expect(
      verifyMcpAccessToken(await keys.token(RESOURCE, { subject: "user_short" }), options),
    ).rejects.toThrow(/invalid subject/);
    await expect(
      verifyMcpAccessToken(await keys.token(RESOURCE, { expiresIn: "-1m" }), options),
    ).rejects.toThrow();
  });

  it("reports a signing-key outage separately from a bad token", async () => {
    const keys = await signer();
    const token = await keys.token(RESOURCE);
    await expect(
      verifyMcpAccessToken(token, {
        jwks: async () => {
          throw new TypeError("fetch failed");
        },
        issuer: ISSUER,
        audiences: [RESOURCE],
      }),
    ).rejects.toBeInstanceOf(AuthServerUnavailable);
  });
});
