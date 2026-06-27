import { CalendarDays, Check, ExternalLink, Link2, Mail, MessageSquare, UsersRound } from "lucide-react";
import { AppPreferences } from "../lib/preferences";

const integrations = [
  { id: "google", name: "Gmail", detail: "Turn follow-ups into email drafts.", icon: Mail },
  { id: "calendar", name: "Google Calendar", detail: "Schedule coffee chats from a connection.", icon: CalendarDays },
  { id: "linkedin", name: "LinkedIn", detail: "Attach a professional identity without becoming LinkedIn.", icon: UsersRound },
  { id: "discord", name: "Discord", detail: "Bring community context into event rooms.", icon: MessageSquare },
  { id: "notion", name: "Notion", detail: "Export host recaps and pilot notes.", icon: Link2 },
  { id: "slack", name: "Slack", detail: "Post event outcomes to organizer channels.", icon: MessageSquare },
];

export default function IntegrationsPage({
  preferences,
  onChange,
}: {
  preferences: AppPreferences;
  onChange: (preferences: AppPreferences) => void;
}) {
  function toggle(id: string) {
    onChange({
      ...preferences,
      integrations: { ...preferences.integrations, [id]: !preferences.integrations[id] },
    });
  }

  return (
    <div className="grid gap-5">
      <section className="experience-hero">
        <div>
          <p className="label">Your workflow</p>
          <h1 className="mt-2 text-4xl font-black tracking-normal">Cordial should meet you where follow-through happens.</h1>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Choose the tools you want first. We’ll keep your priorities here as each connection becomes available.
          </p>
        </div>
        <div className="hero-signal"><ExternalLink size={18} /><span>Your preferred stack</span></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const connected = Boolean(preferences.integrations[integration.id]);
          return (
            <div key={integration.id} className={`integration-card ${connected ? "integration-card-active" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="integration-icon">
                  <Icon size={20} />
                </div>
                <span className={`status-pill ${connected ? "status-pill-on" : ""}`}>{connected ? "Requested" : "Coming soon"}</span>
              </div>
              <h2 className="mt-5 text-xl font-black">{integration.name}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{integration.detail}</p>
              <button className="btn-soft mt-5 w-full" type="button" onClick={() => toggle(integration.id)}>
                {connected && <Check size={15} />}
                {connected ? "Priority saved" : "I want this"}
              </button>
            </div>
          );
        })}
      </section>

      <section className="panel">
        <h2 className="font-bold">How your stack will work together</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="feature-tile">Schedule the next conversation</div>
          <div className="feature-tile">Draft the promised email</div>
          <div className="feature-tile">Share a room recap</div>
          <div className="feature-tile">Bring context back to community</div>
        </div>
      </section>
    </div>
  );
}
