import { jwtVerify, type JWTVerifyGetKey } from "jose";

/** WorkOS user ids look like `user_` plus 26 uppercase id characters. */
const USER_ID = /^user_[0-9A-Z]{26}$/;

export type VerifiedMcpToken = {
  sub: string;
  email?: string;
};

export class AuthServerUnavailable extends Error {
  constructor() {
    super("auth_unavailable");
    this.name = "AuthServerUnavailable";
  }
}

/**
 * Verify an AuthKit access token for this MCP resource.
 *
 * :param token: Bearer token, without the `Bearer` prefix.
 * :param options: JWKS, issuer, and accepted audiences.
 * :returns: The WorkOS user id, and email when the token carries one.
 */
export async function verifyMcpAccessToken(
  token: string,
  options: {
    jwks: JWTVerifyGetKey;
    issuer: string;
    audiences: string[];
  },
): Promise<VerifiedMcpToken> {
  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    const verified = await jwtVerify(token, options.jwks, {
      issuer: options.issuer,
      audience: options.audiences,
      algorithms: ["RS256"],
      clockTolerance: 5,
    });
    payload = verified.payload;
  } catch (error) {
    if (isNetworkFailure(error)) throw new AuthServerUnavailable();
    throw error;
  }
  if (typeof payload.sub !== "string" || !USER_ID.test(payload.sub)) {
    throw new Error("invalid subject");
  }
  const email = typeof payload.email === "string" ? payload.email : undefined;
  return { sub: payload.sub, email };
}

function isNetworkFailure(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const message = current.message.toLowerCase();
      if (
        current.name === "TypeError" ||
        message.includes("fetch") ||
        message.includes("network") ||
        message.includes("econnrefused")
      ) {
        return true;
      }
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
