import { Cable, LogOut, MessageSquare, Moon, Settings, Sparkles, Sun, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import BrandMark from "./components/BrandMark";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import ProfilePage from "./pages/ProfilePage";
import EventPage from "./pages/EventPage";
import AsksPage from "./pages/AsksPage";
import PublicProfilePage from "./pages/PublicProfilePage";
import ConnectionPage from "./pages/ConnectionPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import SettingsPage from "./pages/SettingsPage";
import { api, Profile } from "./lib/api";
import { clearToken, getToken } from "./lib/auth";
import { AppPreferences, loadPreferences, savePreferences } from "./lib/preferences";

type Page = "home" | "profile" | "events" | "asks" | "integrations" | "settings" | "connection";

const nav = [
  { id: "home", label: "Home", icon: Sparkles },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "events", label: "Events", icon: UsersRound },
  { id: "asks", label: "Signals", icon: MessageSquare },
  { id: "integrations", label: "Connections", icon: Cable },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [activeConnectionId, setActiveConnectionId] = useState("");
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [publicHandle, setPublicHandle] = useState(() => {
    const match = window.location.hash.match(/^#\/u\/([a-zA-Z0-9_]+)/);
    return match?.[1] || "";
  });
  const [joinCodeFromHash, setJoinCodeFromHash] = useState(() => {
    const match = window.location.hash.match(/^#\/join\/([a-zA-Z0-9]+)/);
    return match?.[1]?.toUpperCase() || "";
  });

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
    function syncHash() {
      const profileMatch = window.location.hash.match(/^#\/u\/([a-zA-Z0-9_]+)/);
      const joinMatch = window.location.hash.match(/^#\/join\/([a-zA-Z0-9]+)/);
      setPublicHandle(profileMatch?.[1] || "");
      setJoinCodeFromHash(joinMatch?.[1]?.toUpperCase() || "");
      if (joinMatch) setPage("events");
    }
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    if (profile && joinCodeFromHash) setPage("events");
  }, [profile, joinCodeFromHash]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", preferences.theme !== "light");
    document.documentElement.classList.toggle("theme-aurora", preferences.theme === "aurora");
    document.documentElement.classList.toggle("density-compact", preferences.density === "compact");
    document.documentElement.classList.toggle("motion-expressive", preferences.motion === "expressive");
    savePreferences(preferences);
  }, [preferences]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm">Loading Cordial...</div>;
  }

  if (publicHandle) {
    return <PublicProfilePage handle={publicHandle} />;
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
            <button
              className="btn-soft !h-9 !min-h-9 !px-3"
              onClick={() => setPreferences({ ...preferences, theme: preferences.theme === "light" ? "dark" : "light" })}
              title="Toggle theme"
            >
              {preferences.theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button className="btn-soft !h-9 !min-h-9 !px-3" onClick={() => setPage("settings")} title="Settings">
              <Settings size={16} />
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
        {page === "home" && (
          <Home
            profile={profile}
            onOpenConnection={(connectionId) => {
              setActiveConnectionId(connectionId);
              setPage("connection");
            }}
          />
        )}
        {page === "profile" && <ProfilePage profile={profile} onSaved={setProfile} />}
        {page === "events" && <EventPage profile={profile} initialJoinCode={joinCodeFromHash} />}
        {page === "asks" && <AsksPage profile={profile} />}
        {page === "integrations" && <IntegrationsPage preferences={preferences} onChange={setPreferences} />}
        {page === "settings" && <SettingsPage preferences={preferences} onChange={setPreferences} />}
        {page === "connection" && activeConnectionId && <ConnectionPage connectionId={activeConnectionId} onBack={() => setPage("home")} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-white md:hidden">
        <div className="grid grid-cols-6">
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
