import { AirmailLetter } from "@/components/AirmailLetter";

const OWNER_VANITY = "cce87ae9c1d7"; // Eric's send page — the landing's working form mails HIM.

export default function Home() {
  return (
    <div className="airmail-page">
      <div className="airmail-frame" aria-hidden="true" />

      <header className="airmail-header">
        <span className="airmail-par-avion" aria-hidden="true">
          PAR AVION · AIR MAIL
        </span>
        <div className="airmail-stamp" aria-hidden="true">
          <span className="stamp-perforation">
            <span className="stamp-value">500</span>
            <span className="stamp-label">CHARACTERS</span>
            <span className="stamp-brand">SHORTMAIL</span>
          </span>
        </div>
      </header>

      <main className="airmail-main">
        <h1 className="airmail-title">
          Write Eric a short letter.
        </h1>
        <p className="airmail-sub">
          500 characters. He reads every one — long ones get skimmed, short
          ones get answered.
        </p>

        <AirmailLetter vanity={OWNER_VANITY} />

        <section className="airmail-how">
          <h2 className="airmail-h2">Why short?</h2>
          <p>
            A long email is a request for your time. A short letter is a gift
            of your judgment — you decide what matters in five hundred
            characters or fewer.
          </p>
          <p>
            Messages are not stored. Your letter is emailed to Eric and then
            it exists only where email exists: your sent folder, his inbox.
          </p>
        </section>
      </main>

      <footer className="airmail-footer">
        <span>
          ShortMail — receive fewer, shorter, better emails. © Nonlinear Labs.
          BUSL-1.1.
        </span>
      </footer>
    </div>
  );
}
