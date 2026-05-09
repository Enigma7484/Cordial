import { Pencil, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, Event, Profile } from "../lib/api";

export default function EventPage({ profile }: { profile: Profile }) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingEventId, setEditingEventId] = useState("");
  const [connectingHandle, setConnectingHandle] = useState("");
  const [connectNote, setConnectNote] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEventId, setActiveEventId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const activeEvent = events.find((item) => item.id === activeEventId) || events[0] || null;
  const isHost = activeEvent?.host_id === profile.id;

  async function loadEvents() {
    setError("");
    try {
      const rows = await api<Event[]>("/events/mine");
      setEvents(rows);
      if (!activeEventId && rows[0]) {
        setActiveEventId(rows[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  function upsertEvent(event: Event) {
    setEvents((current) => {
      const exists = current.some((item) => item.id === event.id);
      return exists ? current.map((item) => (item.id === event.id ? event : item)) : [event, ...current];
    });
    setActiveEventId(event.id);
  }

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const res = await api<Event>("/events", { method: "POST", body: JSON.stringify({ name }) });
      upsertEvent(res);
      setName("");
      setMessage(`Created ${res.name}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create event");
    } finally {
      setBusy(false);
    }
  }

  async function joinEvent(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const res = await api<Event>(`/events/join/${joinCode}`, { method: "POST" });
      upsertEvent(res);
      setJoinCode("");
      setMessage(`Joined ${res.name}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not join event");
    } finally {
      setBusy(false);
    }
  }

  function startEditingEvent(event: Event) {
    setEditingEventId(event.id);
    setEditingName(event.name);
    setError("");
  }

  async function saveEventEdit(event: Event) {
    setError("");
    try {
      const updated = await api<Event>(`/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editingName }),
      });
      upsertEvent(updated);
      setEditingEventId("");
      setEditingName("");
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not edit event");
    }
  }

  async function deleteEvent(event: Event) {
    setError("");
    try {
      await api<{ ok: boolean }>(`/events/${event.id}`, { method: "DELETE" });
      const remaining = events.filter((item) => item.id !== event.id);
      setEvents(remaining);
      setActiveEventId(remaining[0]?.id || "");
      setMessage("Event deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete event");
    }
  }

  async function leaveEvent(event: Event) {
    setError("");
    try {
      await api<Event>(`/events/${event.id}/leave`, { method: "POST" });
      const remaining = events.filter((item) => item.id !== event.id);
      setEvents(remaining);
      setActiveEventId(remaining[0]?.id || "");
      setMessage("Left event.");
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Could not leave event");
    }
  }

  async function connectFromEvent(handle: string, event: Event) {
    setError("");
    setConnectingHandle(handle);
    try {
      await api(`/connections/connect/${handle}`, {
        method: "POST",
        body: JSON.stringify({
          note: connectNote || `Met at ${event.name}`,
          event: event.name,
          event_id: event.id,
        }),
      });
      setMessage(`Connected with @${handle}.`);
      setConnectNote("");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Could not connect from event");
    } finally {
      setConnectingHandle("");
    }
  }

  return (
    <div className="grid gap-5 md:ml-52 md:grid-cols-2">
      <section>
        <h1 className="text-3xl font-black tracking-normal">Event Mode</h1>
        <p className="mt-2 text-neutral-600">Spin up a room code for talks, mixers, club nights, and recruiting tables.</p>
      </section>

      <section className="panel md:col-start-1">
        <form onSubmit={createEvent} className="space-y-3">
          <h2 className="font-bold">Create event</h2>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Founder coffee chat" required />
          <button className="btn-primary w-full" disabled={busy}>Create code</button>
        </form>
      </section>

      <section className="panel">
        <form onSubmit={joinEvent} className="space-y-3">
          <h2 className="font-bold">Join event</h2>
          <input
            className="input uppercase"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="A1B2C3"
            maxLength={6}
            required
          />
          <button className="btn-primary w-full" disabled={busy}>Join</button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
          {error && <p className="text-sm text-coral">{error}</p>}
        </form>
      </section>

      {activeEvent && (
        <section className="panel md:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="label">Active event</p>
              {editingEventId === activeEvent.id ? (
                <div className="mt-2 flex max-w-md gap-2">
                  <input className="input" value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                  <button className="btn-primary !h-10 !min-h-10 !px-3" onClick={() => saveEventEdit(activeEvent)} type="button">
                    Save
                  </button>
                  <button className="btn-soft !h-10 !min-h-10 !px-3" onClick={() => setEditingEventId("")} type="button">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-2xl font-black">{activeEvent.name}</h2>
                  {isHost && (
                    <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => startEditingEvent(activeEvent)} title="Rename event">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              )}
              <p className="mt-3 inline-flex rounded-lg bg-ink px-4 py-2 font-mono text-2xl font-black tracking-widest text-white">
                {activeEvent.code}
              </p>
              <p className="mt-3 text-sm text-neutral-500">{activeEvent.attendees.length} attendee(s)</p>
              <div className="mt-4 flex gap-2">
                {isHost ? (
                  <button className="btn-soft !h-9 !min-h-9 !px-3 text-coral" onClick={() => deleteEvent(activeEvent)}>
                    <Trash2 size={14} />
                    Delete event
                  </button>
                ) : (
                  <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => leaveEvent(activeEvent)}>
                    Leave event
                  </button>
                )}
              </div>
            </div>
            <div className="min-w-48">
              <p className="text-sm font-bold">Attendees</p>
              <input
                className="input mt-2"
                value={connectNote}
                onChange={(event) => setConnectNote(event.target.value)}
                placeholder="Optional connection note"
              />
              <div className="mt-2 space-y-2">
                {(activeEvent.attendee_profiles || []).map((user) => (
                  <div key={user.id} className="rounded-lg border border-line p-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{user.name}</p>
                        <p className="text-xs text-neutral-500">@{user.handle}</p>
                      </div>
                      {user.id !== profile.id && (
                        <button
                          className="btn-soft !h-8 !min-h-8 !px-2"
                          onClick={() => connectFromEvent(user.handle, activeEvent)}
                          disabled={connectingHandle === user.handle}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="panel md:col-span-2">
        <h2 className="font-bold">My events</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {loading && <p className="text-sm text-neutral-500">Loading events...</p>}
          {!loading && events.length === 0 && <p className="text-sm text-neutral-500">No events yet.</p>}
          {events.map((item) => (
            <button
              key={item.id}
              className={`rounded-lg border p-3 text-left ${activeEvent?.id === item.id ? "border-ink bg-paper" : "border-line"}`}
              onClick={() => setActiveEventId(item.id)}
              type="button"
            >
              <p className="font-semibold">{item.name}</p>
              <p className="mt-1 font-mono text-sm">{item.code}</p>
              <p className="mt-1 text-xs text-neutral-500">{item.attendees.length} attendee(s)</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
