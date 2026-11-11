"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveDisabled, moveItem } from "../../../convex/lib/order";
import { focusClass } from "../../theme/controls";

const handleClass = [
  "inline-flex h-11 w-11 shrink-0 touch-none cursor-grab items-center justify-center text-muted",
  "active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40",
  focusClass,
].join(" ");

const nudgeClass = `px-1 text-[11px] leading-none text-muted enabled:hover:underline disabled:cursor-not-allowed disabled:opacity-40 ${focusClass}`;
const removeClass = `inline-flex min-h-11 touch-manipulation items-center px-2 text-xs text-danger enabled:hover:underline ${focusClass}`;
const editClass = `inline-flex min-h-11 touch-manipulation items-center px-2 text-xs text-link enabled:hover:underline ${focusClass}`;

const overlayClass =
  "flex max-w-[18rem] items-center gap-2 border border-line bg-surface px-2 py-2 text-sm text-foreground";

/**
 * Two columns of three dots. The accessible name lives on the handle button.
 */
function GripIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true" className="pointer-events-none">
      {[2, 8].flatMap((x) =>
        [3, 9, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />),
      )}
    </svg>
  );
}

/**
 * dnd-kit cancels a drag on window `resize`. iOS Safari fires that while a
 * finger is down (the toolbar shows and hides), which would drop the row
 * back where it started. Skip that one listener for the life of the gesture.
 */
function ignoreResize(event: Event): (() => void) | null {
  const target = event.target;
  const view = target instanceof Node ? target.ownerDocument?.defaultView : null;
  if (!view) return null;
  const add = view.addEventListener.bind(view);
  view.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (type === "resize") return;
    add(type, listener, options);
  }) as typeof view.addEventListener;
  return () => {
    view.addEventListener = add;
  };
}

class QuietMouseSensor extends MouseSensor {
  constructor(props: ConstructorParameters<typeof MouseSensor>[0]) {
    const restore = ignoreResize(props.event);
    super(props);
    restore?.();
  }
}

class QuietTouchSensor extends TouchSensor {
  constructor(props: ConstructorParameters<typeof TouchSensor>[0]) {
    const restore = ignoreResize(props.event);
    super(props);
    restore?.();
  }
}

function useReorderSensors() {
  return useSensors(
    useSensor(QuietMouseSensor, { activationConstraint: { distance: 6 } }),
    // No press-and-hold. Touch starts immediately; the handle's touch-action
    // and dnd-kit's non-passive touchmove listener keep the page from scrolling.
    useSensor(QuietTouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function announcementsFor<T extends { id: string }>(
  items: readonly T[],
  labelFor: (item: T) => string,
) {
  const name = (id: UniqueIdentifier) => {
    const item = items.find((candidate) => candidate.id === id);
    return item ? labelFor(item) : "row";
  };
  const place = (id: UniqueIdentifier) => items.findIndex((candidate) => candidate.id === id) + 1;
  return {
    onDragStart({ active }: { active: { id: UniqueIdentifier } }) {
      return `Picked up ${name(active.id)}. Use the arrow keys to move it, space to drop, escape to cancel.`;
    },
    onDragOver({ active, over }: { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null }) {
      if (!over) return `${name(active.id)} is no longer over a row.`;
      return `${name(active.id)} is over position ${place(over.id)} of ${items.length}.`;
    },
    onDragEnd({ active, over }: { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null }) {
      if (!over || over.id === active.id) return `${name(active.id)} was dropped in its original place.`;
      return `${name(active.id)} was dropped at position ${place(over.id)} of ${items.length}.`;
    },
    onDragCancel({ active }: { active: { id: UniqueIdentifier } }) {
      return `Cancelled moving ${name(active.id)}.`;
    },
  };
}

function SortableRow({
  id,
  label,
  index,
  count,
  disabled,
  onNudge,
  children,
}: {
  id: string;
  label: string;
  index: number;
  count: number;
  disabled?: boolean;
  onNudge: (delta: -1 | 1) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={isOver && !isDragging ? "outline outline-2 outline-foreground" : undefined}
      data-over={isOver && !isDragging ? "true" : undefined}
    >
      <div className={`flex items-start gap-1 ${isDragging ? "opacity-40" : ""}`}>
        <DragHandle label={label} disabled={disabled} attributes={attributes} listeners={listeners} />
        <NudgeButtons label={label} index={index} count={count} disabled={disabled} onNudge={onNudge} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </li>
  );
}

function NudgeButtons({
  label,
  index,
  count,
  disabled,
  onNudge,
}: {
  label: string;
  index: number;
  count: number;
  disabled?: boolean;
  onNudge: (delta: -1 | 1) => void;
}) {
  const ends = moveDisabled(index, count);
  return (
    <span className="flex shrink-0 flex-col justify-center py-1">
      <button
        type="button"
        className={nudgeClass}
        aria-label={`Move ${label} up`}
        disabled={disabled || ends.up}
        onClick={() => onNudge(-1)}
      >
        up
      </button>
      <button
        type="button"
        className={nudgeClass}
        aria-label={`Move ${label} down`}
        disabled={disabled || ends.down}
        onClick={() => onNudge(1)}
      >
        down
      </button>
    </span>
  );
}

function DragHandle({
  label,
  disabled,
  attributes,
  listeners,
}: {
  label: string;
  disabled?: boolean;
  attributes: DraggableAttributes;
  listeners: ReturnType<typeof useSortable>["listeners"];
}) {
  return (
    <button
      type="button"
      className={handleClass}
      style={{ touchAction: "none" }}
      disabled={disabled}
      {...attributes}
      {...(disabled ? {} : listeners)}
      aria-label={`Drag to reorder ${label}`}
    >
      <GripIcon />
    </button>
  );
}

function SortableList<T extends { id: string }>({
  list,
  items,
  empty,
  labelFor,
  disabled,
  onReorder,
  children,
}: {
  list: "headings" | "faqs";
  items: readonly T[];
  empty: string;
  labelFor: (item: T) => string;
  disabled?: (item: T) => boolean;
  onReorder: (next: readonly T[]) => void;
  children: (item: T) => ReactNode;
}) {
  const sensors = useReorderSensors();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const active = items.find((item) => item.id === activeId);

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const from = items.findIndex((item) => item.id === dragged.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove([...items], from, to));
  }

  if (items.length === 0) {
    return (
      <ul className="mb-3 space-y-1" data-list={list}>
        <li className="text-muted">{empty}</li>
      </ul>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements: announcementsFor(items, labelFor),
        screenReaderInstructions: {
          draggable: `To pick up a row, press space on its drag handle. Use the up and down arrow keys to move it. Press space again to drop, or escape to cancel.`,
        },
      }}
      onDragStart={({ active: dragged }) => setActiveId(dragged.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className={list === "faqs" ? "mb-3 space-y-3" : "mb-3 space-y-1"} data-list={list}>
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              id={item.id}
              label={labelFor(item)}
              index={index}
              count={items.length}
              disabled={disabled?.(item)}
              onNudge={(delta) => {
                const next = moveItem(items, index, delta);
                if (next) onReorder(next);
              }}
            >
              {children(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
      <DragOverlay>
        {active ? (
          <div data-drag-overlay className={overlayClass}>
            <GripIcon />
            <span className="min-w-0 break-words">{labelFor(active)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function HeadingRows<Id extends string>({
  headings,
  onReorder,
  onRemove,
}: {
  headings: readonly { id: Id; heading: string }[];
  onReorder: (next: readonly { id: Id; heading: string }[]) => void;
  onRemove: (heading: { id: Id; heading: string }) => void;
}) {
  return (
    <SortableList
      list="headings"
      items={headings}
      empty="No subject headings yet."
      labelFor={(item) => item.heading}
      onReorder={onReorder}
    >
      {(heading) => (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 break-words" data-label>
            {heading.heading}
          </span>
          <button type="button" className={removeClass} onClick={() => onRemove(heading)}>
            remove
          </button>
        </div>
      )}
    </SortableList>
  );
}

export function FaqRows<Id extends string>({
  faqs,
  onReorder,
  onEdit,
  onRemove,
  editingId,
  editor,
}: {
  faqs: readonly { id: Id; question: string; answer: string }[];
  onReorder: (next: readonly { id: Id; question: string; answer: string }[]) => void;
  onEdit?: (faq: { id: Id; question: string; answer: string }) => void;
  onRemove: (faq: { id: Id; question: string; answer: string }) => void;
  editingId?: Id | null;
  editor?: ReactNode;
}) {
  return (
    <SortableList
      list="faqs"
      items={faqs}
      empty="No FAQs yet."
      labelFor={(item) => item.question}
      disabled={(item) => item.id === editingId}
      onReorder={onReorder}
    >
      {(faq) =>
        editingId === faq.id ? (
          <div className="space-y-2 border p-3">{editor}</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 break-words font-medium" data-label>
                {faq.question}
              </span>
              <span className="flex shrink-0 items-center">
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
          </>
        )
      }
    </SortableList>
  );
}
