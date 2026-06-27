import { ArrowLeft, CalendarPlus, CheckCircle2, Clock3, MessageSquare } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, ConnectionTimeline, Followup } from "../lib/api";

export default function ConnectionPage({ connectionId, onBack }: { connectionId: string; onBack: () => void }) {
  const [timeline, setTimeline] = useState<ConnectionTimeline | null>(null);
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  async function loadTimeline() {
    setError("");
    try {
      setTimeline(await api<ConnectionTimeline>(`/connections/${connectionId}/timeline`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load connection");
    }
  }

  useEffect(() => {
    loadTimeline();
  }, [connectionId]);

  async function createFollowup(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api<Followup>("/followups", {
        method: "POST",
        body: JSON.stringify({
          connection_id: connectionId,
          text,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });
      setText("");
      setDueDate("");
      loadTimeline();
    } catch (followupError) {
      setError(followupError instanceof Error ? followupError.message : "Could not create follow-up");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="space-y-5">
        <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={onBack} type="button">
          <ArrowLeft size={14} />
          Back
        </button>
        {error && <div className="panel text-sm text-coral">{error}</div>}
        {!timeline && !error && <div className="panel text-sm text-neutral-500">Loading relationship...</div>}
        {timeline && (
          <div className="panel">
            <p className="label">Connection</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal">{timeline.other_user?.name || "Connection"}</h1>
            <p className="mt-1 text-neutral-600">
              @{timeline.other_user?.handle}
              {timeline.other_user?.title ? ` - ${timeline.other_user.title}` : ""}
            </p>
            <p className="mt-3 text-sm text-neutral-600">{timeline.other_user?.bio || "No bio yet."}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-line p-3">
                <p className="text-2xl font-black">{timeline.open_followups}</p>
                <p className="text-xs text-neutral-500">open</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-2xl font-black">{timeline.completed_followups}</p>
                <p className="text-xs text-neutral-500">done</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-2xl font-black">{timeline.signal_reply_count}</p>
                <p className="text-xs text-neutral-500">signals</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={createFollowup} className="panel space-y-3">
          <div className="flex items-center gap-2">
            <CalendarPlus size={18} />
            <h2 className="font-bold">Next move</h2>
          </div>
          <input className="input" value={text} onChange={(event) => setText(event.target.value)} placeholder="Send the deck / book coffee / intro to..." required />
          <input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <button className="btn-primary w-full">Add follow-up</button>
        </form>
      </section>

      <section className="panel h-fit">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} />
          <h2 className="font-bold">Relationship timeline</h2>
        </div>
        <div className="mt-4 space-y-3">
          {timeline?.timeline.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-lg border border-line p-3">
              {item.status === "completed" ? <CheckCircle2 className="mt-0.5 shrink-0 text-blue" size={16} /> : <Clock3 className="mt-0.5 shrink-0 text-blue" size={16} />}
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                {item.text && <p className="mt-1 text-sm text-neutral-600">{item.text}</p>}
                {item.created_at && <p className="mt-2 text-xs text-neutral-500">{new Date(item.created_at).toLocaleDateString()}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
