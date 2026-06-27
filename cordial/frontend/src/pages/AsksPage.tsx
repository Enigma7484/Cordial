import { useEffect, useState } from "react";
import AskComposer from "../components/AskComposer";
import AskList from "../components/AskList";
import { api, Ask, Profile, SignalReply } from "../lib/api";

export default function AsksPage({ profile }: { profile: Profile }) {
  const [asks, setAsks] = useState<Ask[]>([]);
  const [replies, setReplies] = useState<SignalReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAsks() {
    setError("");
    try {
      setAsks(await api<Ask[]>("/asks"));
      setReplies(await api<SignalReply[]>("/asks/replies/mine"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load signals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAsks();
  }, []);

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-5">
        <div className="page-intro compact-intro">
          <div><p className="eyebrow">Ask clearly. Offer generously.</p><h2>Give people a reason to reach out.</h2><p>Small asks and offers turn a quiet network into a useful community.</p></div>
        </div>
        <AskComposer onCreated={(ask) => setAsks((current) => [ask, ...current])} />
        <section className="panel">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">Opportunity inbox</h2>
            <span className="rounded-full border border-line px-3 py-1 text-xs text-neutral-500">{replies.length} reply(s)</span>
          </div>
          <div className="mt-3 space-y-3">
            {replies.length === 0 && <p className="text-sm text-neutral-500">Replies to signals will land here with a connection and follow-up ready.</p>}
            {replies.slice(0, 5).map((reply) => {
              const inbound = reply.ask_user_id === profile.id;
              const person = inbound ? reply.responder : reply.ask_user;
              return (
                <div key={reply.id} className="rounded-lg border border-line p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{inbound ? "Incoming" : "Sent"}</p>
                  <p className="mt-1 text-sm font-semibold">@{person?.handle || "someone"}</p>
                  <p className="mt-2 text-sm text-neutral-600">{reply.message || reply.ask?.text}</p>
                  <p className="mt-2 text-xs text-neutral-500">{reply.followup_id ? "Follow-up created" : "Reply saved"}</p>
                </div>
              );
            })}
          </div>
        </section>
      </section>
      <section>
        {loading && <div className="panel text-sm text-neutral-500">Loading signals...</div>}
        {error && <div className="panel text-sm text-coral">{error}</div>}
        {!loading && !error && (
          <AskList
            asks={asks}
            profile={profile}
            onUpdated={(updated) => setAsks((current) => current.map((ask) => (ask.id === updated.id ? updated : ask)))}
            onDeleted={(askId) => setAsks((current) => current.filter((ask) => ask.id !== askId))}
            onReplied={(reply) => {
              setReplies((current) => [reply, ...current]);
              setAsks((current) =>
                current.map((ask) => (ask.id === reply.ask_id ? { ...ask, reply_count: (ask.reply_count || 0) + 1 } : ask)),
              );
            }}
          />
        )}
      </section>
    </div>
  );
}
