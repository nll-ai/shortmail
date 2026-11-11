import type { NextFetchEvent, NextRequest } from "next/server";
import { authkitProxy } from "@workos-inc/authkit-nextjs";
import { callbackUrlFor } from "./auth/callback-url";

const fallbackRedirect = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? "";

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return authkitProxy({
    redirectUri: callbackUrlFor(request.nextUrl.origin, fallbackRedirect),
    middlewareAuth: {
      enabled: true,
      unauthenticatedPaths: [
        "/",
        "/send/:path*",
        "/verify",
        "/auth/error",
        "/api/:path*",
      ],
    },
  })(request, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
