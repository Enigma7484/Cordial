import { Bell, Check, Moon, Palette, RotateCcw, Settings, SlidersHorizontal, Sparkles, Sun } from "lucide-react";
import { AppPreferences, DensityMode, MotionMode, PaletteMode, ThemeMode } from "../lib/preferences";

const palettes: Array<{
  id: PaletteMode;
  name: string;
  note: string;
  colors: string[];
}> = [
  { id: "electric", name: "Electric", note: "Cobalt, cyan, signal gold", colors: ["#315CF6", "#00A7B5", "#FFB020", "#121A2B"] },
  { id: "ember", name: "Ember", note: "Vermilion, ink, warm gold", colors: ["#D94B3D", "#A86900", "#F2B84B", "#1B1B1F"] },
  { id: "muse", name: "Muse", note: "Violet, rose, champagne", colors: ["#7459E8", "#D9467A", "#E8B84A", "#191521"] },
  { id: "tide", name: "Tide", note: "Ocean, coral, sunlight", colors: ["#087E8B", "#E85D5A", "#E5A900", "#102126"] },
];

function Choice<T extends string>({
  label,
  value,
  current,
  icon,
  onChange,
}: {
  label: string;
  value: T;
  current: T;
  icon?: React.ReactNode;
  onChange: (value: T) => void;
}) {
  return (
    <button className={`preference-choice ${current === value ? "preference-choice-active" : ""}`} onClick={() => onChange(value)} type="button">
      <span className="flex items-center gap-2">{icon}{label}</span>
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
      <section className="experience-hero settings-hero">
        <div>
          <p className="label">Your visual profile</p>
          <h1 className="mt-2 text-4xl font-black tracking-normal">Set the mood. Keep the clarity.</h1>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Choose a complete color direction, then tune the main accent until Cordial feels unmistakably yours.
          </p>
        </div>
        <div className="hero-signal">
          <Settings size={22} />
          <span>Live preview</span>
        </div>
      </section>

      <section className="appearance-studio">
        <div className="panel appearance-main">
          <div className="flex items-center gap-2">
            <Palette size={18} />
            <h2 className="font-bold">Color direction</h2>
          </div>
          <p className="mt-2 text-sm text-neutral-500">Each palette changes the full system: navigation, actions, highlights, and supporting color.</p>
          <div className="palette-grid">
            {palettes.map((palette) => (
              <button
                className={`palette-card ${preferences.palette === palette.id ? "palette-card-active" : ""}`}
                key={palette.id}
                onClick={() => update({ palette: palette.id, customAccent: "" })}
                type="button"
              >
                <span className="palette-swatches">
                  {palette.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
                </span>
                <span className="palette-copy"><strong>{palette.name}</strong><small>{palette.note}</small></span>
                <span className="palette-check">{preferences.palette === palette.id && <Check size={15} />}</span>
              </button>
            ))}
          </div>

          <div className="custom-accent-row">
            <div>
              <p className="text-sm font-bold">Personal accent</p>
              <p className="mt-1 text-xs text-neutral-500">Override the primary action color while keeping the palette balanced.</p>
            </div>
            <div className="accent-controls">
              <label className="color-picker" title="Choose custom accent">
                <input
                  type="color"
                  value={preferences.customAccent || palettes.find((item) => item.id === preferences.palette)?.colors[0] || "#315CF6"}
                  onChange={(event) => update({ customAccent: event.target.value })}
                />
                <span style={{ backgroundColor: preferences.customAccent || "var(--accent)" }} />
                <code>{preferences.customAccent || "Palette"}</code>
              </label>
              {preferences.customAccent && (
                <button className="icon-button" onClick={() => update({ customAccent: "" })} title="Reset accent" type="button"><RotateCcw size={16} /></button>
              )}
            </div>
          </div>
        </div>

        <aside className="panel appearance-side">
          <p className="eyebrow">Canvas</p>
          <h2 className="mt-1 font-bold">Light or dark</h2>
          <div className="mt-4 grid gap-2">
            <Choice<ThemeMode> label="Light" value="light" current={preferences.theme} icon={<Sun size={16} />} onChange={(theme) => update({ theme })} />
            <Choice<ThemeMode> label="Dark" value="dark" current={preferences.theme} icon={<Moon size={16} />} onChange={(theme) => update({ theme })} />
          </div>
          <div className="theme-mini-preview" aria-hidden="true">
            <span className="mini-sidebar" />
            <span className="mini-content"><i /><i /><b /></span>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} />
            <h2 className="font-bold">Workspace feel</h2>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
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
          <div className="flex items-center gap-2"><Sparkles size={18} /><h2 className="font-bold">Workspace habits</h2></div>
          <label className="setting-toggle mt-4">
            <span><strong>Auto-copy reports</strong><small>Keep host summaries ready.</small></span>
            <input type="checkbox" checked={preferences.autoCopyReports} onChange={(event) => update({ autoCopyReports: event.target.checked })} />
          </label>
          <label className="setting-toggle mt-3">
            <span><strong>Weekly digest</strong><small>Surface open loops and signals.</small></span>
            <input type="checkbox" checked={preferences.inboxDigest} onChange={(event) => update({ inboxDigest: event.target.checked })} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="flex items-center gap-2"><Bell size={18} /><h2 className="font-bold">Follow-up defaults</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Choice label="No default" value="none" current={preferences.defaultReminder} onChange={(defaultReminder) => update({ defaultReminder })} />
          <Choice label="Tomorrow" value="tomorrow" current={preferences.defaultReminder} onChange={(defaultReminder) => update({ defaultReminder })} />
          <Choice label="Next week" value="week" current={preferences.defaultReminder} onChange={(defaultReminder) => update({ defaultReminder })} />
        </div>
      </section>
    </div>
  );
}
