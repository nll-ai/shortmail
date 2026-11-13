export function portalErrorMessage(code: string | undefined): string {
  switch (code) {
    case "no_customer":
      return "We could not open billing yet — there is no Stripe customer on this account. Upgrade through checkout or ask an admin to comp Premium.";
    case "unauthorized":
      return "Sign in to manage billing.";
    default:
      return "Billing is unavailable right now. Please try again in a moment.";
  }
}
