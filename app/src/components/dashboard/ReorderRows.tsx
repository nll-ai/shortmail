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
import { focusClass } from "../../theme/controls";

const handleClass = [
  "inline-flex h-11 w-11 shrink-0 touch-none cursor-grab items-center justify-center text-muted",
  "active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40",
  focusClass,
].join(" ");

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

type KeySensor = {
  props: {
    active: unknown;
    context: { current: { collisionRect: { left: number; top: number; height: number } | null } };
    options: {
      keyboardCodes?: { end: string[]; cancel: string[] };
      coordinateGetter?: (
        event: KeyboardEvent,
        args: {
          active: unknown;
          context: unknown;
          currentCoordinates: { x: number; y: number };
        },
      ) => { x: number; y: number } | undefined;
    };
  };
  referenceCoordinates: { x: number; y: number } | undefined;
  handleEnd: (event: Event) => void;
  handleCancel: (event: Event) => void;
  handleMove: (event: Event, coordinates: { x: number; y: number }) => void;
};

/**
 * Arrow keys move the lifted row. The stock sensor spends those keys on
 * scrolling the page first, so a phone-length dashboard never reaches the
 * next row. The stock method is private, so this replaces it on the subclass.
 */
class QuietKeyboardSensor extends KeyboardSensor {}

(QuietKeyboardSensor.prototype as unknown as { handleKeyDown: (event: KeyboardEvent) => void }).handleKeyDown =
  function (this: KeySensor, event: KeyboardEvent) {
    const { active, context, options } = this.props;
    const keyboardCodes = options.keyboardCodes ?? {
      end: ["Space", "Enter", "Tab"],
      cancel: ["Escape"],
    };
    if (keyboardCodes.end.includes(event.code)) {
      this.handleEnd(event);
      return;
    }
    if (keyboardCodes.cancel.includes(event.code)) {
      this.handleCancel(event);
      return;
    }
    const rect = context.current.collisionRect;
    const currentCoordinates = rect ? { x: rect.left, y: rect.top } : { x: 0, y: 0 };
    if (!this.referenceCoordinates) this.referenceCoordinates = currentCoordinates;
    const next = options.coordinateGetter?.(event, {
      active,
      context: context.current,
      currentCoordinates,
    });
    if (!next || !this.referenceCoordinates) return;
    const dy = next.y - this.referenceCoordinates.y;
    // closestCenter uses the row's middle. Tall FAQ rows need an extra
    // nudge or the middle stays on the row that was picked up.
    const nudge = dy > 8 ? (rect?.height ?? 0) : dy < -8 ? -(rect?.height ?? 0) : 0;
    this.handleMove(event, {
      x: next.x - this.referenceCoordinates.x,
      y: dy + nudge,
    });
  };

function useReorderSensors() {
  return useSensors(
    useSensor(QuietMouseSensor, { activationConstraint: { distance: 6 } }),
    // No press-and-hold. Touch starts immediately; the handle's touch-action
    // and dnd-kit's non-passive touchmove listener keep the page from scrolling.
    useSensor(QuietTouchSensor),
    useSensor(QuietKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
  disabled,
  children,
}: {
  id: string;
  label: string;
  disabled?: boolean;
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
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </li>
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
          {items.map((item) => (
            <SortableRow
              key={item.id}
              id={item.id}
              label={labelFor(item)}
              disabled={disabled?.(item)}
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
