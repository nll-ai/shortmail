"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

type PerDay = { day: string; views: number; sends: number };

const shortDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

/** Hand-rolled grouped bar chart (views vs sends) — no chart library. */
function Bars({ perDay }: { perDay: PerDay[] }) {
  const max = Math.max(1, ...perDay.map((d) => Math.max(d.views, d.sends)));
  const width = 720;
  const height = 180;
  const pad = 24;
  const group = (width - pad * 2) / Math.max(perDay.length, 1);
  const barWidth = Math.min(10, group / 2.6);

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 24}`}
      className="w-full"
      role="img"
      aria-label="Form views and sends per day"
    >
      {perDay.map((d, i) => {
        const x = pad + i * group;
        const vh = (d.views / max) * height;
        const sh = (d.sends / max) * height;
        return (
          <g key={d.day}>
            <rect
              x={x + group / 2 - barWidth - 1}
              y={height - vh}
              width={barWidth}
              height={vh}
              fill="#6366f1"
            >
              <title>{`${d.day}: ${d.views} views`}</title>
            </rect>
            <rect
              x={x + group / 2 + 1}
              y={height - sh}
              width={barWidth}
              height={sh}
              fill="#10b981"
            >
              <title>{`${d.day}: ${d.sends} sends`}</title>
            </rect>
            {i % Math.ceil(perDay.length / 8) === 0 && (
              <text
                x={x + group / 2}
                y={height + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#9ca3af"
              >
                {shortDay(d.day)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={pad} y1={height} x2={width - pad} y2={height} stroke="#e5e7eb" />
    </svg>
  );
}

export function AnalyticsDashboard() {
  const stats = useQuery(api.analytics.ownerStats, { days: 30 });

  if (stats === undefined) {
    return <p className="text-sm text-gray-400">Loading analytics…</p>;
  }

  if (stats.tier === "free") {
    return (
      <div className="mt-6  border border-indigo-200 bg-indigo-50 p-6">
        <h2 className="text-lg font-semibold">Analytics is a premium feature</h2>
        <p className="mt-2 text-sm text-gray-600">
          See who is contacting you, when, and what they care about: 30-day
          trends of form views and messages, your most popular subject
          headings, and how many people asked for a reply.
        </p>
        <a
          href="mailto:eric.ma@nonlinearlabs.ai?subject=ShortMail%20premium"
          className="mt-4 inline-block  bg-black px-5 py-2 text-sm text-white hover:opacity-80"
        >
          Upgrade to premium
        </a>
        <p className="mt-2 text-xs text-gray-500">
          (While billing is not yet wired up, ask an admin to toggle your
          account — the button records your interest.)
        </p>
      </div>
    );
  }

  const { totals, perDay, topSubjects, replyNeededRatio } = stats;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className=" border p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Views (30d)</p>
          <p className="text-2xl font-bold">{totals.views}</p>
        </div>
        <div className=" border p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Messages sent (30d)</p>
          <p className="text-2xl font-bold">{totals.sends}</p>
        </div>
        <div className=" border p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Wanted a reply</p>
          <p className="text-2xl font-bold">
            {replyNeededRatio === null
              ? "—"
              : `${Math.round(replyNeededRatio * 100)}%`}
          </p>
        </div>
      </div>

      <div className=" border p-4">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2  bg-indigo-500" /> views
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2  bg-emerald-500" /> sends
          </span>
          <span>last {stats.days} days</span>
        </div>
        <Bars perDay={perDay} />
      </div>

      <div className=" border p-4">
        <h3 className="text-sm font-semibold">Most popular subject headings</h3>
        {topSubjects.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No messages yet.</p>
        ) : (
          <ol className="mt-2 space-y-1 text-sm">
            {topSubjects.map((s) => (
              <li key={s.subject} className="flex justify-between">
                <span>{s.subject}</span>
                <span className="text-gray-500">{s.count}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
