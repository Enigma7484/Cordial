import { Calendar, Copy, ExternalLink, Link as LinkIcon, MapPin, Pencil, Plus, Share2, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, Event, EventRecap, Profile } from "../lib/api";

type EventLink = { label: string; url: string };
type EventForm = {
  name: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  event_url: string;
  host_note: string;
  links: EventLink[];
};

function blankForm(): EventForm {
  return {
    name: "",
    description: "",
    location: "",
    starts_at: "",
    ends_at: "",
    event_url: "",
    host_note: "",
    links: [{ label: "", url: "" }],
  };
}

function formFromEvent(event: Event): EventForm {
  return {
    name: event.name || "",
    description: event.description || "",
    location: event.location || "",
    starts_at: event.starts_at ? event.starts_at.slice(0, 16) : "",
    ends_at: event.ends_at ? event.ends_at.slice(0, 16) : "",
    event_url: event.event_url || "",
    host_note: event.host_note || "",
    links: event.links?.length ? event.links : [{ label: "", url: "" }],
  };
}

function payloadFromForm(form: EventForm) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    location: form.location.trim(),
    starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
    ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    event_url: form.event_url.trim(),
    host_note: form.host_note.trim(),
    links: form.links
      .map((link) => ({ label: link.label.trim() || "Link", url: link.url.trim() }))
      .filter((link) => link.url),
  };
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function EventPage({ profile, initialJoinCode = "" }: { profile: Profile; initialJoinCode?: string }) {
  const [form, setForm] = useState<EventForm>(blankForm());
  const [joinCode, setJoinCode] = useState("");
  const [editingForm, setEditingForm] = useState<EventForm>(blankForm());
  const [editingEventId, setEditingEventId] = useState("");
  const [connectingHandle, setConnectingHandle] = useState("");
  const [connectNote, setConnectNote] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [recap, setRecap] = useState<EventRecap | null>(null);
  const [activeEventId, setActiveEventId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const activeEvent = events.find((item) => item.id === activeEventId) || events[0] || null;
  const isHost = activeEvent?.host_id === profile.id;
  const activeJoinUrl = activeEvent ? `${window.location.origin}${window.location.pathname}#/join/${activeEvent.code}` : "";

  async function loadEvents() {
    setError("");
    try {
      const rows = await api<Event[]>("/events/mine");
      setEvents(rows);
      if (!activeEventId && rows[0]) setActiveEventId(rows[0].id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (initialJoinCode) setJoinCode(initialJoinCode);
  }, [initialJoinCode]);

  useEffect(() => {
    if (activeEvent && recap?.event.id !== activeEvent.id) {
      loadRecap(activeEvent);
    }
  }, [activeEvent?.id]);

  function upsertEvent(event: Event) {
    setEvents((current) => {
      const exists = current.some((item) => item.id === event.id);
      return exists ? current.map((item) => (item.id === event.id ? event : item)) : [event, ...current];
    });
    setActiveEventId(event.id);
  }

  function updateForm(key: keyof EventForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateEditingForm(key: keyof EventForm, value: string) {
    setEditingForm((current) => ({ ...current, [key]: value }));
  }

  function updateLink(index: number, key: keyof EventLink, value: string, editing = false) {
    const setter = editing ? setEditingForm : setForm;
    setter((current) => ({
      ...current,
      links: current.links.map((link, itemIndex) => (itemIndex === index ? { ...link, [key]: value } : link)),
    }));
  }

  function addLink(editing = false) {
    const setter = editing ? setEditingForm : setForm;
    setter((current) => ({ ...current, links: [...current.links, { label: "", url: "" }] }));
  }

  function removeLink(index: number, editing = false) {
    const setter = editing ? setEditingForm : setForm;
    setter((current) => ({ ...current, links: current.links.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const res = await api<Event>("/events", { method: "POST", body: JSON.stringify(payloadFromForm(form)) });
      upsertEvent(res);
      setForm(blankForm());
      setMessage(`Created ${res.name}.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create event");
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
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join event");
    } finally {
      setBusy(false);
    }
  }

  function startEditingEvent(event: Event) {
    setEditingEventId(event.id);
    setEditingForm(formFromEvent(event));
    setError("");
  }

  async function saveEventEdit(event: Event) {
    setError("");
    try {
      const updated = await api<Event>(`/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify(payloadFromForm(editingForm)),
      });
      upsertEvent(updated);
      setEditingEventId("");
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

  async function loadRecap(event: Event) {
    setError("");
    try {
      setRecap(await api<EventRecap>(`/events/${event.id}/recap`));
    } catch (recapError) {
      setError(recapError instanceof Error ? recapError.message : "Could not load event recap");
    }
  }

  async function copyEventCode(event: Event) {
    await navigator.clipboard.writeText(event.code);
    setMessage(`Copied event code ${event.code}.`);
  }

  async function copyEventLink(event: Event) {
    const url = `${window.location.origin}${window.location.pathname}#/join/${event.code}`;
    await navigator.clipboard.writeText(url);
    setMessage("Join link copied.");
  }

  async function copyHostReport(recap: EventRecap) {
    const report = [
      recap.host_summary,
      `Connection rate: ${recap.connection_rate}%`,
      `Follow-up completion: ${recap.followup_completion_rate}%`,
      `Top attendee themes: ${recap.top_terms.length ? recap.top_terms.join(", ") : "none captured yet"}`,
      `Next action: ${recap.suggested_actions[0] || "Create one follow-up before the event goes cold."}`,
    ].join("\n");
    await navigator.clipboard.writeText(report);
    setMessage("Host outcome report copied.");
  }

  function EventFields({
    value,
    editing = false,
  }: {
    value: EventForm;
    editing?: boolean;
  }) {
    const update = editing ? updateEditingForm : updateForm;
    return (
      <div className="space-y-3">
        <input className="input" value={value.name} onChange={(e) => update("name", e.target.value)} placeholder="Founder coffee chat" required />
        <textarea
          className="input min-h-24"
          value={value.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="What is happening, who should come, and what people should expect."
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input" value={value.location} onChange={(e) => update("location", e.target.value)} placeholder="Location or room" />
          <input className="input" value={value.event_url} onChange={(e) => update("event_url", e.target.value)} placeholder="Event/registration link" />
          <div>
            <label className="label">Starts</label>
            <input className="input mt-1" type="datetime-local" value={value.starts_at} onChange={(e) => update("starts_at", e.target.value)} />
          </div>
          <div>
            <label className="label">Ends</label>
            <input className="input mt-1" type="datetime-local" value={value.ends_at} onChange={(e) => update("ends_at", e.target.value)} />
          </div>
        </div>
        <textarea
          className="input min-h-20"
          value={value.host_note}
          onChange={(e) => update("host_note", e.target.value)}
          placeholder="Host note: what to bring, icebreakers, speaker info, follow-up instructions..."
        />
        <div className="rounded-lg border border-line p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Useful links</p>
            <button className="btn-soft !h-8 !min-h-8 !px-2" type="button" onClick={() => addLink(editing)}>
              <Plus size={14} />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {value.links.map((link, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                <input className="input" value={link.label} onChange={(e) => updateLink(index, "label", e.target.value, editing)} placeholder="Agenda" />
                <input className="input" value={link.url} onChange={(e) => updateLink(index, "url", e.target.value, editing)} placeholder="https://..." />
                <button
                  className="btn-soft !h-10 !min-h-10 !px-3"
                  type="button"
                  onClick={() => removeLink(index, editing)}
                  disabled={value.links.length === 1}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:ml-52 md:grid-cols-2">
      <section>
        <h1 className="text-3xl font-black tracking-normal">Event Mode</h1>
        <p className="mt-2 text-neutral-600">Set up the room, share context, and turn attendees into warm follow-ups.</p>
      </section>

      <section className="panel md:col-start-1">
        <form onSubmit={createEvent} className="space-y-3">
          <h2 className="font-bold">Create event</h2>
          <EventFields value={form} />
          <button className="btn-primary w-full" disabled={busy}>Create event code</button>
        </form>
      </section>

      <section className="panel h-fit">
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
          {initialJoinCode && <p className="text-xs text-neutral-500">Join code pulled from the shared link.</p>}
          {message && <p className="text-sm text-neutral-600">{message}</p>}
          {error && <p className="text-sm text-coral">{error}</p>}
        </form>
      </section>

      {activeEvent && (
        <section className="panel md:col-span-2">
          {editingEventId === activeEvent.id ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold">Edit event setup</h2>
                <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => setEditingEventId("")} type="button">
                  <X size={14} />
                </button>
              </div>
              <EventFields value={editingForm} editing />
              <button className="btn-primary w-full" onClick={() => saveEventEdit(activeEvent)} type="button">
                Save event
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="label">Active event</p>
                  <div className="mt-2 flex items-center gap-2">
                    <h2 className="text-3xl font-black tracking-normal">{activeEvent.name}</h2>
                    {isHost && (
                      <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => startEditingEvent(activeEvent)} title="Edit event">
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  {activeEvent.description && <p className="mt-3 text-sm leading-6 text-neutral-600">{activeEvent.description}</p>}
                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-neutral-600">
                    {activeEvent.location && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1">
                        <MapPin size={14} />
                        {activeEvent.location}
                      </span>
                    )}
                    {(activeEvent.starts_at || activeEvent.ends_at) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1">
                        <Calendar size={14} />
                        {formatDate(activeEvent.starts_at)}
                        {activeEvent.ends_at ? ` - ${formatDate(activeEvent.ends_at)}` : ""}
                      </span>
                    )}
                    {activeEvent.event_url && (
                      <a className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 font-semibold text-blue" href={activeEvent.event_url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        Event link
                      </a>
                    )}
                  </div>
                  {activeEvent.host_note && (
                    <div className="mt-4 rounded-lg border border-blue/30 bg-mint/60 p-3">
                      <p className="text-sm font-bold">Host note</p>
                      <p className="mt-1 text-sm text-neutral-600">{activeEvent.host_note}</p>
                    </div>
                  )}
                  {activeEvent.links?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeEvent.links.map((link, index) => (
                        <a key={`${link.url}-${index}`} className="btn-soft !h-9 !min-h-9 !px-3" href={link.url} target="_blank" rel="noreferrer">
                          <LinkIcon size={14} />
                          {link.label || "Link"}
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="mt-5 inline-flex rounded-lg bg-ink px-4 py-2 font-mono text-2xl font-black tracking-widest text-white">
                    {activeEvent.code}
                  </p>
                  <p className="mt-3 text-sm text-neutral-500">{activeEvent.attendees.length} attendee(s)</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
                    <div className="w-32 rounded-lg border border-line bg-white p-2">
                      <img
                        className="aspect-square w-full"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=12&data=${encodeURIComponent(activeJoinUrl)}`}
                        alt="Event join QR code"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Room join link</p>
                      <p className="mt-1 break-all text-xs text-neutral-500">{activeJoinUrl}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button className="btn-soft !h-8 !min-h-8 !px-2" onClick={() => copyEventCode(activeEvent)} type="button">
                          <Copy size={13} />
                          Code
                        </button>
                        <button className="btn-soft !h-8 !min-h-8 !px-2" onClick={() => copyEventLink(activeEvent)} type="button">
                          <Share2 size={13} />
                          Link
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => loadRecap(activeEvent)} type="button">
                      Recap
                    </button>
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
                <div className="min-w-64">
                  <p className="text-sm font-bold">Attendees</p>
                  <input className="input mt-2" value={connectNote} onChange={(event) => setConnectNote(event.target.value)} placeholder="Optional connection note" />
                  <div className="mt-2 space-y-2">
                    {(activeEvent.attendee_profiles || []).map((user) => (
                      <div key={user.id} className="rounded-lg border border-line p-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{user.name}</p>
                            <p className="text-xs text-neutral-500">@{user.handle}</p>
                            {user.title && <p className="mt-1 text-xs text-neutral-500">{user.title}</p>}
                          </div>
                          {user.id !== profile.id && (
                            <button className="btn-soft !h-8 !min-h-8 !px-2" onClick={() => connectFromEvent(user.handle, activeEvent)} disabled={connectingHandle === user.handle}>
                              Connect
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {[...(user.open_to || []), ...(user.skills || [])].slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-neutral-600">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {recap?.event.id === activeEvent.id && (
                <div className="mt-5 border-t border-line pt-5">
                  <div className="mb-4 rounded-lg border border-blue/30 bg-mint/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="label">Host outcome report</p>
                        <h3 className="mt-1 text-xl font-black">Proof the room created momentum.</h3>
                        <p className="mt-2 text-sm leading-6 text-neutral-600">{recap.host_summary}</p>
                      </div>
                      <button className="btn-primary !h-9 !min-h-9 shrink-0 !px-3" onClick={() => copyHostReport(recap)} type="button">
                        <Copy size={14} />
                        Copy report
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-lg border border-line p-3"><p className="text-2xl font-black">{recap.attendees_seen}</p><p className="text-xs text-neutral-500">attendees</p></div>
                    <div className="rounded-lg border border-line p-3"><p className="text-2xl font-black">{recap.connections_from_event}</p><p className="text-xs text-neutral-500">event connects</p></div>
                    <div className="rounded-lg border border-line p-3"><p className="text-2xl font-black">{recap.open_followups}</p><p className="text-xs text-neutral-500">open follow-ups</p></div>
                    <div className="rounded-lg border border-line p-3"><p className="text-2xl font-black">{recap.completed_followups}</p><p className="text-xs text-neutral-500">completed</p></div>
                    <div className="rounded-lg border border-line p-3"><p className="text-2xl font-black">{recap.connection_rate}%</p><p className="text-xs text-neutral-500">connect rate</p></div>
                    <div className="rounded-lg border border-line p-3"><p className="text-2xl font-black">{recap.not_connected.length}</p><p className="text-xs text-neutral-500">not connected</p></div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-blue/30 bg-mint/60 p-3">
                      <p className="text-sm font-bold">Suggested next actions</p>
                      <ul className="mt-2 space-y-1 text-sm text-neutral-600">{recap.suggested_actions.map((action) => <li key={action}>{action}</li>)}</ul>
                    </div>
                    <div className="rounded-lg border border-line p-3">
                      <p className="text-sm font-bold">Room energy</p>
                      <div className="mt-2 flex flex-wrap gap-2">{recap.top_terms.map((term) => <span key={term} className="rounded-full border border-line px-2 py-1 text-xs text-neutral-600">{term}</span>)}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="panel md:col-span-2">
        <h2 className="font-bold">My events</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {loading && <p className="text-sm text-neutral-500">Loading events...</p>}
          {!loading && events.length === 0 && <p className="text-sm text-neutral-500">No events yet.</p>}
          {events.map((item) => (
            <button key={item.id} className={`rounded-lg border p-3 text-left ${activeEvent?.id === item.id ? "border-ink bg-paper" : "border-line"}`} onClick={() => setActiveEventId(item.id)} type="button">
              <p className="font-semibold">{item.name}</p>
              <p className="mt-1 font-mono text-sm">{item.code}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {item.attendees.length} attendee(s)
                {item.starts_at ? ` - ${formatDate(item.starts_at)}` : ""}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
