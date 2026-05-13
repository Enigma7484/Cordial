import { CalendarPlus, Check, Clock3, Handshake, Pencil, Plus, RotateCcw, Sparkles, Target, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, Ask, Connection, ConnectionTimeline, Event, Followup, Profile, SignalReply } from "../lib/api";

function profileStrength(profile: Profile) {
  const checks = [
    Boolean(profile.name),
    Boolean(profile.title),
    Boolean(profile.bio),
    profile.skills?.length >= 3,
    profile.open_to?.length >= 2,
    profile.interests?.length >= 2,
    profile.projects?.length > 0,
    profile.links?.length > 0,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const missing = [
    !profile.title && "title",
    !profile.bio && "bio",
    !(profile.skills?.length >= 3) && "3 skills",
    !(profile.open_to?.length >= 2) && "open-to tags",
    !(profile.projects?.length > 0) && "featured project",
  ].filter(Boolean) as string[];
  return { score, missing };
}

export default function Home({ profile, onOpenConnection }: { profile: Profile; onOpenConnection: (connectionId: string) => void }) {
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [signalReplies, setSignalReplies] = useState<SignalReply[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [followupText, setFollowupText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editingFollowupId, setEditingFollowupId] = useState("");
  const [editingText, setEditingText] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [connectionTimeline, setConnectionTimeline] = useState<ConnectionTimeline | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const selectedConnection = connections.find((item) => item.id === selectedConnectionId) || null;
  const openFollowups = followups.filter((item) => item.status === "open");
  const completedFollowups = followups.filter((item) => item.status === "completed");
  const strength = profileStrength(profile);
  const todaysFollowups = openFollowups.filter((item) => !item.due_date || new Date(item.due_date) <= new Date(Date.now() + 1000 * 60 * 60 * 24));
  const suggestedSignals = asks
    .filter((ask) => ask.user_id !== profile.id)
    .filter((ask) => {
      const tags = ask.tags.map((tag) => tag.toLowerCase());
      const mine = [...(profile.skills || []), ...(profile.open_to || []), ...(profile.interests || [])].map((tag) => tag.toLowerCase());
      return tags.some((tag) => mine.some((item) => item.includes(tag) || tag.includes(item)));
    })
    .slice(0, 3);

  async function loadDashboard() {
    setError("");
    try {
      const [connectionRows, followupRows, eventRows, askRows, replyRows] = await Promise.all([
        api<Connection[]>("/connections/mine"),
        api<Followup[]>("/followups/mine"),
        api<Event[]>("/events/mine"),
        api<Ask[]>("/asks"),
        api<SignalReply[]>("/asks/replies/mine"),
      ]);
      setConnections(connectionRows);
      setFollowups(followupRows);
      setEvents(eventRows);
      setAsks(askRows);
      setSignalReplies(replyRows);
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

  useEffect(() => {
    async function loadTimeline() {
      if (!selectedConnectionId) {
        setConnectionTimeline(null);
        return;
      }
      try {
        setConnectionTimeline(await api<ConnectionTimeline>(`/connections/${selectedConnectionId}/timeline`));
      } catch {
        setConnectionTimeline(null);
      }
    }
    loadTimeline();
  }, [selectedConnectionId, followups.length]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const res = await api<Connection>(`/connections/connect/${handle}`, {
        method: "POST",
        body: JSON.stringify({ note, event: "", event_id: eventId }),
      });
      setConnections((current) => {
        const exists = current.some((item) => item.id === res.id);
        return exists ? current.map((item) => (item.id === res.id ? res : item)) : [res, ...current];
      });
      setSelectedConnectionId(res.id);
      setHandle("");
      setNote("");
      setEventId("");
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

  function startEditingFollowup(item: Followup) {
    setEditingFollowupId(item.id);
    setEditingText(item.text);
    setEditingDueDate(item.due_date ? item.due_date.slice(0, 10) : "");
  }

  async function saveFollowupEdit(item: Followup) {
    setError("");
    try {
      const updated = await api<Followup>(`/followups/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({
          text: editingText,
          due_date: editingDueDate ? new Date(editingDueDate).toISOString() : null,
          status: item.status,
        }),
      });
      setFollowups((current) => current.map((row) => (row.id === item.id ? updated : row)));
      setEditingFollowupId("");
      setEditingText("");
      setEditingDueDate("");
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not edit follow-up");
    }
  }

  async function deleteFollowup(item: Followup) {
    setError("");
    try {
      await api<{ ok: boolean }>(`/followups/${item.id}`, { method: "DELETE" });
      setFollowups((current) => current.filter((row) => row.id !== item.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete follow-up");
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

        <section className="panel">
          <div className="flex items-center gap-2">
            <Target size={18} />
            <h2 className="font-bold">Command Center</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xl font-black">{todaysFollowups.length}</p>
              <p className="text-xs text-neutral-500">due or unscheduled</p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xl font-black">{signalReplies.length}</p>
              <p className="text-xs text-neutral-500">signal replies</p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xl font-black">{events.length}</p>
              <p className="text-xs text-neutral-500">active events</p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xl font-black">{strength.score}%</p>
              <p className="text-xs text-neutral-500">profile strength</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-blue/30 bg-mint/60 p-3">
              <p className="text-sm font-bold">Nudge</p>
              <p className="mt-1 text-sm text-neutral-600">
                {todaysFollowups[0]?.text ||
                  signalReplies[0]?.message ||
                  suggestedSignals[0]?.text ||
                  "Post a signal or add one follow-up to create your next warm path."}
              </p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-sm font-bold">Profile polish</p>
              <p className="mt-1 text-sm text-neutral-600">
                {strength.missing.length ? `Add ${strength.missing.slice(0, 3).join(", ")} to look sharper.` : "Profile is pitch-ready."}
              </p>
            </div>
          </div>
          {suggestedSignals.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold">Signals you can act on</p>
              <div className="mt-2 grid gap-2">
                {suggestedSignals.map((ask) => (
                  <div key={ask.id} className="rounded-lg border border-line p-3">
                    <p className="text-sm font-semibold">{ask.text}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      @{ask.user?.handle} - {ask.tags.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

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
          <select className="input" value={eventId} onChange={(event) => setEventId(event.target.value)}>
            <option value="">No event context</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} ({event.code})
              </option>
            ))}
          </select>
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
                {item.event_context && (
                  <p className="mt-2 text-xs font-semibold text-blue">
                    Met at {item.event_context.name} ({item.event_context.code})
                  </p>
                )}
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
        {selectedConnection && (
          <div className="mb-5 border-b border-line pb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label">Relationship snapshot</p>
                <h2 className="mt-1 text-xl font-black">@{selectedConnection.other_user?.handle}</h2>
                <p className="mt-1 text-sm text-neutral-600">{selectedConnection.other_user?.title || "No title yet"}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full border border-line px-3 py-1 text-xs text-neutral-500">
                  {connectionTimeline?.timeline.length || 1} touchpoint(s)
                </span>
                <button className="btn-soft !h-8 !min-h-8 !px-2 text-xs" onClick={() => onOpenConnection(selectedConnection.id)} type="button">
                  Open detail
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-line p-3">
                <p className="text-2xl font-black">{connectionTimeline?.open_followups || 0}</p>
                <p className="text-xs text-neutral-500">open follow-ups</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-2xl font-black">{connectionTimeline?.completed_followups || 0}</p>
                <p className="text-xs text-neutral-500">completed</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-2xl font-black">{connectionTimeline?.signal_reply_count || 0}</p>
                <p className="text-xs text-neutral-500">signal replies</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-blue/30 bg-mint/60 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 text-blue" size={16} />
                <div>
                  <p className="text-sm font-bold">Next best move</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {connectionTimeline?.next_action || "Add one specific follow-up so this connection has somewhere to go."}
                  </p>
                </div>
              </div>
            </div>
            {connectionTimeline?.timeline.length ? (
              <div className="mt-4 space-y-2">
                {connectionTimeline.timeline.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-lg border border-line p-3">
                    <Clock3 className="mt-0.5 shrink-0 text-blue" size={15} />
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      {item.text && <p className="mt-1 text-xs text-neutral-500">{item.text}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">My follow-ups</h2>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-neutral-500">{openFollowups.length} open</span>
        </div>
        <div className="mt-4 space-y-3">
          {openFollowups.length === 0 && <p className="text-sm text-neutral-500">No open cards yet.</p>}
          {openFollowups.map((item) => (
            <div key={item.id} className="rounded-lg border border-line p-3">
              {editingFollowupId === item.id ? (
                <div className="space-y-2">
                  <input className="input" value={editingText} onChange={(event) => setEditingText(event.target.value)} />
                  <input className="input" type="date" value={editingDueDate} onChange={(event) => setEditingDueDate(event.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn-primary !h-9 !min-h-9 !px-3" onClick={() => saveFollowupEdit(item)} type="button">
                      Save
                    </button>
                    <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => setEditingFollowupId("")} type="button">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.text}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      @{item.other_user?.handle || "connection"}
                      {item.due_date ? ` - due ${new Date(item.due_date).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => startEditingFollowup(item)} title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => deleteFollowup(item)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                    <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => toggleFollowup(item)} title="Mark completed">
                      <Check size={15} />
                    </button>
                  </div>
                </div>
              )}
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
                  <div className="flex gap-1">
                    <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => deleteFollowup(item)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                    <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => toggleFollowup(item)} title="Reopen">
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
