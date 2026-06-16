import { Copy, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import ProfileForm from "../components/ProfileForm";
import { Profile } from "../lib/api";

function Tags({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-line px-3 py-1 text-xs text-neutral-700">
          {item}
        </span>
      ))}
    </div>
  );
}

function strength(profile: Profile) {
  const checks = [
    Boolean(profile.title),
    Boolean(profile.bio),
    profile.skills?.length >= 3,
    profile.open_to?.length >= 2,
    profile.interests?.length >= 2,
    profile.projects?.length > 0,
    profile.links?.length > 0,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const missing = [
    !profile.title && "title",
    !profile.bio && "bio",
    !(profile.skills?.length >= 3) && "three skills",
    !(profile.open_to?.length >= 2) && "open-to tags",
    !(profile.projects?.length > 0) && "featured project",
  ].filter(Boolean) as string[];
  return { score, missing };
}

export default function ProfilePage({ profile, onSaved }: { profile: Profile; onSaved: (profile: Profile) => void }) {
  const [shareMessage, setShareMessage] = useState("");
  const publicUrl = `${window.location.origin}${window.location.pathname}#/u/${profile.handle}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=16&data=${encodeURIComponent(publicUrl)}`;
  const profileStrength = strength(profile);

  async function copyShareUrl() {
    await navigator.clipboard.writeText(publicUrl);
    setShareMessage("Public profile link copied.");
  }

  return (
    <div className="grid gap-5 md:ml-52">
      <section>
        <h1 className="text-3xl font-black tracking-normal">Profile</h1>
        <p className="mt-2 text-neutral-600">One identity, two modes: crisp when it matters, human all the time.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary !h-9 !min-h-9 !px-3" onClick={copyShareUrl} type="button">
            <Copy size={14} />
            Copy public profile
          </button>
          <a className="btn-soft !h-9 !min-h-9 !px-3" href={`#/u/${profile.handle}`} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
            Preview
          </a>
        </div>
        {shareMessage && <p className="mt-2 text-sm text-neutral-600">{shareMessage}</p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
            <div className="w-44 rounded-lg border border-line bg-white p-3">
              <img className="aspect-square w-full" src={qrUrl} alt="Public profile QR code" />
            </div>
            <div>
              <p className="label">Room-ready share card</p>
              <h2 className="mt-1 text-2xl font-black">Let people save you without the social-media shuffle.</h2>
              <p className="mt-2 break-all text-sm text-neutral-600">{publicUrl}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary !h-9 !min-h-9 !px-3" onClick={copyShareUrl} type="button">
                  <Copy size={14} />
                  Copy link
                </button>
                <a className="btn-soft !h-9 !min-h-9 !px-3" href={qrUrl} download={`cordial-${profile.handle}-qr.png`}>
                  <Download size={14} />
                  QR image
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="panel lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label">Profile strength</p>
              <h2 className="mt-1 text-2xl font-black">{profileStrength.score}% ready</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {profileStrength.missing.length ? `Add ${profileStrength.missing.join(", ")} before sharing widely.` : "Strong enough to share after a real conversation."}
              </p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-paper sm:w-64">
              <div className="h-full rounded-full bg-coral" style={{ width: `${profileStrength.score}%` }} />
            </div>
          </div>
        </div>
        <div className="panel">
          <p className="label">Formal</p>
          <h2 className="mt-2 text-2xl font-black">{profile.name}</h2>
          <p className="text-neutral-600">@{profile.handle}</p>
          <p className="mt-3 font-semibold">{profile.title || "Add a title"}</p>
          <p className="mt-2 text-sm text-neutral-600">{profile.bio || "Add a short profile note."}</p>
          <div className="mt-4">
            <Tags items={profile.skills || []} />
          </div>
          {profile.projects?.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold">Projects</p>
              {profile.projects.map((project, index) => (
                <div key={`${project.title}-${index}`} className="rounded-lg border border-line p-3">
                  <p className="font-semibold">{project.title || "Untitled project"}</p>
                  {project.description && <p className="mt-1 text-sm text-neutral-600">{project.description}</p>}
                  {project.url && (
                    <a className="mt-2 inline-flex text-sm font-semibold text-blue" href={project.url} target="_blank" rel="noreferrer">
                      View project
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <p className="label">Casual</p>
          <h2 className="mt-2 text-xl font-black">Actually useful context</h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Interests</p>
              <Tags items={profile.interests || []} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Open to</p>
              <Tags items={profile.open_to || []} />
            </div>
          </div>
          {profile.links?.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold">Links</p>
              <div className="flex flex-wrap gap-2">
                {profile.links.map((link, index) => (
                  <a
                    key={`${link.url}-${index}`}
                    className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-neutral-700"
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label || "Link"}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <ProfileForm profile={profile} onSaved={onSaved} />
      </section>
    </div>
  );
}
