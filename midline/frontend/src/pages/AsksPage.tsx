import { useEffect, useState } from "react";
import AskComposer from "../components/AskComposer";
import AskList from "../components/AskList";
import { api, Ask } from "../lib/api";

export default function AsksPage() {
  const [asks, setAsks] = useState<Ask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAsks() {
    setError("");
    try {
      setAsks(await api<Ask[]>("/asks"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load signals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAsks();
  }, []);

  return (
    <div className="grid gap-5 md:ml-52 md:grid-cols-[0.9fr_1.1fr]">
      <section>
        <h1 className="text-3xl font-black tracking-normal">Signals</h1>
        <p className="mt-2 text-neutral-600">Small asks and offers that make reconnecting less awkward.</p>
        <div className="mt-5">
          <AskComposer onCreated={(ask) => setAsks((current) => [ask, ...current])} />
        </div>
      </section>
      <section>
        {loading && <div className="panel text-sm text-neutral-500">Loading signals...</div>}
        {error && <div className="panel text-sm text-coral">{error}</div>}
        {!loading && !error && <AskList asks={asks} />}
      </section>
    </div>
  );
}
