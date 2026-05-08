import { FormEvent, useState } from "react";
import { api, Profile } from "../lib/api";

function splitTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: (profile: Profile) => void }) {
  const [form, setForm] = useState({
    name: profile.name || "",
    handle: profile.handle || "",
    title: profile.title || "",
    bio: profile.bio || "",
    skills: profile.skills?.join(", ") || "",
    interests: profile.interests?.join(", ") || "",
    open_to: profile.open_to?.join(", ") || "",
    projectTitle: profile.projects?.[0]?.title || "",
    projectDescription: profile.projects?.[0]?.description || "",
    projectUrl: profile.projects?.[0]?.url || "",
    linkLabel: profile.links?.[0]?.label || "",
    linkUrl: profile.links?.[0]?.url || "",
  });
  const [message, setMessage] = useState("");

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const updated = await api<Profile>("/profile/me", {
      method: "PUT",
      body: JSON.stringify({
        name: form.name,
        handle: form.handle,
        title: form.title,
        bio: form.bio,
        skills: splitTags(form.skills),
        interests: splitTags(form.interests),
        open_to: splitTags(form.open_to),
        projects: form.projectTitle
          ? [{ title: form.projectTitle, description: form.projectDescription, url: form.projectUrl }]
          : [],
        links: form.linkUrl ? [{ label: form.linkLabel || "Link", url: form.linkUrl }] : [],
      }),
    });
    onSaved(updated);
    setMessage("Profile saved.");
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input mt-1" value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div>
          <label className="label">Handle</label>
          <input className="input mt-1" value={form.handle} onChange={(e) => update("handle", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Title</label>
        <input className="input mt-1" value={form.title} onChange={(e) => update("title", e.target.value)} />
      </div>
      <div>
        <label className="label">Bio</label>
        <textarea className="input mt-1 min-h-24" value={form.bio} onChange={(e) => update("bio", e.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="label">Skills</label>
          <input className="input mt-1" value={form.skills} onChange={(e) => update("skills", e.target.value)} />
        </div>
        <div>
          <label className="label">Interests</label>
          <input className="input mt-1" value={form.interests} onChange={(e) => update("interests", e.target.value)} />
        </div>
        <div>
          <label className="label">Open to</label>
          <input className="input mt-1" value={form.open_to} onChange={(e) => update("open_to", e.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <input className="input" value={form.projectTitle} onChange={(e) => update("projectTitle", e.target.value)} placeholder="Project title" />
        <input className="input" value={form.projectDescription} onChange={(e) => update("projectDescription", e.target.value)} placeholder="Project note" />
        <input className="input" value={form.projectUrl} onChange={(e) => update("projectUrl", e.target.value)} placeholder="Project URL" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input className="input" value={form.linkLabel} onChange={(e) => update("linkLabel", e.target.value)} placeholder="Link label" />
        <input className="input" value={form.linkUrl} onChange={(e) => update("linkUrl", e.target.value)} placeholder="https://..." />
      </div>
      <button className="btn-primary">Save profile</button>
      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </form>
  );
}
