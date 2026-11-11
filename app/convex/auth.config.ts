/**
 * Dashboard sessions use the AuthKit user-management issuer.
 * MCP access tokens use the AuthKit domain issuer. Their audience is the
 * MCP resource URL once a resource indicator is configured, and the WorkOS
 * client id until then (WorkOS falls back to the client id when no
 * indicator is set). Both audiences are accepted for that issuer.
 */
const clientId = process.env.WORKOS_CLIENT_ID;
const authkitIssuer = process.env.WORKOS_AUTHKIT_ISSUER?.replace(/\/$/, "");
const mcpResource = process.env.SHORTMAIL_MCP_RESOURCE?.replace(/\/$/, "");

const providers: {
  type: "customJwt";
  issuer: string;
  algorithm: "RS256";
  jwks: string;
  applicationID: string | undefined;
}[] = [
  {
    type: "customJwt",
    issuer: `https://api.workos.com/`,
    algorithm: "RS256",
    jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    applicationID: clientId,
  },
  {
    type: "customJwt",
    issuer: `https://api.workos.com/user_management/${clientId}`,
    algorithm: "RS256",
    jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    applicationID: clientId,
  },
];

if (authkitIssuer && clientId) {
  providers.push({
    type: "customJwt",
    issuer: authkitIssuer,
    algorithm: "RS256",
    jwks: `${authkitIssuer}/oauth2/jwks`,
    applicationID: clientId,
  });
}

if (authkitIssuer && mcpResource && mcpResource !== clientId) {
  providers.push({
    type: "customJwt",
    issuer: authkitIssuer,
    algorithm: "RS256",
    jwks: `${authkitIssuer}/oauth2/jwks`,
    applicationID: mcpResource,
  });
}

const authConfig = { providers };

export default authConfig;
