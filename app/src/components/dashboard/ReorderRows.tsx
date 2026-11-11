"use client";

import type { ReactNode } from "react";
import { focusClass } from "../../theme/controls";
import { moveDisabled } from "../../../convex/lib/order";

const moveClass = [
  "inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center px-1 text-xs text-link",
  "enabled:hover:underline disabled:cursor-not-allowed disabled:text-muted",
  focusClass,
].join(" ");

const removeClass = `inline-flex min-h-11 touch-manipulation items-center px-2 text-xs text-danger enabled:hover:underline ${focusClass}`;
const editClass = `inline-flex min-h-11 touch-manipulation items-center px-2 text-xs text-link enabled:hover:underline ${focusClass}`;

/**
 * Up and down controls for one row. Disabled at the ends of the list.
 *
 * :param label: The row's visible name, used in the accessible name.
 * :param index: Zero-based place in the current list.
 * :param count: How many rows are shown.
 * :param onMove: Called with -1 for up and 1 for down.
 */
export function ReorderButtons({
  label,
  index,
  count,
  onMove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
}) {
  const ends = moveDisabled(index, count);
  return (
    <span className="flex shrink-0" role="group" aria-label={`Reorder ${label}`}>
      <button
        type="button"
        className={moveClass}
        aria-label={`Move ${label} up`}
        disabled={ends.up}
        onClick={() => onMove(-1)}
      >
        up
      </button>
      <button
        type="button"
        className={moveClass}
        aria-label={`Move ${label} down`}
        disabled={ends.down}
        onClick={() => onMove(1)}
      >
        down
      </button>
    </span>
  );
}

export function HeadingRows<Id extends string>({
  headings,
  onMove,
  onRemove,
}: {
  headings: readonly { id: Id; heading: string }[];
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (heading: { id: Id; heading: string }) => void;
}) {
  return (
    <ul className="mb-3 space-y-1" data-list="headings">
      {headings.length === 0 && <li className="text-muted">No subject headings yet.</li>}
      {headings.map((heading, index) => (
        <li key={heading.id} className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 break-words" data-label>
            {heading.heading}
          </span>
          <span className="flex shrink-0 items-center">
            <ReorderButtons
              label={heading.heading}
              index={index}
              count={headings.length}
              onMove={(delta) => onMove(index, delta)}
            />
            <button
              type="button"
              className={removeClass}
              onClick={() => onRemove(heading)}
            >
              remove
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function FaqRows<Id extends string>({
  faqs,
  onMove,
  onEdit,
  onRemove,
  editingId,
  editor,
}: {
  faqs: readonly { id: Id; question: string; answer: string }[];
  onMove: (index: number, delta: -1 | 1) => void;
  onEdit?: (faq: { id: Id; question: string; answer: string }) => void;
  onRemove: (faq: { id: Id; question: string; answer: string }) => void;
  editingId?: Id | null;
  editor?: ReactNode;
}) {
  return (
    <ul className="mb-3 space-y-3" data-list="faqs">
      {faqs.length === 0 && <li className="text-muted">No FAQs yet.</li>}
      {faqs.map((faq, index) =>
        editingId === faq.id ? (
          <li key={faq.id} className="space-y-2 border p-3">
            {editor}
          </li>
        ) : (
          <li key={faq.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 break-words font-medium" data-label>
                {faq.question}
              </span>
              <span className="flex shrink-0 items-center">
                <ReorderButtons
                  label={faq.question}
                  index={index}
                  count={faqs.length}
                  onMove={(delta) => onMove(index, delta)}
                />
                {onEdit && (
                  <button type="button" className={editClass} onClick={() => onEdit(faq)}>
                    edit
                  </button>
                )}
                <button type="button" className={removeClass} onClick={() => onRemove(faq)}>
                  remove
                </button>
              </span>
            </div>
            <p className="whitespace-pre-wrap text-muted">{faq.answer}</p>
          </li>
        ),
      )}
    </ul>
  );
}
