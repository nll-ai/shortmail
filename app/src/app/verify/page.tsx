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
    <main className="mx-auto max-w-lg px-6 py-16 text-[#171717]">
      <h1 className="text-2xl font-bold tracking-tight">Copy your code</h1>
      <p className="mt-4 leading-relaxed text-[#525252]">
        Return to the ShortMail form where you wrote the letter, paste this
        code, and press Confirm email. This page does not send the letter.
        Opening the link on another device does not move the letter here.
      </p>
      <VerifyCode />
    </main>
  );
}
