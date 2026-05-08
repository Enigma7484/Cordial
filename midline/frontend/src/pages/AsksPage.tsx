import { useEffect, useState } from "react";
import AskComposer from "../components/AskComposer";
import AskList from "../components/AskList";
import { api, Ask } from "../lib/api";

export default function AsksPage() {
  const [asks, setAsks] = useState<Ask[]>([]);

  async function loadAsks() {
    setAsks(await api<Ask[]>("/asks"));
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
        <AskList asks={asks} />
      </section>
    </div>
  );
}
