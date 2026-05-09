import { CalendarPlus, Check, Handshake, Plus, RotateCcw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, Connection, Followup, Profile } from "../lib/api";

export default function Home({ profile }: { profile: Profile }) {
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [followupText, setFollowupText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const selectedConnection = connections.find((item) => item.id === selectedConnectionId) || null;
  const openFollowups = followups.filter((item) => item.status === "open");
  const completedFollowups = followups.filter((item) => item.status === "completed");

  async function loadDashboard() {
    setError("");
    try {
      const [connectionRows, followupRows] = await Promise.all([
        api<Connection[]>("/connections/mine"),
        api<Followup[]>("/followups/mine"),
      ]);
      setConnections(connectionRows);
      setFollowups(followupRows);
      if (!selectedConnectionId && connectionRows[0]) {
        setSelectedConnectionId(connectionRows[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const res = await api<Connection>(`/connections/connect/${handle}`, {
        method: "POST",
        body: JSON.stringify({ note, event: "" }),
      });
      setConnections((current) => {
        const exists = current.some((item) => item.id === res.id);
        return exists ? current.map((item) => (item.id === res.id ? res : item)) : [res, ...current];
      });
      setSelectedConnectionId(res.id);
      setHandle("");
      setNote("");
      setMessage(`Connected with @${res.other_user?.handle || handle}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not connect");
    } finally {
      setBusy(false);
    }
  }

  async function createFollowup(event: FormEvent) {
    event.preventDefault();
    if (!selectedConnection) return;
    setError("");
    try {
      const created = await api<Followup>("/followups", {
        method: "POST",
        body: JSON.stringify({
          connection_id: selectedConnection.id,
          text: followupText,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });
      setFollowups((current) => [created, ...current]);
      setFollowupText("");
      setDueDate("");
    } catch (followupError) {
      setError(followupError instanceof Error ? followupError.message : "Could not save follow-up");
    }
  }

  async function toggleFollowup(item: Followup) {
    const nextStatus = item.status === "open" ? "completed" : "open";
    setError("");
    try {
      const updated = await api<Followup>(`/followups/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setFollowups((current) => current.map((row) => (row.id === item.id ? updated : row)));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update follow-up");
    }
  }

  return (
    <div className="grid gap-5 md:ml-52 md:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-5">
        <div>
          <p className="text-sm text-neutral-500">@{profile.handle}</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">Hi, {profile.name || "there"}.</h1>
          <p className="mt-2 max-w-xl text-neutral-600">Keep the conversation warm after the room clears.</p>
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
          <button className="btn-primary w-full" disabled={busy}>
            <Plus size={16} />
            Connect
          </button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
          {error && <p className="text-sm text-coral">{error}</p>}
        </form>

        <section className="panel space-y-3">
          <h2 className="font-bold">Connections</h2>
          {loading && <p className="text-sm text-neutral-500">Loading connections...</p>}
          {!loading && connections.length === 0 && (
            <p className="text-sm text-neutral-500">Connect by handle to start a lightweight contact list.</p>
          )}
          <div className="grid gap-2">
            {connections.map((item) => (
              <button
                key={item.id}
                className={`rounded-lg border p-3 text-left transition ${
                  selectedConnectionId === item.id ? "border-ink bg-paper" : "border-line hover:bg-paper"
                }`}
                onClick={() => setSelectedConnectionId(item.id)}
                type="button"
              >
                <p className="font-semibold">{item.other_user?.name || "Connection"}</p>
                <p className="text-xs text-neutral-500">
                  @{item.other_user?.handle || "unknown"}
                  {item.other_user?.title ? ` - ${item.other_user.title}` : ""}
                </p>
                {item.note && <p className="mt-2 text-sm text-neutral-600">{item.note}</p>}
              </button>
            ))}
          </div>
        </section>

        {selectedConnection && (
          <form onSubmit={createFollowup} className="panel space-y-3">
            <div className="flex items-center gap-2">
              <CalendarPlus size={18} />
              <h2 className="font-bold">Follow up with @{selectedConnection.other_user?.handle}</h2>
            </div>
            <input
              className="input"
              value={followupText}
              onChange={(event) => setFollowupText(event.target.value)}
              placeholder="Send resume template / grab coffee next week"
              required
            />
            <input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <button className="btn-primary w-full">Save follow-up</button>
          </form>
        )}
      </section>

      <section className="panel h-fit">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">My follow-ups</h2>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-neutral-500">{openFollowups.length} open</span>
        </div>
        <div className="mt-4 space-y-3">
          {openFollowups.length === 0 && <p className="text-sm text-neutral-500">No open cards yet.</p>}
          {openFollowups.map((item) => (
            <div key={item.id} className="rounded-lg border border-line p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{item.text}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    @{item.other_user?.handle || "connection"}
                    {item.due_date ? ` - due ${new Date(item.due_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => toggleFollowup(item)} title="Mark completed">
                  <Check size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {completedFollowups.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-neutral-500">Completed</h3>
            <div className="mt-3 space-y-2">
              {completedFollowups.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 opacity-70">
                  <p className="text-sm line-through">{item.text}</p>
                  <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => toggleFollowup(item)} title="Reopen">
                    <RotateCcw size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
