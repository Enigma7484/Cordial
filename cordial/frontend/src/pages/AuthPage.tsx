import { ArrowLeft, ArrowRight, CalendarCheck2, Check, Mail, MessageCircleMore, Moon, Sparkles, Sun, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import BrandMark from "../components/BrandMark";
import { api } from "../lib/api";
import { setToken } from "../lib/auth";

export default function AuthPage({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [dark, setDark] = useState(() => localStorage.getItem("cordial_theme") === "dark");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("cordial_theme", dark ? "dark" : "light");
  }, [dark]);

  async function requestOtp(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await api<{ message: string; dev_otp?: string }>("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setDevOtp(res.dev_otp || "");
      setMessage(`We sent a six-digit code to ${email}.`);
      setCodeSent(true);
      window.setTimeout(() => codeRef.current?.focus(), 50);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not send your code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await api<{ token: string }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setToken(res.token);
      onAuthed();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "That code did not work");
    } finally {
      setBusy(false);
    }
  }

  function resetEmail() {
    setCodeSent(false);
    setCode("");
    setDevOtp("");
    setMessage("");
  }

  return (
    <main className="auth-page">
      <button className="auth-theme-toggle icon-button" onClick={() => setDark(!dark)} title="Toggle theme" type="button">
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <section className="auth-story">
        <div className="auth-brand">
          <BrandMark size="md" />
          <strong>Cordial</strong>
        </div>
        <div className="auth-promise">
          <p className="eyebrow">After the room clears</p>
          <h1>Good conversations deserve a next chapter.</h1>
          <p>Cordial remembers who you met, why it mattered, and the one thing you said you’d do next.</p>
        </div>

        <div className="product-vignette" aria-label="Cordial product preview">
          <div className="vignette-top">
            <span><span className="status-dot" /> Today</span>
            <small>2 open loops</small>
          </div>
          <div className="vignette-person">
            <span className="avatar avatar-warm">MS</span>
            <span>
              <strong>Maya Singh</strong>
              <small>Met at Founder Coffee</small>
            </span>
            <span className="vignette-time">Today</span>
          </div>
          <div className="vignette-action">
            <Check size={16} />
            <span><strong>Send Maya the pilot deck</strong><small>Keep the promise while it’s warm.</small></span>
            <ArrowRight size={17} />
          </div>
          <div className="vignette-path">
            <span><UsersRound size={15} /> Meet</span>
            <i />
            <span><MessageCircleMore size={15} /> Remember</span>
            <i />
            <span><CalendarCheck2 size={15} /> Follow through</span>
          </div>
        </div>
      </section>

      <section className="auth-entry">
        <div className="auth-card">
          <div className="auth-card-heading">
            <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Join Cordial"}</p>
            <h2>{codeSent ? "Check your inbox" : mode === "signin" ? "Pick up where you left off." : "Start with one real connection."}</h2>
            <p>{codeSent ? "Enter the code below. It expires shortly." : "No password to remember. We’ll email you a secure sign-in code."}</p>
          </div>

          {!codeSent && (
            <>
              <div className="segmented auth-segments">
                <button className={`segment ${mode === "signin" ? "segment-active" : ""}`} type="button" onClick={() => setMode("signin")}>Sign in</button>
                <button className={`segment ${mode === "signup" ? "segment-active" : ""}`} type="button" onClick={() => setMode("signup")}>Create account</button>
              </div>
              <form onSubmit={requestOtp} className="form-stack">
                <label>
                  <span className="label">Email address</span>
                  <div className="field-with-icon">
                    <Mail size={18} />
                    <input type="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
                  </div>
                </label>
                <button className="btn-primary auth-submit" disabled={busy || !email}>
                  {busy ? "Sending..." : mode === "signin" ? "Continue with email" : "Create my workspace"}
                  <ArrowRight size={17} />
                </button>
              </form>
            </>
          )}

          {codeSent && (
            <form onSubmit={verifyOtp} className="form-stack">
              <button className="email-back" onClick={resetEmail} type="button"><ArrowLeft size={14} />{email}</button>
              <label>
                <span className="label">Six-digit code</span>
                <input
                  ref={codeRef}
                  className="input otp-input"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
              </label>
              {devOtp && <button className="dev-code" type="button" onClick={() => setCode(devOtp)}><Sparkles size={15} />Use demo code <strong>{devOtp}</strong></button>}
              <button className="btn-primary auth-submit" disabled={busy || code.length !== 6}>
                {busy ? "Opening Cordial..." : mode === "signin" ? "Open my workspace" : "Finish setup"}
                <ArrowRight size={17} />
              </button>
              <button className="text-button" type="button" onClick={() => requestOtp()} disabled={busy}>Send a new code</button>
            </form>
          )}

          {message && <div className={isError ? "auth-message error" : "auth-message"}>{message}</div>}
          <p className="auth-trust"><Check size={14} /> Private by default. Your relationship notes stay yours.</p>
        </div>
      </section>
    </main>
  );
}
