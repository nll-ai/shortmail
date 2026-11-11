import type { ReactNode } from "react";

/**
 * Stand-in for `next/link` when Cypress renders a page outside Next.
 */
export default function Link({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
