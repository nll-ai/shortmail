import { authorizationServerResponse } from "@/mcp/discovery";
import { authkitIssuer } from "@/mcp/public";

export const dynamic = "force-dynamic";

export function GET() {
  return authorizationServerResponse(authkitIssuer(process.env));
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
