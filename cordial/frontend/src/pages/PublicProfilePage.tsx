import { ArrowLeft, ExternalLink, Handshake } from "lucide-react";
import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { api, PublicUser } from "../lib/api";

function Tags({ items }: { items?: string[] }) {
  if (!items?.length) return null;
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

export default function PublicProfilePage({ handle }: { handle: string }) {
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setError("");
      try {
        setProfile(await api<PublicUser>(`/profile/${handle}`));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load profile");
      }
    }
    loadProfile();
  }, [handle]);

  return (
    <main className="min-h-screen bg-paper px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <a className="btn-soft !h-9 !min-h-9 !px-3" href="#">
          <ArrowLeft size={14} />
          Back to Cordial
        </a>
        <section className="mt-6 panel">
          {error && <p className="text-sm text-coral">{error}</p>}
          {!profile && !error && <p className="text-sm text-neutral-500">Loading profile...</p>}
          {profile && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <BrandMark size="md" />
                  <h1 className="mt-5 text-4xl font-black tracking-normal">{profile.name}</h1>
                  <p className="mt-1 text-neutral-600">@{profile.handle}</p>
                  <p className="mt-3 text-xl font-bold">{profile.title || "Open to connecting"}</p>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{profile.bio || "Cordial profile"}</p>
                </div>
                <div className="hidden rounded-lg border border-line bg-mint/60 p-3 text-sm font-semibold md:block">
                  Make plans, not pings.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-line p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Handshake size={16} />
                    Can talk about
                  </p>
                  <Tags items={profile.skills} />
                </div>
                <div className="rounded-lg border border-line p-4">
                  <p className="mb-3 text-sm font-bold">Open to</p>
                  <Tags items={profile.open_to} />
                </div>
              </div>

              {profile.projects?.length ? (
                <section>
                  <h2 className="text-sm font-bold">Projects</h2>
                  <div className="mt-3 grid gap-3">
                    {profile.projects.map((project, index) => (
                      <a
                        key={`${project.title}-${index}`}
                        className="rounded-lg border border-line p-4 transition hover:bg-paper"
                        href={project.url || undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <p className="font-bold">{project.title || "Project"}</p>
                        {project.description && <p className="mt-1 text-sm text-neutral-600">{project.description}</p>}
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              {profile.links?.length ? (
                <section>
                  <h2 className="text-sm font-bold">Links</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.links.map((link, index) => (
                      <a key={`${link.url}-${index}`} className="btn-soft !h-9 !min-h-9 !px-3" href={link.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        {link.label || "Link"}
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
