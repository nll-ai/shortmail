"use client";

import { useEffect, useState } from "react";
import { configUrl, sendUrl } from "../widget/api";
import { adoptFormSkinDocument } from "../widget/formSkin";

const MAX_MESSAGE_LENGTH = 500;
const OWNER_VANITY = "cce87ae9c1d7";

const ERROR_MESSAGES: Record<string, string> = {
  daily_cap_exceeded:
    "Eric is receiving too many letters today — please try again tomorrow.",
  disposable_email: "Please use a non-disposable address.",
  message_too_long: "The letter is over 500 characters — trim it a little.",
  message_required: "Write a few words first.",
  sender_name_required: "Add your name so Eric knows who wrote.",
  invalid_email: "That return address doesn't look right.",
  subject_required: "Pick a subject or write your own.",
  spam_detected: "Something looked automated — please try again.",
  user_not_found: "This page could not be found.",
};

type Status = "writing" | "sending" | "sent" | "error";

export function LandingLetter({ demo = false }: { demo?: boolean }) {
  const [headings, setHeadings] = useState<string[] | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [replyNeeded, setReplyNeeded] = useState(false);
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("writing");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    adoptFormSkinDocument();
    fetch(configUrl(OWNER_VANITY))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((cfg: { headings: string[] }) => setHeadings(cfg.headings))
      .catch(() => setHeadings([]));
  }, []);

  const canSubmit =
    senderName.trim().length > 0 &&
    senderEmail.trim().length > 0 &&
    message.trim().length > 0 &&
    message.length <= MAX_MESSAGE_LENGTH &&
    (subject === "OTHER" ? customSubject.trim().length > 0 : subject !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "sending") return;

    setStatus("sending");
    setErrorText("");

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
      const res = await fetch(sendUrl(OWNER_VANITY), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorText(
        (data.error && ERROR_MESSAGES[data.error]) ||
          "Something went wrong — please try again.",
      );
      setStatus("error");
    } catch {
      setErrorText("Network error — please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="border border-black p-8 text-center" role="status">
        <p className="text-lg font-bold">
          {demo ? "This is how it works." : "Letter sent."}
        </p>
        <p className="mt-2 text-sm text-gray-600">
          {demo
            ? "On a real ShortMail page, the letter departs as plain email — nothing is stored here."
            : "It lands in Eric's inbox as plain email — nothing is stored here."}
        </p>
        {demo && (
          <button
            onClick={() => setStatus("writing")}
            className="mt-3 text-xs text-gray-500 underline"
          >
            Reset the demo
          </button>
        )}
      </div>
    );
  }

  const inputClass = "sm-input";

  return (
    <form onSubmit={handleSubmit} className="sm-form">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="sm-label">
          <span className="sm-label-text">Your name</span>
          <input
            className={inputClass}
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label className="sm-label">
          <span className="sm-label-text">Your email</span>
          <input
            className={inputClass}
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
      </div>

      <fieldset className="sm-fieldset">
        <legend className="sm-label-text">
          Do you need a reply?
        </legend>
        <div className="sm-radio-row">
          <label className="sm-radio-label">
            <input
              type="radio"
              name="reply_needed"
              checked={!replyNeeded}
              onChange={() => setReplyNeeded(false)}
            />
            No
          </label>
          <label className="sm-radio-label">
            <input
              type="radio"
              name="reply_needed"
              checked={replyNeeded}
              onChange={() => setReplyNeeded(true)}
            />
            Yes
          </label>
        </div>
      </fieldset>

      <label className="sm-label">
        <span className="sm-label-text">Subject</span>
        {headings === null ? (
          <input
            className={inputClass}
            placeholder="Subject…"
            value={subject === "OTHER" ? customSubject : subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        ) : (
          <select
            className={inputClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          >
            <option value="" disabled>
              Pick one of Eric&rsquo;s headings…
            </option>
            {headings.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
            <option value="OTHER">Something else…</option>
          </select>
        )}
        {subject === "OTHER" && (
          <input
            className="sm-input sm-other"
            placeholder="Your own subject"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            required
          />
        )}
      </label>

      <label className="sm-label">
        <span className="sm-label-text">Your letter</span>
        <textarea
          className={inputClass}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH + 1))}
          placeholder="Short and specific beats long and vague."
          required
        />
        <span
          className={`sm-counter${message.length > MAX_MESSAGE_LENGTH ? " sm-counter-over" : ""}`}
        >
          {message.length}/{MAX_MESSAGE_LENGTH}
        </span>
      </label>

      {/* honeypot */}
      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sm-honeypot"
      />

      {errorText && (
        <p className="sm-error" role="alert">
          {errorText}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending" || !canSubmit}
        className="sm-button"
      >
        {status === "sending" ? "Sending…" : "Send the letter"}
      </button>
    </form>
  );
}
