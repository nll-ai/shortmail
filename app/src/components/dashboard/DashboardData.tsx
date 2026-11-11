"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { dispatchWidgetChange } from "../../widget/liveUpdates";
import Link from "next/link";
import Script from "next/script";
import { api } from "../../../convex/_generated/api";
import { useMe } from "../useMe";
import type { Id } from "../../../convex/_generated/dataModel";
import { controlClass, fieldClass } from "@/theme/controls";
import { FaqRows, HeadingRows } from "./ReorderRows";
import { previewSnapshot, previewSnapshotKey } from "./previewSnapshot";
import { useServerOrder } from "./useServerOrder";

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
    case "NOT_FOUND":
      return "That item is no longer on your list. Refresh and try again.";
    default:
      return "Something went wrong — please try again.";
  }
}

const inputClass = fieldClass;
const buttonClass = controlClass;

export function DashboardData() {
  const { me, provisioning } = useMe();
  const headings = useQuery(api.forms.myHeadings);
  const faqs = useQuery(api.forms.myFaqs);
  const theme = useQuery(api.theming.myTheme);
  const headingsShown = useRef<readonly { heading: string }[] | null>(null);
  const faqsShown = useRef<readonly { question: string; answer: string }[] | null>(null);
  const ready = me != null && headings !== undefined && faqs !== undefined;
  const previewKey = ready
    ? previewSnapshotKey(
        previewSnapshot({
          displayName: me.displayName,
          email: me.email,
          headings,
          faqs,
          theme,
        }),
      )
    : "";

  useEffect(() => {
    if (!ready || me == null || headings === undefined || faqs === undefined) return;
    // Lists published by the sections include an in-flight reorder. The
    // server lists are the fallback on the first paint, before those
    // sections have rendered.
    const snapshot = previewSnapshot({
      displayName: me.displayName,
      email: me.email,
      headings: headingsShown.current ?? headings,
      faqs: faqsShown.current ?? faqs,
      theme,
    });
    dispatchWidgetChange({ kind: "snapshot", ...snapshot });
  }, [previewKey, ready, me, headings, faqs, theme]);

  if (me === undefined || me === null || headings === undefined || faqs === undefined) {
    return <p className="mt-4 text-sm text-muted">Loading your data…</p>;
  }
  if (me === null) {
    return (
      <p className="mt-4 text-sm text-danger">
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
          shownRef={headingsShown}
        />

        <FaqsSection
          isPaid={me.isPaid}
          faqs={faqs.map((f) => ({
            id: f._id,
            question: f.question,
            answer: f.answer,
          }))}
          shownRef={faqsShown}
        />

        <DisplayNameSection current={me.displayName ?? ""} />
      </div>

      <div className="self-start space-y-4 lg:sticky lg:top-6">
        <p className="text-xs uppercase tracking-wide text-muted">
          Live preview — what your visitors see
        </p>
        <div className="border border-line bg-background p-6">
          {/* widget.js registers <shortmail-widget>. Without it the box stays empty. */}
          <Script src="/widget.js" strategy="afterInteractive" />
          <shortmail-widget vanity={me.vanityName} />
        </div>
        <div className=" border p-4 text-sm space-y-2">
          <p className="font-medium text-sm">Premium tools</p>
          <Link href="/analytics" className="block text-link hover:underline text-sm">
            Analytics →
          </Link>
          <Link
            href="/dashboard/theming"
            className="block text-link hover:underline text-sm"
          >
            Theming →
          </Link>
          <Link
            href="/dashboard/embed"
            className="block text-link hover:underline text-sm"
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
      <p className="mt-2 text-xs text-muted">
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
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

function HeadingsSection({
  isPaid,
  headings,
  shownRef,
}: {
  isPaid: boolean;
  headings: { id: Id<"subjectHeadings">; heading: string }[];
  shownRef: { current: readonly { heading: string }[] | null };
}) {
  const addSubjectHeading = useMutation(api.forms.addSubjectHeading);
  const removeSubjectHeading = useMutation(api.forms.removeSubjectHeading);
  const reorderSubjectHeadings = useMutation(api.forms.reorderSubjectHeadings);
  const [heading, setHeading] = useState("");
  const [error, setError] = useState("");
  const order = useServerOrder(headings);
  // Child effects run before the parent's snapshot effect, so this ref is
  // the list on screen — including an in-flight reorder — when that runs.
  useEffect(() => {
    shownRef.current = order.shown;
  });

  const atLimit = !isPaid && headings.length >= FREE_HEADING_LIMIT;

  async function commit(next: readonly { id: Id<"subjectHeadings">; heading: string }[]) {
    const token = order.begin(next);
    dispatchWidgetChange({
      kind: "headings-reordered",
      headings: next.map((item) => item.heading),
    });
    setError("");
    try {
      await reorderSubjectHeadings({ ids: next.map((item) => item.id) });
    } catch (err) {
      order.fail(token);
      dispatchWidgetChange({
        kind: "headings-reordered",
        headings: headings.map((item) => item.heading),
      });
      setError(friendlyError(err));
    }
  }

  return (
    <section className=" border p-4 text-sm">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]">Subject headings</h2>
      <HeadingRows
        headings={order.shown}
        onReorder={(next) => {
          void commit(next);
        }}
        onRemove={(item) => {
          setError("");
          void removeSubjectHeading({ id: item.id })
            .then(() => {
              dispatchWidgetChange({ kind: "heading-removed", heading: item.heading });
            })
            .catch((err: unknown) => {
              setError(friendlyError(err));
            });
        }}
      />
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
        <p className="mt-2 text-xs text-muted">
          Free accounts are limited to {FREE_HEADING_LIMIT} headings — go paid
          for unlimited.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}

function FaqsSection({
  isPaid,
  faqs,
  shownRef,
}: {
  isPaid: boolean;
  faqs: { id: Id<"faqs">; question: string; answer: string }[];
  shownRef: { current: readonly { question: string; answer: string }[] | null };
}) {
  const addFaq = useMutation(api.forms.addFaq);
  const editFaq = useMutation(api.forms.editFaq);
  const removeFaq = useMutation(api.forms.removeFaq);
  const reorderFaqs = useMutation(api.forms.reorderFaqs);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState<Id<"faqs"> | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [error, setError] = useState("");
  const order = useServerOrder(faqs);
  useEffect(() => {
    shownRef.current = order.shown;
  });

  const atLimit = !isPaid && faqs.length >= FREE_FAQ_LIMIT;
  const editing = faqs.find((faq) => faq.id === editingId) ?? null;

  async function commit(
    next: readonly { id: Id<"faqs">; question: string; answer: string }[],
  ) {
    const token = order.begin(next);
    dispatchWidgetChange({
      kind: "faqs-reordered",
      faqs: next.map((item) => ({ question: item.question, answer: item.answer })),
    });
    setError("");
    try {
      await reorderFaqs({ ids: next.map((item) => item.id) });
    } catch (err) {
      order.fail(token);
      dispatchWidgetChange({
        kind: "faqs-reordered",
        faqs: faqs.map((item) => ({ question: item.question, answer: item.answer })),
      });
      setError(friendlyError(err));
    }
  }

  return (
    <section className=" border p-4 text-sm">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]">FAQs</h2>
      <FaqRows
        faqs={order.shown}
        editingId={editingId}
        onReorder={(next) => {
          void commit(next);
        }}
        onEdit={(faq) => {
          setEditingId(faq.id);
          setEditQuestion(faq.question);
          setEditAnswer(faq.answer);
        }}
        onRemove={(faq) => {
          setError("");
          void removeFaq({ id: faq.id })
            .then(() => {
              dispatchWidgetChange({ kind: "faq-removed", question: faq.question });
            })
            .catch((err: unknown) => {
              setError(friendlyError(err));
            });
        }}
        editor={
          <>
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
                  if (!editing) return;
                  setError("");
                  try {
                    await editFaq({
                      id: editing.id,
                      question: editQuestion,
                      answer: editAnswer,
                    });
                    dispatchWidgetChange({
                      kind: "faq-edited",
                      previousQuestion: editing.question,
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
                className="text-xs text-muted hover:underline"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
            </div>
          </>
        }
      />
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
        <p className="mt-2 text-xs text-muted">
          Free accounts are limited to {FREE_FAQ_LIMIT} FAQs — go paid for
          unlimited.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
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
      <p className="mb-2 text-xs text-muted">
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
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}
