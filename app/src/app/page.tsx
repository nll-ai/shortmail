import { AirmailLetter } from "@/components/AirmailLetter";

const OWNER_VANITY = "cce87ae9c1d7"; // Eric's send page — the landing's working form mails HIM.

export default function Home() {
  return (
    <div className="letter-page">
      <header className="letter-masthead">
        <span className="letter-masthead-title">ShortMail</span>
        <span className="letter-masthead-meta">
          Receive fewer, shorter, better emails
        </span>
      </header>

      <main className="letter-main">
        <p className="letter-kicker">Write Eric a short letter</p>
        <h1 className="letter-title">
          Five hundred characters. He reads every one.
        </h1>
        <p className="letter-standfirst">
          Long emails get skimmed; short letters get answered. Write yours
          below — no account, no storage, no expectation of a novel. When
          you&rsquo;re done, it departs for Eric&rsquo;s desk as plain email.
        </p>

        <div className="letter-grid">
          <div className="min-w-0">
            <AirmailLetter vanity={OWNER_VANITY} />
          </div>

          <aside className="letter-margin">
            <p className="letter-margin-h">Why short?</p>
            <p className="letter-margin-note">
              A long email is a request for your time. A short letter is a
              gift of your judgment — you decide what matters in five hundred
              characters or fewer.
            </p>
            <p className="letter-margin-h">Where it goes</p>
            <p className="letter-margin-note">
              Your letter is emailed to Eric and then it exists only where
              email exists: your sent folder, his inbox. Nothing is stored,
              tracked, or shared.
            </p>
            <p className="letter-margin-h">What he wants to hear about</p>
            <p className="letter-margin-note">
              Consulting, teaching, talks — or anything else worth five
              hundred characters. Pick a subject from his list, or write your
              own.
            </p>
          </aside>
        </div>
      </main>

      <footer className="letter-footer">
        <span>© Nonlinear Labs · BUSL-1.1 · one account, one email</span>
        <span>Est. 2026</span>
      </footer>
    </div>
  );
}
