export const PRODUCTION_CLIENT_ID: string;
export const STAGING_CLIENT_ID: string;
export const PRODUCTION_AUTHKIT_ISSUER: string;
export const STAGING_AUTHKIT_ISSUER: string;

export function resolveAuthkitIssuer(
  env: Record<string, string | undefined>,
): string | null;
