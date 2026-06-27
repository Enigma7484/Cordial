export type ThemeMode = "light" | "dark" | "aurora";
export type DensityMode = "cozy" | "compact";
export type MotionMode = "calm" | "expressive";

export type AppPreferences = {
  theme: ThemeMode;
  density: DensityMode;
  motion: MotionMode;
  defaultReminder: "none" | "tomorrow" | "week";
  inboxDigest: boolean;
  autoCopyReports: boolean;
  integrations: Record<string, boolean>;
};

export const defaultPreferences: AppPreferences = {
  theme: "light",
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
    return { ...defaultPreferences, ...JSON.parse(stored) };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: AppPreferences) {
  localStorage.setItem("cordial_preferences", JSON.stringify(preferences));
  localStorage.setItem("cordial_theme", preferences.theme === "light" ? "light" : "dark");
}
