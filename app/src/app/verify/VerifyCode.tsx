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
      <p className="mt-4 text-sm text-muted">
        Open the confirmation link from your email.
      </p>
    );
  }

  return (
    <p className="mt-4 box-border w-full break-all border border-line bg-background px-3 py-2 text-sm font-normal leading-normal text-foreground">
      {code}
    </p>
  );
}
