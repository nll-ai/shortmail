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
    <div
      className="min-h-svh bg-white text-[#171717]"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <header className="border-b border-[#e5e5e5]">
        <div className="mx-auto flex max-w-[42rem] items-center px-6 py-4">
          <span className="text-sm font-bold tracking-[0.04em]">ShortMail</span>
        </div>
      </header>
      <main className="mx-auto max-w-[42rem] px-6 pb-12 pt-14">
        <h1 className="text-4xl font-bold leading-[1.2] tracking-tight">
          Copy your code
        </h1>
        <p className="mt-4 text-lg leading-[1.55] text-[#525252]">
          Return to the ShortMail form where you wrote the letter, paste this
          code, and press Confirm email. This page does not send the letter.
          Opening the link on another device does not move the letter here.
        </p>
        <VerifyCode />
      </main>
    </div>
  );
}
