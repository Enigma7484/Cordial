import { Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api, Ask, Profile } from "../lib/api";

function splitTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AskList({
  asks,
  profile,
  onUpdated,
  onDeleted,
}: {
  asks: Ask[];
  profile: Profile;
  onUpdated: (ask: Ask) => void;
  onDeleted: (askId: string) => void;
}) {
  const [editingId, setEditingId] = useState("");
  const [editingType, setEditingType] = useState<"ask" | "offer">("ask");
  const [editingText, setEditingText] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [error, setError] = useState("");

  if (asks.length === 0) {
    return <div className="panel text-sm text-neutral-500">No signals yet.</div>;
  }

  function startEditing(ask: Ask) {
    setEditingId(ask.id);
    setEditingType(ask.type);
    setEditingText(ask.text);
    setEditingTags(ask.tags.join(", "));
    setError("");
  }

  async function saveEdit(askId: string) {
    setError("");
    try {
      const updated = await api<Ask>(`/asks/${askId}`, {
        method: "PUT",
        body: JSON.stringify({ type: editingType, text: editingText, tags: splitTags(editingTags) }),
      });
      onUpdated(updated);
      setEditingId("");
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not edit signal");
    }
  }

  async function deleteAsk(askId: string) {
    setError("");
    try {
      await api<{ ok: boolean }>(`/asks/${askId}`, { method: "DELETE" });
      onDeleted(askId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete signal");
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="panel text-sm text-coral">{error}</div>}
      {asks.map((ask) => (
        <article key={ask.id} className="panel">
          {editingId === ask.id ? (
            <div className="space-y-3">
              <div className="segmented">
                <button className={`segment ${editingType === "ask" ? "segment-active" : ""}`} type="button" onClick={() => setEditingType("ask")}>
                  Ask
                </button>
                <button className={`segment ${editingType === "offer" ? "segment-active" : ""}`} type="button" onClick={() => setEditingType("offer")}>
                  Offer
                </button>
              </div>
              <textarea className="input min-h-24" value={editingText} onChange={(event) => setEditingText(event.target.value)} maxLength={240} />
              <input className="input" value={editingTags} onChange={(event) => setEditingTags(event.target.value)} />
              <div className="flex gap-2">
                <button className="btn-primary !h-9 !min-h-9 !px-3" type="button" onClick={() => saveEdit(ask.id)}>
                  Save
                </button>
                <button className="btn-soft !h-9 !min-h-9 !px-3" type="button" onClick={() => setEditingId("")}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${ask.type === "ask" ? "bg-mint" : "bg-coral/20 text-coral"}`}>
                    {ask.type}
                  </span>
                  <p className="mt-3 font-semibold">{ask.text}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <p className="text-xs text-neutral-400">{new Date(ask.created_at).toLocaleDateString()}</p>
                  {ask.user_id === profile.id && (
                    <>
                      <button className="btn-soft !h-8 !min-h-8 !px-2" onClick={() => startEditing(ask)} title="Edit signal">
                        <Pencil size={13} />
                      </button>
                      <button className="btn-soft !h-8 !min-h-8 !px-2" onClick={() => deleteAsk(ask.id)} title="Delete signal">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
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
                  {ask.user.name} - @{ask.user.handle}
                  {ask.user.title ? ` - ${ask.user.title}` : ""}
                </p>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
