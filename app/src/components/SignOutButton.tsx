import { signOut } from "@workos-inc/authkit-nextjs";

/** Follows the dashboard foreground, which flips with the system color scheme. */
export const SIGN_OUT_BUTTON_CLASS =
  "inline-flex min-h-11 items-center px-1 text-sm font-medium text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

/**
 * End the one AuthKit session for this browser.
 *
 * AuthKit keeps a single sealed session cookie. This posts to the SDK's
 * `signOut`, which clears that cookie and redirects to WorkOS.
 * It does not keep another account in the browser.
 */
export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <button type="submit" className={SIGN_OUT_BUTTON_CLASS}>
        Sign out
      </button>
    </form>
  );
}
