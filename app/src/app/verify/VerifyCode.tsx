"use client";

import { useEffect, useState } from "react";

/**
 * Show the confirmation code from the URL fragment.
 *
 * :returns: The code, or a prompt to open the email link.
 */
export function VerifyCode() {
  const [code, setCode] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const hash = window.location.hash;
      if (!hash.startsWith("#t=")) return;
      setCode(decodeURIComponent(hash.slice(3)));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!code) {
    return (
      <p className="mt-8 text-sm">Open the confirmation link from your email.</p>
    );
  }

  return (
    <p className="mt-8 break-all border border-[#d4d4d4] px-3 py-2 text-sm leading-normal">
      {code}
    </p>
  );
}
