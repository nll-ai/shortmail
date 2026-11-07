import { signOut } from "@workos-inc/authkit-nextjs";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]";

/**
 * End the one AuthKit session for this browser.
 *
 * AuthKit keeps a single sealed `wos-session` cookie. This posts to the
 * SDK's `signOut`, which clears that cookie and redirects to WorkOS.
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
      <button
        type="submit"
        className={`inline-flex min-h-11 items-center px-1 text-sm font-medium text-[#171717] underline decoration-[#d4d4d4] underline-offset-4 hover:decoration-[#171717] ${focus}`}
      >
        Sign out
      </button>
    </form>
  );
}
