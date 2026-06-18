import { ArrowRight, Mail, Moon, Sparkles, Sun } from "lucide-react";
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [dark, setDark] = useState(() => localStorage.getItem("cordial_theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("cordial_theme", dark ? "dark" : "light");
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

      <section className="grid w-full max-w-6xl gap-8 md:grid-cols-[0.9fr_1fr] md:items-center">
        <div>
          <BrandMark size="lg" />
          <h1 className="mt-6 text-5xl font-black tracking-normal md:text-6xl">Cordial</h1>
          <p className="mt-3 text-xl font-semibold text-neutral-700">The follow-up layer for real-world communities.</p>
          <p className="mt-5 max-w-sm text-sm leading-6 text-neutral-600">
            A cleaner way to keep the thread after a real conversation: campus events, coffee chats,
            warm intros, small asks, and the follow-up you actually meant to send.
          </p>

          <div className="mt-8 grid max-w-md grid-cols-2 gap-3 text-xs font-semibold">
            <span className="auth-chip">QR profiles</span>
            <span className="auth-chip">Event rooms</span>
            <span className="auth-chip">Follow-up OS</span>
            <span className="auth-chip">Host reports</span>
          </div>
        </div>

        <div className="panel p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="label">{mode === "signin" ? "Welcome back" : "Start your profile"}</p>
              <h2 className="mt-1 text-2xl font-black">{mode === "signin" ? "Sign in" : "Create account"}</h2>
              <p className="mt-1 text-xs text-neutral-500">
                {mode === "signin" ? "Use your email code to return." : "New emails create a Cordial profile automatically."}
              </p>
            </div>
            <span className="rounded-full border border-line px-3 py-1 text-xs text-neutral-500">{API_URL}</span>
          </div>
          <div className="segmented mb-5">
            <button className={`segment ${mode === "signin" ? "segment-active" : ""}`} type="button" onClick={() => setMode("signin")}>
              Sign in
            </button>
            <button className={`segment ${mode === "signup" ? "segment-active" : ""}`} type="button" onClick={() => setMode("signup")}>
              Sign up
            </button>
          </div>
          <form onSubmit={requestOtp} className="space-y-3">
            <label className="label" htmlFor="email">
              Email
            </label>
            <div className="flex gap-2">
              <input
                id="email"
                className="input"
                type="text"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@school.edu"
                required
              />
              <button className="btn-primary shrink-0" disabled={busy}>
                <Mail size={16} />
                Send code
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
              {mode === "signin" ? "Sign in" : "Create profile"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-5 rounded-lg border border-blue/30 bg-mint/50 p-3">
            <div className="flex gap-2">
              <Sparkles className="mt-0.5 text-blue" size={16} />
              <p className="text-sm text-neutral-600">
                Passwordless by design. The same OTP flow handles login and signup so event join is fast on mobile.
              </p>
            </div>
          </div>

          {message && <p className="mt-4 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-neutral-600">{message}</p>}
        </div>
      </section>
    </main>
  );
}
