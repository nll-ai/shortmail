"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { EmbedConfig } from "../widget/config";
import { collectUrl, sendUrl } from "../widget/api";


const MAX_MESSAGE_LENGTH = 500;

const ERROR_MESSAGES: Record<string, string> = {
  user_not_found: "This shortmail address does not exist.",
  message_too_long: "Message exceeds 500 characters.",
  message_required: "Please write a message.",
  sender_name_required: "Please add your name.",
  subject_required: "Please pick or write a subject.",
  invalid_email: "Please enter a valid email address.",
  disposable_email: "Disposable email addresses are not allowed.",
  spam_detected: "Submission rejected.",
  daily_cap_exceeded:
    "This person is receiving too many messages today — please try again tomorrow.",
};

type Status = "idle" | "submitting" | "sent" | "error";

export function SendForm({
  config,
  themeVars,
}: {
  config: EmbedConfig;
  themeVars?: CSSProperties;
}) {
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  // Legacy parity: "no" is the checked default (send_shortmail.html).
  const [replyNeeded, setReplyNeeded] = useState("no");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — must stay empty
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");

  // Analytics: one form_view beacon per mount (P4). Honors Do Not Track and
  // never blocks rendering — fire-and-forget, collector answers 204.
  const beaconSent = useRef(false);
  useEffect(() => {
    if (beaconSent.current) return;
    beaconSent.current = true;
    const dnt =
      navigator.doNotTrack === "1" ||
      (window as { doNotTrack?: string }).doNotTrack === "1";
    if (dnt) return;
    try {
      const payload = JSON.stringify({
        event: "form_view",
        path: `/send/${config.vanityName}`,
        ref: document.referrer || undefined,
      });
      const url = collectUrl(config.vanityName);
      const delivered =
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon(url, payload);
      if (!delivered) {
        void fetch(url, {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "text/plain" },
          body: payload,
        }).catch(() => undefined);
      }
    } catch {
      // analytics must never break the form
    }
  }, [config.vanityName]);

  const messageTooLong = message.length > MAX_MESSAGE_LENGTH;
  const canSubmit =
    !messageTooLong &&
    message.trim().length > 0 &&
    senderName.trim().length > 0 &&
    senderEmail.trim().length > 0 &&
    (subject === "OTHER" ? customSubject.trim().length > 0 : subject !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "submitting") return;

    setStatus("submitting");
    setErrorText("");

    const body = new URLSearchParams({
      sender_name: senderName,
      sender_email: senderEmail,
      reply_needed: replyNeeded,
      subject,
      custom_subject: customSubject,
      message,
      website, // honeypot
    });

    try {
      const res = await fetch(
        sendUrl(config.vanityName),
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        },
      );
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
      <div className="rounded-lg border border-green-300 bg-green-50 p-6 text-center">
        <p className="text-lg font-medium text-green-900">
          Message sent to {config.displayName}!
        </p>
        <p className="mt-1 text-sm text-green-800">
          It lands in their inbox as a plain, short email.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-[var(--sm-radius,0.5rem)] border border-[var(--sm-border,#d1d5db)] bg-[var(--sm-surface,#ffffff)] text-[var(--sm-text,#111111)] px-3 py-2 text-sm focus:border-[var(--sm-accent,#111111)] focus:outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-[var(--sm-radius,0.75rem)] bg-[var(--sm-bg,#ffffff)] p-1 text-[var(--sm-text,#111111)]"
      style={themeVars}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--sm-text,#111111)]">Your name</span>
          <input
            className={inputClass}
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--sm-text,#111111)]">Your email</span>
          <input
            className={inputClass}
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            required
          />
        </label>
      </div>

      <fieldset className="text-sm">
        <legend className="mb-1 block font-medium">
          Do you need a reply?
        </legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="reply_needed"
              value="yes"
              checked={replyNeeded === "yes"}
              onChange={(e) => setReplyNeeded(e.target.value)}
            />
            Yes
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="reply_needed"
              value="no"
              checked={replyNeeded === "no"}
              onChange={(e) => setReplyNeeded(e.target.value)}
            />
            No
          </label>
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Subject</span>
        <select
          className={inputClass}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        >
          <option value="" disabled>
            Pick a subject…
          </option>
          {config.headings.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
          <option value="OTHER">Other…</option>
        </select>
      </label>
      {subject === "OTHER" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Your subject</span>
          <input
            className={inputClass}
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            maxLength={200}
            required
          />
        </label>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Message</span>
        <textarea
          className={`${inputClass} min-h-32`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          required
        />
        <span
          className={`mt-1 block text-right text-xs ${
            messageTooLong ? "text-red-600" : "text-gray-500"
          }`}
        >
          {message.length}/{MAX_MESSAGE_LENGTH}
        </span>
      </label>

      {/* Honeypot: hidden from humans, bots fill it and get rejected. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      {status === "error" && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || status === "submitting"}
        className="w-full rounded-full bg-[var(--sm-accent,#111111)] px-6 py-2 text-sm font-medium text-[var(--sm-accent-text,#ffffff)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "submitting" ? "Sending…" : "Send shortmail"}
      </button>
    </form>
  );
}
