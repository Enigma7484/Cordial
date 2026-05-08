import { Mail, Moon, Sun } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { api, API_URL } from "../lib/api";
import { setToken } from "../lib/auth";

export default function AuthPage({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("midline_theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("midline_theme", dark ? "dark" : "light");
  }, [dark]);

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await api<{ message: string; dev_otp?: string }>("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setDevOtp(res.dev_otp || "");
      setMessage(res.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request OTP");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await api<{ token: string }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setToken(res.token);
      onAuthed();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell grid min-h-screen place-items-center bg-paper px-4 py-8">
      <button className="btn-soft fixed right-4 top-4 !h-10 !min-h-10 !px-3" onClick={() => setDark(!dark)} title="Toggle dark mode">
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <section className="grid w-full max-w-5xl gap-8 md:grid-cols-[0.9fr_1fr] md:items-center">
        <div>
          <BrandMark size="lg" />
          <h1 className="mt-6 text-5xl font-black tracking-normal md:text-6xl">Midline</h1>
          <p className="mt-3 text-xl font-semibold text-neutral-700">Make plans, not pings.</p>
          <p className="mt-5 max-w-sm text-sm leading-6 text-neutral-600">
            A cleaner way to keep the thread after a real conversation: campus events, coffee chats,
            warm intros, small asks, and the follow-up you actually meant to send.
          </p>

          <div className="mt-8 grid max-w-sm grid-cols-3 gap-2 text-xs font-semibold">
            <span className="rounded-lg border border-line bg-white/80 px-3 py-3 text-center">Profiles</span>
            <span className="rounded-lg border border-line bg-white/80 px-3 py-3 text-center">Events</span>
            <span className="rounded-lg border border-line bg-white/80 px-3 py-3 text-center">Signals</span>
          </div>
        </div>

        <div className="panel p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Sign in</h2>
              <p className="mt-1 text-xs text-neutral-500">Dev OTP is shown after request.</p>
            </div>
            <span className="rounded-full border border-line px-3 py-1 text-xs text-neutral-500">{API_URL}</span>
          </div>
          <form onSubmit={requestOtp} className="space-y-3">
            <label className="label" htmlFor="email">
              Email
            </label>
            <div className="flex gap-2">
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@school.edu"
                required
              />
              <button className="btn-primary shrink-0" disabled={busy}>
                <Mail size={16} />
                OTP
              </button>
            </div>
          </form>

          {devOtp && (
            <div className="mt-4 rounded-lg border border-mint bg-mint/40 p-3 text-sm">
              Dev OTP: <strong>{devOtp}</strong>
            </div>
          )}

          <form onSubmit={verifyOtp} className="mt-5 space-y-3">
            <label className="label" htmlFor="code">
              6-digit code
            </label>
            <input
              id="code"
              className="input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              maxLength={6}
              required
            />
            <button className="btn-primary w-full" disabled={busy || !email || code.length !== 6}>
              Continue
            </button>
          </form>

          {message && <p className="mt-4 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-neutral-600">{message}</p>}
        </div>
      </section>
    </main>
  );
}
