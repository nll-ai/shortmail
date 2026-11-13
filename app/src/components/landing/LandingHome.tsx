import { LetterSpecimen } from "@/components/LetterSpecimen";
import { focusClass } from "@/theme/controls";
import {
  DEFAULT_FOUNDING_CAP,
  DEFAULT_FOUNDING_WINDOW_DAYS,
  FOUNDING_CENTS_YEARLY,
  PREMIUM_CENTS_YEARLY,
} from "../../../shared/billing/config";
import { formatYearlyDollars } from "@/app/landing/formatPrice";
import { LANDING_PRIVACY_PARAGRAPH } from "@/app/landing/privacy";

const linkFocus = focusClass;

const standardYearly = formatYearlyDollars(PREMIUM_CENTS_YEARLY);
const foundingYearly = formatYearlyDollars(FOUNDING_CENTS_YEARLY);

export type LandingHomeProps = {
  foundingEligible: boolean;
};

/**
 * Owner-focused marketing homepage body.
 *
 * :param foundingEligible: Whether the founding yearly price may be mentioned.
 * :returns: The landing layout and copy.
 */
export function LandingHome({ foundingEligible }: LandingHomeProps) {
  return (
    <div
      className="min-h-svh bg-background text-foreground"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[42rem] items-center justify-between px-6">
          <span className="text-sm font-bold tracking-[0.04em]">ShortMail</span>
          <a
            href="/dashboard"
            className={`inline-flex min-h-11 min-w-11 items-center justify-center px-1 text-[15px] font-medium text-foreground ${linkFocus}`}
          >
            Sign in
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[42rem] px-6 pb-12 pt-14 max-sm:pt-9">
        <h1 className="text-4xl font-bold leading-[1.2] tracking-tight max-sm:text-[32px]">
          A link for the letters you are willing to read.
        </h1>
        <p className="mt-4 text-lg leading-[1.55] text-muted">
          Publish one link instead of your email address. People write at most
          500 characters, on the subjects you name. The letter arrives in the
          inbox you already use.
        </p>
        <a
          href="/dashboard"
          className={`mt-6 inline-flex min-h-11 items-center bg-accent px-[18px] text-base font-medium text-accent-foreground ${linkFocus}`}
        >
          Create your page
        </a>

        <LetterSpecimen />

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">The long letter</h2>
        <p className="leading-[1.55] text-muted">
          You put an address on a page, a paper, or a slide. What comes back is
          often a pitch, a request you have already answered, or a message that
          takes a paragraph to make one ask. You still want to be reachable.
          ShortMail is the link you give instead. Visitors see your subjects and
          your short answers. The box stops at 500 characters. You read the
          result as ordinary email.
        </p>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">
          How a letter gets to you
        </h2>
        <ol className="list-decimal space-y-3 pl-5 leading-normal">
          <li>
            Create a page. A free account gets a generated link, shaped like{" "}
            <span className="[overflow-wrap:anywhere]">/send/ada-1a2b3c</span>.
            Signup does not let you choose that name.
          </li>
          <li>
            Publish up to 5 subject headings and 3 FAQs. Visitors pick one of
            yours or write their own. Answers show on the page. The page keeps
            http(s) and mailto links and drops every other link.
          </li>
          <li>
            They leave a name and an email, at most 500 characters, and say
            whether they need a reply. Before delivery, they prove they can open
            that inbox. Disposable addresses are refused.
          </li>
          <li>
            You receive a normal email. ShortMail does not read your inbox and
            does not put a copy in the visitor&apos;s sent folder.
          </li>
        </ol>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">Free and Premium</h2>
        <p className="leading-[1.55]">
          <strong className="font-semibold text-foreground">Free:</strong> the
          send page, a generated link, a display name, 5 headings, 3 FAQs,
          reorder, and delivery as email. The public form uses the default
          theme, which follows the visitor&apos;s color scheme.
        </p>
        <p className="mt-3 leading-[1.55]">
          <strong className="font-semibold text-foreground">Premium:</strong> no
          cap on headings or FAQs, a custom link name, analytics for the last 30
          days (views, sends, a daily chart, the top subjects, and the share of
          letters that asked for a reply), theme presets (Default, Midnight,
          Paper, High contrast) plus sanitized custom CSS on the hosted page and
          the embed, and an allowlist of up to 20 sites that may embed the form.
        </p>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">Price</h2>
        <p className="text-lg font-semibold tracking-tight">
          {standardYearly} a year.
          {foundingEligible ? ` Founding price ${foundingYearly} a year.` : null}
        </p>
        <p className="mt-3 leading-[1.55] text-muted">
          Billed once a year. There is no monthly plan and no trial.
          {foundingEligible ? (
            <>
              {" "}
              The founding price applies only while both are still true: fewer
              than {DEFAULT_FOUNDING_CAP} customers have locked it, and billing
              has been open for fewer than {DEFAULT_FOUNDING_WINDOW_DAYS} days.
              Checkout chooses. If either condition has ended, the price is{" "}
              {standardYearly}. A subscription that starts at {foundingYearly}{" "}
              stays on that Stripe price until the subscription changes.
            </>
          ) : (
            <>
              {" "}
              Checkout bills {standardYearly} annually.
            </>
          )}{" "}
          You start on the free page. Upgrade and Manage billing are on the
          dashboard after you sign in. This page does not charge a card.
        </p>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">What is kept</h2>
        <p className="leading-[1.55] text-muted">{LANDING_PRIVACY_PARAGRAPH}</p>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">Questions</h2>
        <dl className="space-y-4 leading-[1.55]">
          <div>
            <dt className="font-semibold text-foreground">Will this stop all my email?</dt>
            <dd className="mt-1 text-muted">
              No. Anyone who already has your address can still write there.
              ShortMail is the link you offer when you would otherwise publish
              the address.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Are senders anonymous?</dt>
            <dd className="mt-1 text-muted">
              No. Name and email are required and both are on the email you
              receive.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">
              Why pay if the free page already delivers?
            </dt>
            <dd className="mt-1 text-muted">
              The free page is the channel. Premium is the name you can say out
              loud, more subjects and answers, a form that matches your site,
              control over which sites embed it, and a 30-day view of opens and
              sends.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Can I cancel?</dt>
            <dd className="mt-1 text-muted">
              Manage billing on the dashboard opens Stripe&apos;s customer
              portal.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">One account is one email.</dt>
            <dd className="mt-1 text-muted">
              There is no alias and no merge.
            </dd>
          </div>
        </dl>
      </main>

      <footer className="mt-12 border-t border-line">
        <div className="mx-auto flex max-w-[42rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-5 text-[13px] text-muted">
          <span>© Nonlinear Labs · BUSL-1.1</span>
          <a
            href="/connect"
            className={`inline-flex min-h-11 items-center text-foreground ${linkFocus}`}
          >
            Connect an agent
          </a>
          <span>One account, one email.</span>
        </div>
      </footer>
    </div>
  );
}
