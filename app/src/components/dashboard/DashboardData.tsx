"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { dispatchWidgetChange } from "../../widget/liveUpdates";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { useMe } from "../useMe";
import type { Id } from "../../../convex/_generated/dataModel";

const FREE_HEADING_LIMIT = 5;
const FREE_FAQ_LIMIT = 3;

function errorCode(e: unknown): string | null {
  // Convex mutations throw ConvexError; the code arrives as `error.data`.
  if (e instanceof Error && "data" in e) {
    const data = (e as { data?: unknown }).data;
    if (typeof data === "string") return data;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return msg || null;
}

function friendlyError(e: unknown): string {
  switch (errorCode(e)) {
    case "FREE_LIMIT_REACHED":
      return "Free accounts have reached their limit — upgrade to add more.";
    case "vanity_taken":
      return "That vanity name is already taken. Please choose another.";
    case "vanity_invalid":
      return "Vanity names can use lowercase letters, numbers, dashes and underscores only.";
    case "PREMIUM_REQUIRED":
      return "This setting requires a paid account.";
    default:
      return "Something went wrong — please try again.";
  }
}

const inputClass =
  "w-full  border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none";
const buttonClass =
  " border border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40";

export function DashboardData() {
  const { me, provisioning } = useMe();
  const headings = useQuery(api.forms.myHeadings);
  const faqs = useQuery(api.forms.myFaqs);

  if (me === undefined || me === null || headings === undefined || faqs === undefined) {
    return <p className="mt-4 text-sm text-gray-400">Loading your data…</p>;
  }
  if (me === null) {
    return (
      <p className="mt-4 text-sm text-red-500">
        Convex identity: unauthenticated.
      </p>
    );
  }

  return (
    // Two columns (Eric's design feedback): configuration left, live
    // preview right (sticky). Stacks on small screens.
    <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-8 min-w-0">
        <section className=" border p-4 text-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]">Your send page</h2>
          <p>
            Visitors write to you at{" "}
            <Link
              href={`/send/${me.vanityName}`}
              className="font-mono underline"
            >
              /send/{me.vanityName}
            </Link>
          </p>
          <VanityControls isPaid={me.isPaid} current={me.vanityName} />
        </section>

        <HeadingsSection
          isPaid={me.isPaid}
          headings={headings.map((h) => ({ id: h._id, heading: h.heading }))}
        />

        <FaqsSection
          isPaid={me.isPaid}
          faqs={faqs.map((f) => ({
            id: f._id,
            question: f.question,
            answer: f.answer,
          }))}
        />

        <DisplayNameSection current={me.displayName ?? ""} />
      </div>

      <div className="self-start space-y-4 lg:sticky lg:top-6">
        <p className="text-xs uppercase tracking-wide text-gray-500">
          Live preview — what your visitors see
        </p>
        <div className="border border-neutral-300 bg-white p-6">
          <shortmail-widget vanity={me.vanityName} />
        </div>
        <div className=" border p-4 text-sm space-y-2">
          <p className="font-medium text-sm">Premium tools</p>
          <Link href="/analytics" className="block text-blue-600 hover:underline text-sm">
            Analytics →
          </Link>
          <Link
            href="/dashboard/theming"
            className="block text-blue-600 hover:underline text-sm"
          >
            Theming →
          </Link>
          <Link
            href="/dashboard/embed"
            className="block text-blue-600 hover:underline text-sm"
          >
            Embed →
          </Link>
        </div>
      </div>
    </div>
  );
}

function VanityControls({
  isPaid,
  current,
}: {
  isPaid: boolean;
  current: string;
}) {
  const updateVanityName = useMutation(api.forms.updateVanityName);
  const [vanity, setVanity] = useState("");
  const [error, setError] = useState("");

  if (!isPaid) {
    return (
      <p className="mt-2 text-xs text-gray-500">
        Custom vanity names are a paid-account feature — your vanity stays{" "}
        <code>{current}</code>.
      </p>
    );
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await updateVanityName({ vanityName: vanity });
          setVanity("");
        } catch (err) {
          setError(friendlyError(err));
        }
      }}
    >
      <input
        className={inputClass}
        placeholder="New vanity name"
        value={vanity}
        onChange={(e) => setVanity(e.target.value)}
      />
      <button type="submit" className={buttonClass}>
        Rename
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

function HeadingsSection({
  isPaid,
  headings,
}: {
  isPaid: boolean;
  headings: { id: Id<"subjectHeadings">; heading: string }[];
}) {
  const addSubjectHeading = useMutation(api.forms.addSubjectHeading);
  const removeSubjectHeading = useMutation(api.forms.removeSubjectHeading);
  const [heading, setHeading] = useState("");
  const [error, setError] = useState("");

  const atLimit = !isPaid && headings.length >= FREE_HEADING_LIMIT;

  return (
    <section className=" border p-4 text-sm">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]">Subject headings</h2>
      <ul className="mb-3 space-y-1">
        {headings.length === 0 && (
          <li className="text-gray-500">No subject headings yet.</li>
        )}
        {headings.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2">
            <span>{h.heading}</span>
            <button
              type="button"
              className="text-xs text-red-600 hover:underline"
              onClick={async () => {
                setError("");
                try {
                  await removeSubjectHeading({
                    id: h.id,
                  });
                  dispatchWidgetChange({ kind: "heading-removed", heading: h.heading });
                } catch (err) {
                  setError(friendlyError(err));
                }
              }}
            >
              remove
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await addSubjectHeading({ heading });
            dispatchWidgetChange({ kind: "heading-added", heading });
            setHeading("");
          } catch (err) {
            setError(friendlyError(err));
          }
        }}
      >
        <input
          className={inputClass}
          placeholder="New subject heading"
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          disabled={atLimit}
        />
        <button type="submit" className={buttonClass} disabled={atLimit}>
          Add
        </button>
      </form>
      {atLimit && (
        <p className="mt-2 text-xs text-gray-500">
          Free accounts are limited to {FREE_HEADING_LIMIT} headings — go paid
          for unlimited.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}

function FaqsSection({
  isPaid,
  faqs,
}: {
  isPaid: boolean;
  faqs: { id: Id<"faqs">; question: string; answer: string }[];
}) {
  const addFaq = useMutation(api.forms.addFaq);
  const editFaq = useMutation(api.forms.editFaq);
  const removeFaq = useMutation(api.forms.removeFaq);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState<Id<"faqs"> | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [error, setError] = useState("");

  const atLimit = !isPaid && faqs.length >= FREE_FAQ_LIMIT;

  return (
    <section className=" border p-4 text-sm">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]">FAQs</h2>
      <ul className="mb-3 space-y-3">
        {faqs.length === 0 && (
          <li className="text-gray-500">No FAQs yet.</li>
        )}
        {faqs.map((f) =>
          editingId === f.id ? (
            <li key={f.id} className="space-y-2  border p-3">
              <input
                className={inputClass}
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
              />
              <textarea
                className={`${inputClass} min-h-20`}
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  onClick={async () => {
                    setError("");
                    try {
                      await editFaq({
                        id: f.id,
                        question: editQuestion,
                        answer: editAnswer,
                      });
                      dispatchWidgetChange({
                        kind: "faq-edited",
                        question: editQuestion,
                        answer: editAnswer,
                      });
                      setEditingId(null);
                    } catch (err) {
                      setError(friendlyError(err));
                    }
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:underline"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
              </div>
            </li>
          ) : (
            <li key={f.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{f.question}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => {
                      setEditingId(f.id);
                      setEditQuestion(f.question);
                      setEditAnswer(f.answer);
                    }}
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={async () => {
                      setError("");
                      try {
                        await removeFaq({ id: f.id });
                        dispatchWidgetChange({
                        kind: "faq-edited",
                        question: editQuestion,
                        answer: editAnswer,
                      });
                      } catch (err) {
                        setError(friendlyError(err));
                      }
                    }}
                  >
                    remove
                  </button>
                </span>
              </div>
              <p className="whitespace-pre-wrap text-gray-600">{f.answer}</p>
            </li>
          ),
        )}
      </ul>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await addFaq({ question, answer });
            dispatchWidgetChange({ kind: "faq-added", question, answer });
            setQuestion("");
            setAnswer("");
          } catch (err) {
            setError(friendlyError(err));
          }
        }}
      >
        <input
          className={inputClass}
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={atLimit}
        />
        <textarea
          className={`${inputClass} min-h-20`}
          placeholder="Answer (markdown allowed)"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={atLimit}
        />
        <button type="submit" className={buttonClass} disabled={atLimit}>
          Add FAQ
        </button>
      </form>
      {atLimit && (
        <p className="mt-2 text-xs text-gray-500">
          Free accounts are limited to {FREE_FAQ_LIMIT} FAQs — go paid for
          unlimited.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}

function DisplayNameSection({ current }: { current: string }) {
  const updateDisplayName = useMutation(api.forms.updateDisplayName);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  return (
    <section className=" border p-4 text-sm">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]">Display name</h2>
      <p className="mb-2 text-xs text-gray-500">
        Shown on your send page. Currently:{" "}
        <code>{current || "(your email)"}</code>
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await updateDisplayName({ displayName });
            dispatchWidgetChange({ kind: "display-name", value: displayName });
            setDisplayName("");
          } catch (err) {
            setError(friendlyError(err));
          }
        }}
      >
        <input
          className={inputClass}
          placeholder="New display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <button type="submit" className={buttonClass}>
          Update
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
