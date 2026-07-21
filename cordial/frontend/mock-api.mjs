import { createServer } from "node:http";

const now = new Date().toISOString();
const profile = { id: "visual-user", email: "visual@demo.invalid", handle: "visual_demo", name: "Visual Demo", title: "Software Engineer", bio: "", skills: [], projects: [], links: [], interests: [], open_to: [] };
const campaign = { id: "visual-campaign", name: "Intuit software-engineering networking", objective: "learn how engineers build reliable AI and platform systems at Intuit", status: "ACTIVE", target_companies: ["Intuit"], target_roles: ["software engineering"], relevant_schools: ["York University"], relevant_skills: ["Python", "TypeScript"], preferred_locations: ["Toronto"], intended_ask: "Would you be open to a brief 15-minute conversation?", maximum_candidate_count: 8, allowed_outreach_channels: ["EMAIL"], daily_sending_limit: 5 };
const candidates = Array.from({ length: 8 }, (_, index) => ({
  id: `candidate-${index}`, rank: index + 1, relevance_score: 92 - index * 4, review_status: "NEEDS_REVIEW",
  employment_confidence: { status: ["VERIFIED_CURRENT", "LIKELY_CURRENT", "POSSIBLY_OUTDATED", "UNVERIFIED"][index % 4], confidence: 92 - index * 7, reason: index % 4 === 0 ? "Recent first-party evidence supports the current role." : "Evidence is shown with its recency and source." },
  score_breakdown: [
    { key: "target_company_match", label: "target company: Intuit", points: 25 },
    { key: "role_relevance", label: "role relevance: Software Engineer", points: 15 },
    { key: "education_overlap", label: "shared education: York University", points: 10 },
    { key: "skill_similarity", label: "relevant skill overlap", points: 8 },
  ],
  contact: { id: `contact-${index}`, name: ["Avery Morgan", "Noor Hassan", "Priya Desai", "Eli Turner", "Sofia Reyes", "Marcus Liu", "Leila Haddad", "Jonah Brooks"][index], first_name: "Avery", company: index < 5 ? "Intuit" : "RBC", position: index % 2 ? "AI Platform Engineer" : "Software Engineer", school: "York University", graduation_year: 2022, location: "Toronto, ON", skills: ["Python", "TypeScript", "AI agents"], profile_url: "https://example.com" },
  channels: [{ id: `channel-${index}`, channel_type: index === 2 ? "LINKEDIN_ASSISTED" : "EMAIL", address_or_profile_url: "avery.morgan@demo.invalid", verification_status: "VERIFIED", confidence_score: 99, permitted_use_status: "PERMITTED", risk_flags: ["SYNTHETIC_ONLY"] }],
  evidence: [{ id: `evidence-${index}`, source_type: "OFFICIAL_COMPANY", source_url: "https://example.com", observed_value: "Software Engineer at Intuit", observed_at: now, notes: "Synthetic evidence" }],
  drafts: [
    { id: `draft-a-${index}`, strategy: "SHARED_CONTEXT", subject: "A quick note about Intuit", body: "Hi Avery,\n\nI came across your profile while learning about AI platform engineering, and your York University background stood out. Would you be open to a brief 15-minute conversation?\n\nNo pressure at all if the timing isn’t right.\n\nBest,\nVisual Demo", evidence_used: ["York University", "Software Engineer", "Intuit"], quality_review: { status: "PASSED", issues: [] }, status: "NEEDS_REVIEW", version: 1 },
    { id: `draft-b-${index}`, strategy: "DIRECT_RELEVANCE", subject: "Question about engineering at Intuit", body: "Hi Avery,\n\nI’m exploring reliable AI platform engineering and noticed your experience at Intuit. Would you be open to a brief 15-minute conversation?\n\nThanks,\nVisual Demo", evidence_used: ["Software Engineer", "Intuit"], quality_review: { status: "PASSED", issues: [] }, status: "NEEDS_REVIEW", version: 1 },
  ],
  timeline: [{ id: `timeline-${index}`, event_type: "SHORTLISTED", title: "Shortlisted for Intuit software-engineering networking", created_at: now }],
}));

const server = createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5174");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  response.setHeader("Content-Type", "application/json");
  if (request.method === "OPTIONS") return response.end();
  const path = request.url || "";
  if (path === "/auth/request-otp" && request.method === "POST") return response.end(JSON.stringify({ message: "Development code ready", dev_otp: "123456" }));
  if (path === "/auth/verify-otp" && request.method === "POST") return response.end(JSON.stringify({ token: "visual-token", user: profile }));
  if (path === "/profile/me") return response.end(JSON.stringify(profile));
  if (path === "/network/overview") return response.end(JSON.stringify({ contacts: 30, campaigns: 1, needs_review: 8, sent: 0, suppressed: 0 }));
  if (path === "/network/campaigns") return response.end(JSON.stringify([campaign]));
  if (path.endsWith("/candidates")) return response.end(JSON.stringify(candidates));
  if (path.endsWith("/analytics")) return response.end(JSON.stringify({ candidates_reviewed: 8, candidates_approved: 2, messages_sent: 1, response_rate: 100, positive_response_rate: 100, meetings_generated: 1, referrals_generated: 0, bounce_rate: 0, opt_out_rate: 0 }));
  response.statusCode = 404;
  response.end(JSON.stringify({ detail: "Visual mock route not found" }));
});

server.listen(8010, "127.0.0.1", () => console.log("Visual mock API listening on http://127.0.0.1:8010"));
