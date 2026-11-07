import type { Metadata } from "next";
import { VerifyCode } from "./VerifyCode";

export const metadata: Metadata = {
  title: "Confirm your email — ShortMail",
  description: "Copy your ShortMail confirmation code. This page does not send a letter.",
};

/**
 * Read-only confirmation page. The code arrives in the URL fragment and is
 * not posted from here.
 */
export default function VerifyPage() {
  return (
    <main
      className="min-h-svh bg-white px-4 py-10 text-[#171717]"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <div className="mx-auto max-w-lg border border-[#d4d4d4] bg-white p-6 sm:p-8">
        <p className="text-sm font-bold tracking-[0.04em]">ShortMail</p>
        <h1 className="mt-6 text-lg font-semibold">Copy your code</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#525252]">
          Return to the form where you wrote the letter and paste this code.
          This page does not send the letter.
        </p>
        <VerifyCode />
      </div>
    </main>
  );
}
