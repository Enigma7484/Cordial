import { clearToken, getToken } from "./auth";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8010";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`API route not found at ${API_URL}${path}. Restart Vite after changing VITE_API_URL.`);
    }
    throw new Error(body?.detail || "Something went wrong");
  }
  return body as T;
}

export type Profile = {
  id: string;
  email: string;
  handle: string;
  name: string;
  title: string;
  bio: string;
  skills: string[];
  projects: { title: string; description: string; url: string }[];
  links: { label: string; url: string }[];
  interests: string[];
  open_to: string[];
};

export type PublicUser = Pick<
  Profile,
  "id" | "name" | "handle" | "title" | "bio" | "skills" | "projects" | "links" | "interests" | "open_to"
>;

export type Connection = {
  id: string;
  user_a: string;
  user_b: string;
  created_by: string;
  note?: string;
  event?: string;
  event_id?: string;
  event_code?: string;
  event_name?: string;
  event_context?: { id: string; name: string; code: string };
  created_at: string;
  other_user?: PublicUser;
};

export type Followup = {
  id: string;
  connection_id: string;
  text: string;
  status: "open" | "completed";
  due_date?: string | null;
  created_at: string;
  other_user?: PublicUser;
};

export type Event = {
  id: string;
  name: string;
  description: string;
  location: string;
  starts_at?: string | null;
  ends_at?: string | null;
  event_url: string;
  host_note: string;
  links: { label: string; url: string }[];
  code: string;
  host_id: string;
  attendees: string[];
  attendee_profiles?: PublicUser[];
  created_at: string;
};

export type Ask = {
  id: string;
  type: "ask" | "offer";
  text: string;
  tags: string[];
  reply_count?: number;
  created_at: string;
  user_id?: string;
  user?: { name: string; handle: string; title: string };
};

export type SignalReply = {
  id: string;
  ask_id: string;
  ask_user_id: string;
  responder_id: string;
  connection_id: string;
  followup_id?: string;
  message: string;
  status: "open" | "completed";
  created_at: string;
  ask?: Ask;
  ask_user?: PublicUser;
  responder?: PublicUser;
};

export type SignalMatch = {
  user: PublicUser;
  score: number;
  reasons: string[];
};

export type ConnectionTimeline = {
  connection: Connection;
  other_user?: PublicUser;
  open_followups: number;
  completed_followups: number;
  signal_reply_count: number;
  next_action: string;
  timeline: {
    id: string;
    type: "connection" | "event" | "followup" | "signal_reply";
    title: string;
    text: string;
    status?: string;
    created_at: string;
  }[];
};

export type EventRecap = {
  event: Event;
  attendees_seen: number;
  connections_from_event: number;
  open_followups: number;
  completed_followups: number;
  not_connected: PublicUser[];
  top_terms: string[];
  suggested_actions: string[];
};
