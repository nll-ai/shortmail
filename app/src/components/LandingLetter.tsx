"use client";

import { useEffect, useState } from "react";
import { configUrl, sendUrl } from "../widget/api";

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

export function LandingLetter() {
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
        <p className="text-lg font-bold">Letter sent.</p>
        <p className="mt-2 text-sm text-gray-600">
          It lands in Eric&rsquo;s inbox as plain email — nothing is stored
          here.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Your name</span>
          <input
            className={inputClass}
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Your email</span>
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

      <fieldset className="text-sm">
        <legend className="mb-1 block font-medium">
          Do you need a reply?
        </legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="reply_needed"
              checked={!replyNeeded}
              onChange={() => setReplyNeeded(false)}
            />
            No
          </label>
          <label className="flex items-center gap-1.5">
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

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Subject</span>
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
            className={`${inputClass} mt-2`}
            placeholder="Your own subject"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            required
          />
        )}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Your letter</span>
        <textarea
          className={inputClass}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH + 1))}
          placeholder="Short and specific beats long and vague."
          required
        />
        <span
          className={`mt-1 block text-right text-xs ${
            message.length > MAX_MESSAGE_LENGTH ? "font-bold text-red-600" : "text-gray-500"
          }`}
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
        className="hidden"
      />

      {errorText && (
        <p className="text-sm text-red-600" role="alert">
          {errorText}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending" || !canSubmit}
        className="w-full bg-black px-6 py-2.5 text-sm font-medium text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "sending" ? "Sending…" : "Send the letter"}
      </button>
    </form>
  );
}
