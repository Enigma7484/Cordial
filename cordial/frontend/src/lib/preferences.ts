export type ThemeMode = "light" | "dark";
export type PaletteMode = "electric" | "ember" | "muse" | "tide";
export type DensityMode = "cozy" | "compact";
export type MotionMode = "calm" | "expressive";

export type AppPreferences = {
  theme: ThemeMode;
  palette: PaletteMode;
  customAccent: string;
  density: DensityMode;
  motion: MotionMode;
  defaultReminder: "none" | "tomorrow" | "week";
  inboxDigest: boolean;
  autoCopyReports: boolean;
  integrations: Record<string, boolean>;
};

export const defaultPreferences: AppPreferences = {
  theme: "light",
  palette: "electric",
  customAccent: "",
  density: "cozy",
  motion: "calm",
  defaultReminder: "tomorrow",
  inboxDigest: true,
  autoCopyReports: true,
  integrations: {
    google: false,
    calendar: false,
    linkedin: false,
    discord: false,
    notion: false,
    slack: false,
  },
};

export function loadPreferences(): AppPreferences {
  try {
    const stored = localStorage.getItem("cordial_preferences");
    if (!stored) return defaultPreferences;
    const parsed = JSON.parse(stored);
    return {
      ...defaultPreferences,
      ...parsed,
      theme: parsed.theme === "dark" ? "dark" : "light",
      palette: ["electric", "ember", "muse", "tide"].includes(parsed.palette) ? parsed.palette : "electric",
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: AppPreferences) {
  localStorage.setItem("cordial_preferences", JSON.stringify(preferences));
  localStorage.setItem("cordial_theme", preferences.theme);
}
