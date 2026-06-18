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
    <div className="grid gap-5 md:ml-52">
      <section className="experience-hero">
        <div>
          <p className="label">Connections</p>
          <h1 className="mt-2 text-4xl font-black tracking-normal">Connect Cordial to the tools people already use.</h1>
          <p className="mt-3 max-w-2xl text-neutral-600">
            These are demo-ready preference toggles for now. They show the product direction without pretending OAuth is wired yet.
          </p>
        </div>
        <a className="btn-primary !h-10 !min-h-10 !px-3" href="#/u/demo" onClick={(event) => event.preventDefault()}>
          <ExternalLink size={15} />
          API roadmap
        </a>
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
                <span className={`status-pill ${connected ? "status-pill-on" : ""}`}>{connected ? "Ready" : "Planned"}</span>
              </div>
              <h2 className="mt-5 text-xl font-black">{integration.name}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{integration.detail}</p>
              <button className="btn-soft mt-5 w-full" type="button" onClick={() => toggle(integration.id)}>
                {connected && <Check size={15} />}
                {connected ? "Marked ready" : "Mark as priority"}
              </button>
            </div>
          );
        })}
      </section>

      <section className="panel">
        <h2 className="font-bold">Integration order for a serious MVP</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="feature-tile">1. Calendar scheduling</div>
          <div className="feature-tile">2. Email follow-up drafts</div>
          <div className="feature-tile">3. Host recap export</div>
          <div className="feature-tile">4. Community chat handoff</div>
        </div>
      </section>
    </div>
  );
}
