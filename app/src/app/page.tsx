import type { Metadata } from "next";
import { LandingHome } from "@/components/landing/LandingHome";
import { loadFoundingEligible } from "@/app/landing/loadFoundingEligible";

export const metadata: Metadata = {
  title: "ShortMail",
  description:
    "One link instead of your email address. 500 characters, delivered to the inbox you already use.",
};

/**
 * Owner-focused marketing page.
 *
 * The letter below is a static example. Account actions go to the existing
 * dashboard gate and this component does not send mail.
 */
export default async function Home() {
  const foundingEligible = await loadFoundingEligible();
  return <LandingHome foundingEligible={foundingEligible} />;
}
