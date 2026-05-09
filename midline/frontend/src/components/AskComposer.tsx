import { Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, Ask } from "../lib/api";

function splitTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AskComposer({ onCreated }: { onCreated: (ask: Ask) => void }) {
  const [type, setType] = useState<"ask" | "offer">("ask");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const ask = await api<Ask>("/asks", {
        method: "POST",
        body: JSON.stringify({ type, text, tags: splitTags(tags) }),
      });
      onCreated(ask);
      setText("");
      setTags("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-paper p-1">
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-semibold ${type === "ask" ? "bg-white shadow-sm" : ""}`}
          onClick={() => setType("ask")}
        >
          Ask
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-semibold ${type === "offer" ? "bg-white shadow-sm" : ""}`}
          onClick={() => setType("offer")}
        >
          Offer
        </button>
      </div>
      <textarea
        className="input min-h-24"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={type === "ask" ? "Looking for someone to review my resume" : "Offering mock interview practice this weekend"}
        maxLength={240}
        required
      />
      <input
        className="input"
        value={tags}
        onChange={(event) => setTags(event.target.value)}
        placeholder="resume, pm, design"
      />
      <button className="btn-primary w-full" disabled={busy}>
        <Send size={16} />
        {busy ? "Posting..." : "Post signal"}
      </button>
      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </form>
  );
}
