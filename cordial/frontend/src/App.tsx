import {
  AppWindow,
  CalendarDays,
  ChevronDown,
  Home as HomeIcon,
  LogOut,
  MessageCircleMore,
  Moon,
  Settings,
  Sun,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import BrandMark from "./components/BrandMark";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import ProfilePage from "./pages/ProfilePage";
import EventPage from "./pages/EventPage";
import AsksPage from "./pages/AsksPage";
import PublicProfilePage from "./pages/PublicProfilePage";
import ConnectionPage from "./pages/ConnectionPage";
import PeoplePage from "./pages/PeoplePage";
import IntegrationsPage from "./pages/IntegrationsPage";
import SettingsPage from "./pages/SettingsPage";
import { api, Profile } from "./lib/api";
import { clearToken, getToken } from "./lib/auth";
import { AppPreferences, loadPreferences, savePreferences } from "./lib/preferences";

type Page = "home" | "people" | "events" | "asks" | "apps" | "profile" | "settings" | "connection";

const nav = [
  { id: "home", label: "Today", icon: HomeIcon },
  { id: "people", label: "People", icon: UsersRound },
  { id: "events", label: "Rooms", icon: CalendarDays },
  { id: "asks", label: "Signals", icon: MessageCircleMore },
  { id: "apps", label: "Apps", icon: AppWindow },
] as const;

const pageMeta: Record<Page, { eyebrow: string; title: string }> = {
  home: { eyebrow: "Your workspace", title: "Today" },
  people: { eyebrow: "Relationship memory", title: "People" },
  events: { eyebrow: "Shared context", title: "Rooms" },
  asks: { eyebrow: "Community exchange", title: "Signals" },
  apps: { eyebrow: "Connected tools", title: "Apps" },
  profile: { eyebrow: "Your identity", title: "Profile" },
  settings: { eyebrow: "Your Cordial", title: "Settings" },
  connection: { eyebrow: "Relationship detail", title: "Connection" },
};

function pageFromHash(): Page {
  const match = window.location.hash.match(/^#\/(home|people|events|asks|apps|profile|settings)$/);
  return (match?.[1] as Page) || "home";
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [page, setPageState] = useState<Page>(() => pageFromHash());
  const [activeConnectionId, setActiveConnectionId] = useState("");
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [accountOpen, setAccountOpen] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [publicHandle, setPublicHandle] = useState(() => {
    const match = window.location.hash.match(/^#\/u\/([a-zA-Z0-9_]+)/);
    return match?.[1] || "";
  });
  const [joinCodeFromHash, setJoinCodeFromHash] = useState(() => {
    const match = window.location.hash.match(/^#\/join\/([a-zA-Z0-9]+)/);
    return match?.[1]?.toUpperCase() || "";
  });

  const initials = useMemo(
    () =>
      (profile?.name || profile?.handle || "C")
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [profile],
  );

  function setPage(nextPage: Page) {
    setPageState(nextPage);
    setAccountOpen(false);
    if (nextPage !== "connection") window.location.hash = `/${nextPage}`;
  }

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
      const appMatch = window.location.hash.match(/^#\/(home|people|events|asks|apps|profile|settings)$/);
      setPublicHandle(profileMatch?.[1] || "");
      setJoinCodeFromHash(joinMatch?.[1]?.toUpperCase() || "");
      if (joinMatch) setPageState("events");
      if (appMatch) setPageState(appMatch[1] as Page);
    }
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    if (profile && joinCodeFromHash) setPageState("events");
  }, [profile, joinCodeFromHash]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", preferences.theme === "dark");
    document.documentElement.classList.toggle("theme-aurora", preferences.theme === "aurora");
    document.documentElement.classList.toggle("density-compact", preferences.density === "compact");
    document.documentElement.classList.toggle("motion-expressive", preferences.motion === "expressive");
    savePreferences(preferences);
  }, [preferences]);

  if (loading) {
    return (
      <div className="app-loading">
        <BrandMark size="md" />
        <p>Opening your Cordial workspace...</p>
      </div>
    );
  }

  if (publicHandle) return <PublicProfilePage handle={publicHandle} />;
  if (!profile) return <AuthPage onAuthed={loadProfile} />;

  const meta = pageMeta[page];

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <button className="brand-lockup" onClick={() => setPage("home")} type="button">
          <BrandMark size="sm" />
          <span>
            <strong>Cordial</strong>
            <small>Keep the thread.</small>
          </span>
        </button>

        <nav className="side-nav" aria-label="Main navigation">
          <p className="side-nav-label">Workspace</p>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={page === item.id || (page === "connection" && item.id === "people") ? "side-nav-item active" : "side-nav-item"}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-nudge">
            <span className="status-dot" />
            <p><strong>Make it specific.</strong><br />One name. One next move.</p>
          </div>
          <button className="sidebar-profile" onClick={() => setPage("profile")} type="button">
            <span className="avatar">{initials}</span>
            <span className="min-w-0 flex-1 text-left">
              <strong>{profile.name || profile.handle}</strong>
              <small>@{profile.handle}</small>
            </span>
            <UserRound size={16} />
          </button>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <div>
            <p>{meta.eyebrow}</p>
            <h1>{meta.title}</h1>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => setPreferences({ ...preferences, theme: preferences.theme === "light" ? "dark" : "light" })}
              title="Toggle theme"
              type="button"
            >
              {preferences.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="account-menu-wrap">
              <button className="account-trigger" onClick={() => setAccountOpen(!accountOpen)} type="button" aria-expanded={accountOpen}>
                <span className="avatar avatar-small">{initials}</span>
                <span className="hidden sm:block">@{profile.handle}</span>
                <ChevronDown size={15} />
              </button>
              {accountOpen && (
                <div className="account-menu">
                  <button onClick={() => setPage("profile")} type="button"><UserRound size={16} /> Profile</button>
                  <button onClick={() => setPage("apps")} type="button"><AppWindow size={16} /> Connected apps</button>
                  <button onClick={() => setPage("settings")} type="button"><Settings size={16} /> Settings</button>
                  <button
                    onClick={() => {
                      clearToken();
                      setProfile(null);
                      setAccountOpen(false);
                    }}
                    type="button"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="app-content">
          {page === "home" && (
            <Home
              profile={profile}
              onOpenConnection={(connectionId) => {
                setActiveConnectionId(connectionId);
                setPageState("connection");
              }}
            />
          )}
          {page === "people" && (
            <PeoplePage
              onOpenConnection={(connectionId) => {
                setActiveConnectionId(connectionId);
                setPageState("connection");
              }}
            />
          )}
          {page === "profile" && <ProfilePage profile={profile} onSaved={setProfile} />}
          {page === "events" && <EventPage profile={profile} initialJoinCode={joinCodeFromHash} />}
          {page === "asks" && <AsksPage profile={profile} />}
          {page === "apps" && <IntegrationsPage preferences={preferences} onChange={setPreferences} />}
          {page === "settings" && <SettingsPage preferences={preferences} onChange={setPreferences} />}
          {page === "connection" && activeConnectionId && <ConnectionPage connectionId={activeConnectionId} onBack={() => setPage("people")} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = page === item.id || (page === "connection" && item.id === "people");
          return (
            <button key={item.id} onClick={() => setPage(item.id)} className={active ? "active" : ""} type="button">
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
