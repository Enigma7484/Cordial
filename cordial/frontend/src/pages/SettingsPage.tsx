import { Bell, Check, Palette, Settings, SlidersHorizontal, Sparkles } from "lucide-react";
import { AppPreferences, DensityMode, MotionMode, ThemeMode } from "../lib/preferences";

function Choice<T extends string>({
  label,
  value,
  current,
  onChange,
}: {
  label: string;
  value: T;
  current: T;
  onChange: (value: T) => void;
}) {
  return (
    <button className={`preference-choice ${current === value ? "preference-choice-active" : ""}`} onClick={() => onChange(value)} type="button">
      <span>{label}</span>
      {current === value && <Check size={15} />}
    </button>
  );
}

export default function SettingsPage({
  preferences,
  onChange,
}: {
  preferences: AppPreferences;
  onChange: (preferences: AppPreferences) => void;
}) {
  const update = (patch: Partial<AppPreferences>) => onChange({ ...preferences, ...patch });

  return (
    <div className="grid gap-5">
      <section className="experience-hero">
        <div>
          <p className="label">Settings</p>
          <h1 className="mt-2 text-4xl font-black tracking-normal">Make Cordial feel like yours.</h1>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Choose how your workspace looks, moves, and reminds you to follow through.
          </p>
        </div>
        <div className="hero-signal">
          <Settings size={28} />
          <span>Personalized workspace</span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <div className="flex items-center gap-2">
            <Palette size={18} />
            <h2 className="font-bold">Appearance</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Choice<ThemeMode> label="Light" value="light" current={preferences.theme} onChange={(theme) => update({ theme })} />
            <Choice<ThemeMode> label="Dark" value="dark" current={preferences.theme} onChange={(theme) => update({ theme })} />
            <Choice<ThemeMode> label="Aurora" value="aurora" current={preferences.theme} onChange={(theme) => update({ theme })} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-bold">Density</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice<DensityMode> label="Cozy" value="cozy" current={preferences.density} onChange={(density) => update({ density })} />
                <Choice<DensityMode> label="Compact" value="compact" current={preferences.density} onChange={(density) => update({ density })} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Motion</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice<MotionMode> label="Calm" value="calm" current={preferences.motion} onChange={(motion) => update({ motion })} />
                <Choice<MotionMode> label="Expressive" value="expressive" current={preferences.motion} onChange={(motion) => update({ motion })} />
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <h2 className="font-bold">Workspace habits</h2>
          </div>
          <label className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-line p-3">
            <span>
              <span className="block text-sm font-bold">Auto-copy reports</span>
              <span className="text-xs text-neutral-500">Prefer copyable host summaries.</span>
            </span>
            <input type="checkbox" checked={preferences.autoCopyReports} onChange={(event) => update({ autoCopyReports: event.target.checked })} />
          </label>
          <label className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-line p-3">
            <span>
              <span className="block text-sm font-bold">Weekly digest</span>
              <span className="text-xs text-neutral-500">Surface open loops and signals.</span>
            </span>
            <input type="checkbox" checked={preferences.inboxDigest} onChange={(event) => update({ inboxDigest: event.target.checked })} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="flex items-center gap-2">
          <Bell size={18} />
          <h2 className="font-bold">Follow-up defaults</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Choice label="No default" value="none" current={preferences.defaultReminder} onChange={(defaultReminder) => update({ defaultReminder })} />
          <Choice label="Tomorrow" value="tomorrow" current={preferences.defaultReminder} onChange={(defaultReminder) => update({ defaultReminder })} />
          <Choice label="Next week" value="week" current={preferences.defaultReminder} onChange={(defaultReminder) => update({ defaultReminder })} />
        </div>
      </section>

      <section className="panel">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} />
          <h2 className="font-bold">Built around your rhythm</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="feature-tile">A workspace that stays readable</div>
          <div className="feature-tile">Consistent reminders for every promise</div>
          <div className="feature-tile">Reports ready when the room ends</div>
        </div>
      </section>
    </div>
  );
}
