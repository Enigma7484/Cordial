import { CalendarPlus, Handshake, Plus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, Profile } from "../lib/api";

type Connection = { id: string; note?: string; event?: string; created_at: string };
type Followup = { id: string; text: string; status: "open" | "completed"; due_date?: string };

export default function Home({ profile }: { profile: Profile }) {
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [followupText, setFollowupText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [message, setMessage] = useState("");

  async function loadFollowups() {
    setFollowups(await api<Followup[]>("/followups/mine"));
  }

  useEffect(() => {
    loadFollowups();
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const res = await api<Connection>(`/connections/connect/${handle}`, {
        method: "POST",
        body: JSON.stringify({ note, event: "" }),
      });
      setConnection(res);
      setMessage("Connected. Add a follow-up while the context is fresh.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect");
    }
  }

  async function createFollowup(event: FormEvent) {
    event.preventDefault();
    if (!connection) return;
    await api("/followups", {
      method: "POST",
      body: JSON.stringify({
        connection_id: connection.id,
        text: followupText,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      }),
    });
    setFollowupText("");
    setDueDate("");
    await loadFollowups();
  }

  return (
    <div className="grid gap-5 md:ml-52 md:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-5">
        <div>
          <p className="text-sm text-neutral-500">@{profile.handle}</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">Hi, {profile.name || "there"}.</h1>
          <p className="mt-2 max-w-xl text-neutral-600">
            Keep the conversation warm after the room clears.
          </p>
        </div>

        <form onSubmit={connect} className="panel space-y-3">
          <div className="flex items-center gap-2">
            <Handshake size={18} />
            <h2 className="font-bold">Quick Connect</h2>
          </div>
          <input
            className="input"
            value={handle}
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
            placeholder="handle"
            required
          />
          <textarea
            className="input min-h-24"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional context: met after the design panel, talked about PM internships..."
          />
          <button className="btn-primary w-full">
            <Plus size={16} />
            Connect
          </button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
        </form>

        {connection && (
          <form onSubmit={createFollowup} className="panel space-y-3">
            <div className="flex items-center gap-2">
              <CalendarPlus size={18} />
              <h2 className="font-bold">Follow-up Card</h2>
            </div>
            <input
              className="input"
              value={followupText}
              onChange={(event) => setFollowupText(event.target.value)}
              placeholder="Send resume template / grab coffee next week"
              required
            />
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            <button className="btn-primary w-full">Save follow-up</button>
          </form>
        )}
      </section>

      <section className="panel h-fit">
        <h2 className="font-bold">My follow-ups</h2>
        <div className="mt-4 space-y-3">
          {followups.length === 0 && <p className="text-sm text-neutral-500">No cards yet.</p>}
          {followups.map((item) => (
            <div key={item.id} className="rounded-lg border border-line p-3">
              <p className="text-sm font-medium">{item.text}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {item.status}
                {item.due_date ? ` · due ${new Date(item.due_date).toLocaleDateString()}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
