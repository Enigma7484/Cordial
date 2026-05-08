import { Ask } from "../lib/api";

export default function AskList({ asks }: { asks: Ask[] }) {
  if (asks.length === 0) {
    return <div className="panel text-sm text-neutral-500">No signals yet.</div>;
  }

  return (
    <div className="space-y-3">
      {asks.map((ask) => (
        <article key={ask.id} className="panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${ask.type === "ask" ? "bg-mint" : "bg-coral/20 text-coral"}`}>
                {ask.type}
              </span>
              <p className="mt-3 font-semibold">{ask.text}</p>
            </div>
            <p className="shrink-0 text-xs text-neutral-400">{new Date(ask.created_at).toLocaleDateString()}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ask.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-line px-2 py-1 text-xs text-neutral-600">
                {tag}
              </span>
            ))}
          </div>
          {ask.user && (
            <p className="mt-4 text-xs text-neutral-500">
              {ask.user.name} · @{ask.user.handle}
              {ask.user.title ? ` · ${ask.user.title}` : ""}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
