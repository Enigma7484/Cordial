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

export default function ProfilePage({ profile, onSaved }: { profile: Profile; onSaved: (profile: Profile) => void }) {
  return (
    <div className="grid gap-5 md:ml-52">
      <section>
        <h1 className="text-3xl font-black tracking-normal">Profile</h1>
        <p className="mt-2 text-neutral-600">One identity, two modes: crisp when it matters, human all the time.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
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
