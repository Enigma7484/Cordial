import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, Profile } from "../lib/api";

type Project = { title: string; description: string; url: string };
type Link = { label: string; url: string };

function splitTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function blankProject(): Project {
  return { title: "", description: "", url: "" };
}

function blankLink(): Link {
  return { label: "", url: "" };
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
  });
  const [projects, setProjects] = useState<Project[]>(profile.projects?.length ? profile.projects : [blankProject()]);
  const [links, setLinks] = useState<Link[]>(profile.links?.length ? profile.links : [blankLink()]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProject(index: number, key: keyof Project, value: string) {
    setProjects((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function updateLink(index: number, key: keyof Link, value: string) {
    setLinks((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);
    try {
      const updated = await api<Profile>("/profile/me", {
        method: "PUT",
        body: JSON.stringify({
          name: form.name.trim(),
          handle: form.handle.trim().toLowerCase(),
          title: form.title.trim(),
          bio: form.bio.trim(),
          skills: splitTags(form.skills),
          interests: splitTags(form.interests),
          open_to: splitTags(form.open_to),
          projects: projects
            .map((item) => ({
              title: item.title.trim(),
              description: item.description.trim(),
              url: item.url.trim(),
            }))
            .filter((item) => item.title || item.description || item.url),
          links: links
            .map((item) => ({
              label: item.label.trim() || "Link",
              url: item.url.trim(),
            }))
            .filter((item) => item.url),
        }),
      });
      onSaved(updated);
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input mt-1" value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </div>
        <div>
          <label className="label">Handle</label>
          <input className="input mt-1" value={form.handle} onChange={(e) => update("handle", e.target.value)} required />
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
          <input className="input mt-1" value={form.skills} onChange={(e) => update("skills", e.target.value)} placeholder="React, Python, research" />
        </div>
        <div>
          <label className="label">Interests</label>
          <input className="input mt-1" value={form.interests} onChange={(e) => update("interests", e.target.value)} placeholder="startups, design, fintech" />
        </div>
        <div>
          <label className="label">Open to</label>
          <input className="input mt-1" value={form.open_to} onChange={(e) => update("open_to", e.target.value)} placeholder="coffee, collab, mock interviews" />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Projects</h3>
          <button className="btn-soft !h-9 !min-h-9 !px-3" type="button" onClick={() => setProjects((current) => [...current, blankProject()])}>
            <Plus size={15} />
          </button>
        </div>
        {projects.map((project, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <input className="input" value={project.title} onChange={(e) => updateProject(index, "title", e.target.value)} placeholder="Project title" />
            <input className="input" value={project.description} onChange={(e) => updateProject(index, "description", e.target.value)} placeholder="Short note" />
            <input className="input" value={project.url} onChange={(e) => updateProject(index, "url", e.target.value)} placeholder="https://..." />
            <button
              className="btn-soft !h-10 !min-h-10 !px-3"
              type="button"
              onClick={() => setProjects((current) => current.filter((_, i) => i !== index))}
              disabled={projects.length === 1}
              title="Remove project"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Links</h3>
          <button className="btn-soft !h-9 !min-h-9 !px-3" type="button" onClick={() => setLinks((current) => [...current, blankLink()])}>
            <Plus size={15} />
          </button>
        </div>
        {links.map((link, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[1fr_2fr_auto]">
            <input className="input" value={link.label} onChange={(e) => updateLink(index, "label", e.target.value)} placeholder="GitHub" />
            <input className="input" value={link.url} onChange={(e) => updateLink(index, "url", e.target.value)} placeholder="https://..." />
            <button
              className="btn-soft !h-10 !min-h-10 !px-3"
              type="button"
              onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}
              disabled={links.length === 1}
              title="Remove link"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>

      <button className="btn-primary" disabled={saving}>
        {saving ? "Saving..." : "Save profile"}
      </button>
      {message && <p className="text-sm text-neutral-600">{message}</p>}
      {error && <p className="text-sm text-coral">{error}</p>}
    </form>
  );
}
