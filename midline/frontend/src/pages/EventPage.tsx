import { FormEvent, useState } from "react";
import { api } from "../lib/api";

type Event = { id: string; name: string; code: string; attendees: string[]; created_at: string };

export default function EventPage() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [event, setEvent] = useState<Event | null>(null);
  const [message, setMessage] = useState("");

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await api<Event>("/events", { method: "POST", body: JSON.stringify({ name }) });
    setEvent(res);
  }

  async function joinEvent(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await api<Event>(`/events/join/${joinCode}`, { method: "POST" });
      setEvent(res);
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
          <input className="input uppercase" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="A1B2C3" maxLength={6} required />
          <button className="btn-primary w-full">Join</button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
        </form>
      </section>
      {event && (
        <section className="panel md:col-span-2">
          <p className="label">Active event</p>
          <h2 className="mt-2 text-2xl font-black">{event.name}</h2>
          <p className="mt-3 inline-flex rounded-lg bg-ink px-4 py-2 font-mono text-2xl font-black tracking-widest text-white">
            {event.code}
          </p>
          <p className="mt-3 text-sm text-neutral-500">{event.attendees.length} attendee(s)</p>
        </section>
      )}
    </div>
  );
}
