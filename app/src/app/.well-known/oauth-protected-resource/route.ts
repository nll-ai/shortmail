import { protectedResourceResponse } from "@/mcp/discovery";

export const dynamic = "force-dynamic";

export function GET() {
  return protectedResourceResponse(process.env);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
