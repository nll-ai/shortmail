"use client";

import { useEffect, useRef, useState } from "react";
import { configUrl, sendUrl } from "../widget/api";

type Headings = { displayName: string; headings: string[] };

const ERROR_MESSAGES: Record<string, string> = {
  daily_cap_exceeded:
    "Eric is receiving too many letters today — please send again tomorrow.",
  disposable_email: "Please use a non-disposable address.",
  message_too_long: "The letter is over 500 characters — trim it a little.",
  message_required: "Write a few words first.",
  sender_name_required: "Add your name so Eric knows who wrote.",
  invalid_email: "That return address doesn't look right.",
  subject_required: "Pick a subject or write your own.",
  spam_detected: "Something looked automated — please try again.",
  user_not_found: "This page could not be found.",
};

const MAX_MESSAGE_LENGTH = 500;

export function AirmailLetter({ vanity }: { vanity: string }) {
  const [headings, setHeadings] = useState<Headings | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [replyNeeded, setReplyNeeded] = useState(false);
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"writing" | "stamping" | "sent" | "error">("writing");
  const [errorText, setErrorText] = useState("");
  const [postmarkDate, setPostmarkDate] = useState("");
  const stamped = useRef(false);

  // Load Eric's live headings so the letter offers what he actually wants.
  useEffect(() => {
    fetch(configUrl(vanity))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((cfg: { displayName: string; headings: string[] }) =>
        setHeadings({ displayName: cfg.displayName, headings: cfg.headings }),
      )
      .catch(() => setHeadings({ displayName: vanity, headings: [] }));
  }, [vanity]);

  const canSubmit =
    senderName.trim().length > 0 &&
    senderEmail.trim().length > 0 &&
    message.trim().length > 0 &&
    message.length <= MAX_MESSAGE_LENGTH &&
    (subject === "OTHER" ? customSubject.trim().length > 0 : subject !== "");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status !== "writing") return;

    // The postmark press: signature moment. Then the envelope departs.
    setStatus("stamping");
    setPostmarkDate(
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    );

    const body = new URLSearchParams({
      sender_name: senderName,
      sender_email: senderEmail,
      reply_needed: replyNeeded ? "yes" : "no",
      subject: subject === "OTHER" ? "OTHER" : subject,
      custom_subject: subject === "OTHER" ? customSubject : "",
      message,
      website: honeypot,
    });

    try {
      const res = await fetch(sendUrl(vanity), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorText(ERROR_MESSAGES[data.error ?? ""] ?? "Something went wrong — please try again.");
        setStatus("error");
        return;
      }
      // Ink dries, then the envelope departs.
      await new Promise((r) => setTimeout(r, 900));
      setStatus("sent");
    } catch {
      setErrorText("Network error — the letter didn't leave. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="airmail-sent" role="status">
        <div className="airmail-postmark sent-mark" aria-hidden="true">
          <span>SHORTMAIL POST</span>
          <span className="postmark-date">{postmarkDate}</span>
        </div>
        <p className="airmail-sent-line">
          Your letter left for {headings?.displayName ?? "Eric"}&rsquo;s desk.
        </p>
        <p className="airmail-sent-sub">
          500 characters or fewer. It will be read — that&rsquo;s the point.
        </p>
      </div>
    );
  }

  const subjectOptions =
    subject === "" && !headings ? [] : headings?.headings ?? [];

  return (
    <form className="airmail-letter" onSubmit={handleSend}>
      {/* honeypot */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="airmail-honeypot"
      />

      <p className="airmail-letterhead">
        Eric Ma &middot; eric.ma@nonlinearlabs.ai &middot; 500 characters. I
        read every one.
      </p>

      <p className="airmail-dear">Dear Eric,</p>

      <div className="airmail-fields">
        <div className="airmail-line airmail-line-name">
          <label className="sr-only" htmlFor="al-name">
            Your name
          </label>
          <input
            id="al-name"
            className="airmail-input"
            placeholder="Your name"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="airmail-line airmail-line-return">
          <label className="sr-only" htmlFor="al-email">
            Your email (return address)
          </label>
          <input
            id="al-email"
            className="airmail-input"
            type="email"
            placeholder="Your email — the return address"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="airmail-line airmail-line-subject">
          <label className="sr-only" htmlFor="al-subject">
            Subject — pick one of Eric&apos;s headings, or write your own
          </label>
          {headings === null ? (
            <input
              id="al-subject"
              className="airmail-input"
              placeholder="Subject…"
              value={subject === "OTHER" ? customSubject : subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          ) : (
            <select
              id="al-subject"
              className="airmail-input airmail-select"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            >
              <option value="" disabled>
                Subject — pick one of Eric&rsquo;s headings
              </option>
              {subjectOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
              <option value="OTHER">Something else…</option>
            </select>
          )}
          {subject === "OTHER" && (
            <input
              className="airmail-input airmail-other"
              placeholder="Your own subject"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              required
            />
          )}
        </div>

        <div className="airmail-line airmail-line-body">
          <label className="sr-only" htmlFor="al-message">
            Your message (500 characters max)
          </label>
          <textarea
            id="al-message"
            className="airmail-input airmail-message"
            placeholder="Write your short letter…"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH + 1))}
            rows={5}
            required
          />
          <span
            className={`airmail-counter${message.length > MAX_MESSAGE_LENGTH ? " over" : ""}`}
          >
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>

        <label className="airmail-reply">
          <input
            type="checkbox"
            checked={replyNeeded}
            onChange={(e) => setReplyNeeded(e.target.checked)}
          />
          I&rsquo;d like a reply
        </label>
      </div>

      {errorText && (
        <p className="airmail-error" role="alert">
          {errorText}
        </p>
      )}

      <div className="airmail-foot">
        <button
          type="submit"
          className="airmail-send"
          disabled={status === "stamping" || !canSubmit}
        >
          {status === "stamping" ? "Stamping…" : "Send this letter"}
        </button>
        <span className="airmail-note">No account. No storage. Just mail.</span>
      </div>

      {status === "stamping" && (
        <div className="airmail-postmark" aria-hidden="true">
          <span>SHORTMAIL POST</span>
          <span className="postmark-date">{postmarkDate}</span>
        </div>
      )}
    </form>
  );
}
