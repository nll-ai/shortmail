import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FaqRows, HeadingRows } from "../src/components/dashboard/ReorderRows";

type Heading = { id: string; heading: string };
type Faq = { id: string; question: string; answer: string };
type Lists = { headings: Heading[]; faqs: Faq[] };

/**
 * Dashboard reorder controls backed by the fixture server.
 * A reload reads the order the server stored.
 */
function Harness() {
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/__lists")
      .then((res) => res.json())
      .then((data: Lists) => setLists(data));
  }, []);

  async function reorder(table: "headings" | "faqs", ids: string[]) {
    const res = await fetch("/__reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, ids }),
    });
    if (!res.ok) throw new Error("reorder failed");
    const data = (await res.json()) as Lists;
    setLists((current) => {
      if (!current) return data;
      return table === "headings"
        ? { ...current, headings: data.headings }
        : { ...current, faqs: data.faqs };
    });
  }

  if (!lists) return <p className="mt-4 text-sm text-muted">Loading your data…</p>;

  return (
    <main className="mx-auto min-h-svh max-w-6xl bg-background p-4 text-sm text-foreground sm:p-8">
      <h1 className="text-2xl font-bold">ShortMail Dashboard</h1>
      <p className="mt-2">Fixture owner. This page is not signed in.</p>
      <div className="mt-6 space-y-8">
        <section className="border p-4 text-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]">Subject headings</h2>
          <HeadingRows
            headings={lists.headings}
            onReorder={(next) => {
              const headings = [...next];
              setLists({ ...lists, headings });
              void reorder(
                "headings",
                headings.map((item) => item.id),
              ).catch(() => setError("Something went wrong — please try again."));
            }}
            onRemove={() => undefined}
          />
        </section>
        <section className="border p-4 text-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]">FAQs</h2>
          <FaqRows
            faqs={lists.faqs}
            onReorder={(next) => {
              const faqs = [...next];
              setLists({ ...lists, faqs });
              void reorder(
                "faqs",
                faqs.map((item) => item.id),
              ).catch(() => setError("Something went wrong — please try again."));
            }}
            onEdit={() => undefined}
            onRemove={() => undefined}
          />
        </section>
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </main>
  );
}

const root = document.getElementById("reorder-root");
if (root) createRoot(root).render(<Harness />);
