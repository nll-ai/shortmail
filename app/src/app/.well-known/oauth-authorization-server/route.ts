import { authorizationServerResponse } from "@/mcp/discovery";
import { authkitIssuer } from "@/mcp/public";

export const dynamic = "force-dynamic";

export function GET() {
  const issuer = authkitIssuer(process.env);
  if (!issuer) {
    return Response.json(
      { error: "auth_issuer_unconfigured" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  return authorizationServerResponse(issuer);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
