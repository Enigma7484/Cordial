import { Handshake, Pencil, Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api, Ask, Profile, SignalMatch, SignalReply } from "../lib/api";

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
  onReplied,
}: {
  asks: Ask[];
  profile: Profile;
  onUpdated: (ask: Ask) => void;
  onDeleted: (askId: string) => void;
  onReplied?: (reply: SignalReply) => void;
}) {
  const [editingId, setEditingId] = useState("");
  const [editingType, setEditingType] = useState<"ask" | "offer">("ask");
  const [editingText, setEditingText] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [replyingId, setReplyingId] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [matchAskId, setMatchAskId] = useState("");
  const [matches, setMatches] = useState<SignalMatch[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  async function replyToAsk(ask: Ask) {
    setError("");
    setMessage("");
    try {
      const reply = await api<SignalReply>(`/asks/${ask.id}/replies`, {
        method: "POST",
        body: JSON.stringify({ message: replyMessage }),
      });
      onReplied?.(reply);
      setReplyingId("");
      setReplyMessage("");
      setMessage(`Reply sent. Cordial created a connection and follow-up with @${ask.user?.handle || "them"}.`);
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Could not reply to signal");
    }
  }

  async function loadMatches(ask: Ask) {
    if (matchAskId === ask.id) {
      setMatchAskId("");
      setMatches([]);
      return;
    }
    setError("");
    try {
      setMatches(await api<SignalMatch[]>(`/asks/${ask.id}/matches`));
      setMatchAskId(ask.id);
    } catch (matchError) {
      setError(matchError instanceof Error ? matchError.message : "Could not load matches");
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="panel text-sm text-coral">{error}</div>}
      {message && <div className="panel text-sm text-neutral-600">{message}</div>}
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
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      ask.type === "ask" ? "bg-mint text-[#0B1220]" : "bg-coral/15 text-coral"
                    }`}
                  >
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
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <span className="text-xs font-semibold text-neutral-500">{ask.reply_count || 0} response(s)</span>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-soft !h-9 !min-h-9 !px-3" type="button" onClick={() => loadMatches(ask)}>
                    Best matches
                  </button>
                  {ask.user_id !== profile.id && (
                    <button className="btn-soft !h-9 !min-h-9 !px-3" type="button" onClick={() => setReplyingId(replyingId === ask.id ? "" : ask.id)}>
                      <Handshake size={14} />
                      {ask.type === "ask" ? "I can help" : "I'm interested"}
                    </button>
                  )}
                </div>
              </div>
              {matchAskId === ask.id && (
                <div className="mt-3 rounded-lg border border-line bg-paper p-3">
                  <p className="text-sm font-bold">Best people for this signal</p>
                  <div className="mt-2 grid gap-2">
                    {matches.length === 0 && <p className="text-sm text-neutral-500">No strong matches yet.</p>}
                    {matches.map((match) => (
                      <div key={match.user.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/80 p-2">
                        <div>
                          <p className="text-sm font-semibold">@{match.user.handle}</p>
                          <p className="text-xs text-neutral-500">{match.reasons.join(", ") || match.user.title}</p>
                        </div>
                        <span className="rounded-full bg-coral px-2 py-1 text-xs font-bold text-white">{match.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {replyingId === ask.id && (
                <div className="mt-3 rounded-lg border border-line bg-paper p-3">
                  <textarea
                    className="input min-h-20"
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                    placeholder="Quick note before Cordial creates the connection..."
                    maxLength={280}
                  />
                  <div className="mt-2 flex gap-2">
                    <button className="btn-primary !h-9 !min-h-9 !px-3" type="button" onClick={() => replyToAsk(ask)}>
                      <Send size={14} />
                      Send reply
                    </button>
                    <button className="btn-soft !h-9 !min-h-9 !px-3" type="button" onClick={() => setReplyingId("")}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
