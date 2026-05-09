import { LogOut, MessageSquare, Moon, Sparkles, Sun, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import BrandMark from "./components/BrandMark";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import ProfilePage from "./pages/ProfilePage";
import EventPage from "./pages/EventPage";
import AsksPage from "./pages/AsksPage";
import { api, Profile } from "./lib/api";
import { clearToken, getToken } from "./lib/auth";

type Page = "home" | "profile" | "events" | "asks";

const nav = [
  { id: "home", label: "Home", icon: Sparkles },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "events", label: "Events", icon: UsersRound },
  { id: "asks", label: "Signals", icon: MessageSquare },
] as const;

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [dark, setDark] = useState(() => localStorage.getItem("cordial_theme") === "dark");

  async function loadProfile() {
    setLoading(true);
    try {
      const me = await api<Profile>("/profile/me");
      setProfile(me);
    } catch {
      clearToken();
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (getToken()) loadProfile();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("cordial_theme", dark ? "dark" : "light");
  }, [dark]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm">Loading Cordial...</div>;
  }

  if (!profile) {
    return <AuthPage onAuthed={loadProfile} />;
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button className="flex items-center gap-2 text-left" onClick={() => setPage("home")}>
            <BrandMark size="sm" />
            <span>
              <span className="block text-sm font-bold">Cordial</span>
              <span className="block text-xs text-neutral-500">Make plans, not pings.</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => setDark(!dark)} title="Toggle dark mode">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="btn-soft !h-9 !min-h-9 !px-3"
              onClick={() => {
                clearToken();
                setProfile(null);
              }}
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 pb-24">
        {page === "home" && <Home profile={profile} />}
        {page === "profile" && <ProfilePage profile={profile} onSaved={setProfile} />}
        {page === "events" && <EventPage profile={profile} />}
        {page === "asks" && <AsksPage profile={profile} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-white md:hidden">
        <div className="grid grid-cols-4">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 text-xs ${
                  page === item.id ? "text-ink" : "text-neutral-400"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <aside className="fixed left-4 top-24 hidden w-44 rounded-lg border border-line bg-white p-2 shadow-soft md:block">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                page === item.id ? "bg-ink text-white" : "text-neutral-600 hover:bg-paper"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </aside>
    </div>
  );
}
