import { FormEvent, useEffect, useState } from "react";
import { api, Event } from "../lib/api";

export default function EventPage() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEventId, setActiveEventId] = useState("");
  const [message, setMessage] = useState("");

  const activeEvent = events.find((item) => item.id === activeEventId) || events[0] || null;

  async function loadEvents() {
    const rows = await api<Event[]>("/events/mine");
    setEvents(rows);
    if (!activeEventId && rows[0]) {
      setActiveEventId(rows[0].id);
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
    try {
      const res = await api<Event>("/events", { method: "POST", body: JSON.stringify({ name }) });
      upsertEvent(res);
      setName("");
      setMessage(`Created ${res.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create event");
    }
  }

  async function joinEvent(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await api<Event>(`/events/join/${joinCode}`, { method: "POST" });
      upsertEvent(res);
      setJoinCode("");
      setMessage(`Joined ${res.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join event");
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
          <button className="btn-primary w-full">Create code</button>
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
          <button className="btn-primary w-full">Join</button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
        </form>
      </section>

      {activeEvent && (
        <section className="panel md:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="label">Active event</p>
              <h2 className="mt-2 text-2xl font-black">{activeEvent.name}</h2>
              <p className="mt-3 inline-flex rounded-lg bg-ink px-4 py-2 font-mono text-2xl font-black tracking-widest text-white">
                {activeEvent.code}
              </p>
              <p className="mt-3 text-sm text-neutral-500">{activeEvent.attendees.length} attendee(s)</p>
            </div>
            <div className="min-w-48">
              <p className="text-sm font-bold">Attendees</p>
              <div className="mt-2 space-y-2">
                {(activeEvent.attendee_profiles || []).map((user) => (
                  <div key={user.id} className="rounded-lg border border-line p-2">
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs text-neutral-500">@{user.handle}</p>
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
          {events.length === 0 && <p className="text-sm text-neutral-500">No events yet.</p>}
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
