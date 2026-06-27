import { ArrowRight, Handshake, Search, Sparkles, UserPlus, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, Connection } from "../lib/api";

export default function PeoplePage({ onOpenConnection }: { onOpenConnection: (connectionId: string) => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [query, setQuery] = useState("");
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadConnections() {
    setError("");
    try {
      setConnections(await api<Connection[]>("/connections/mine"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load people");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return connections;
    return connections.filter((connection) => {
      const person = connection.other_user;
      return [person?.name, person?.handle, person?.title, connection.note, connection.event_name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  }, [connections, query]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const created = await api<Connection>(`/connections/connect/${handle}`, {
        method: "POST",
        body: JSON.stringify({ note, event: "", event_id: "" }),
      });
      setConnections((current) => {
        const exists = current.some((item) => item.id === created.id);
        return exists ? current.map((item) => (item.id === created.id ? created : item)) : [created, ...current];
      });
      setHandle("");
      setNote("");
      setMessage(`@${created.other_user?.handle || handle} is now in your circle.`);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Could not connect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro compact-intro">
        <div>
          <p className="eyebrow">Your circle</p>
          <h2>Remember the person, the context, and what comes next.</h2>
          <p>Every connection stays anchored to where you met and the promise you made.</p>
        </div>
        <div className="intro-stat">
          <UsersRound size={20} />
          <strong>{connections.length}</strong>
          <span>people</span>
        </div>
      </section>

      <div className="people-layout">
        <section className="surface people-directory">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Relationship memory</p>
              <h3>Your people</h3>
            </div>
            <label className="search-field">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people or context" />
            </label>
          </div>

          {loading && <div className="quiet-state">Loading your circle...</div>}
          {!loading && connections.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon"><Handshake size={24} /></span>
              <h3>Your first warm connection starts here.</h3>
              <p>Add someone by their Cordial handle. A useful note now saves an awkward “how did we meet?” later.</p>
            </div>
          )}
          {!loading && connections.length > 0 && filtered.length === 0 && <div className="quiet-state">No one matches that search.</div>}

          <div className="people-list">
            {filtered.map((connection) => {
              const person = connection.other_user;
              const initials = (person?.name || person?.handle || "C")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <button className="person-row" key={connection.id} onClick={() => onOpenConnection(connection.id)} type="button">
                  <span className="avatar">{initials}</span>
                  <span className="person-copy">
                    <strong>{person?.name || "Cordial connection"}</strong>
                    <small>@{person?.handle || "unknown"}{person?.title ? ` · ${person.title}` : ""}</small>
                    <span>{connection.note || (connection.event_context ? `Met at ${connection.event_context.name}` : "Add a note to remember the moment.")}</span>
                  </span>
                  <span className="person-context">
                    {connection.event_context && <small>{connection.event_context.name}</small>}
                    <ArrowRight size={18} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="surface add-person-panel">
          <div className="section-icon"><UserPlus size={19} /></div>
          <p className="eyebrow">Add someone</p>
          <h3>Keep the thread warm.</h3>
          <p className="section-description">Use their handle and capture the detail your future self will thank you for.</p>
          <form onSubmit={connect} className="form-stack">
            <label>
              <span className="label">Cordial handle</span>
              <div className="handle-field"><span>@</span><input value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/^@/, ""))} placeholder="maya" required /></div>
            </label>
            <label>
              <span className="label">Memory note</span>
              <textarea className="input min-h-24" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Met after the founder panel. Talked about community-led growth." />
            </label>
            <button className="btn-primary w-full" disabled={busy}>
              <UserPlus size={16} />
              {busy ? "Adding..." : "Add to my circle"}
            </button>
          </form>
          {message && <div className="success-note"><Sparkles size={16} />{message}</div>}
          {error && <div className="error-note">{error}</div>}
        </aside>
      </div>
    </div>
  );
}
