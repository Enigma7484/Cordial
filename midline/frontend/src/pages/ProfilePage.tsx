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
        </div>
      </section>

      <section className="panel">
        <ProfileForm profile={profile} onSaved={onSaved} />
      </section>
    </div>
  );
}
