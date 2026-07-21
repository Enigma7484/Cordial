import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  FileUp,
  Mail,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  SearchCheck,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  api,
  Campaign,
  CampaignAnalytics,
  MessageDraft,
  NetworkCandidate,
  NetworkOverview,
} from "../lib/api";

const emptyOverview: NetworkOverview = { contacts: 0, campaigns: 0, needs_review: 0, sent: 0, suppressed: 0 };
const emptyAnalytics: CampaignAnalytics = {
  candidates_reviewed: 0,
  candidates_approved: 0,
  messages_sent: 0,
  response_rate: 0,
  positive_response_rate: 0,
  meetings_generated: 0,
  referrals_generated: 0,
  bounce_rate: 0,
  opt_out_rate: 0,
};

function list(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function confidenceTone(status: string) {
  if (status === "VERIFIED_CURRENT" || status === "VERIFIED") return "good";
  if (status === "LIKELY_CURRENT" || status === "HIGH_CONFIDENCE") return "warn";
  if (status === "POSSIBLY_OUTDATED" || status === "CONFLICTING" || status === "DO_NOT_USE") return "bad";
  return "quiet";
}

export default function NetworkPage() {
  const [overview, setOverview] = useState(emptyOverview);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [candidates, setCandidates] = useState<NetworkCandidate[]>([]);
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [selectedId, setSelectedId] = useState("");
  const [activeDraftId, setActiveDraftId] = useState("");
  const [editingDraft, setEditingDraft] = useState<MessageDraft | null>(null);
  const [approvalId, setApprovalId] = useState("");
  const [assistedReady, setAssistedReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState("");
  const [importText, setImportText] = useState("");
  const [importConsent, setImportConsent] = useState(false);
  const [importPreview, setImportPreview] = useState<{ row_count: number; valid_count: number; errors: { row: number; message: string }[] } | null>(null);

  const [campaignForm, setCampaignForm] = useState({
    name: "", objective: "", targetCompanies: "", targetRoles: "software engineering",
    schools: "", skills: "", locations: "Toronto", ask: "Would you be open to a brief 15-minute conversation?",
  });

  const selected = useMemo(() => candidates.find((row) => row.id === selectedId) || candidates[0], [candidates, selectedId]);
  const activeDraft = selected?.drafts.find((draft) => draft.id === activeDraftId) || selected?.drafts[0];

  async function loadShell(preferredCampaignId?: string) {
    const [nextOverview, nextCampaigns] = await Promise.all([
      api<NetworkOverview>("/network/overview"),
      api<Campaign[]>("/network/campaigns"),
    ]);
    setOverview(nextOverview);
    setCampaigns(nextCampaigns);
    const nextId = preferredCampaignId || campaignId || nextCampaigns[0]?.id || "";
    if (nextId) setCampaignId(nextId);
  }

  async function loadCampaign(id: string) {
    if (!id) {
      setCandidates([]);
      setAnalytics(emptyAnalytics);
      return;
    }
    const [rows, metrics] = await Promise.all([
      api<NetworkCandidate[]>(`/network/campaigns/${id}/candidates`),
      api<CampaignAnalytics>(`/network/campaigns/${id}/analytics`),
    ]);
    setCandidates(rows);
    setAnalytics(metrics);
    setSelectedId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id || "");
  }

  useEffect(() => {
    loadShell().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load networking workspace"));
  }, []);

  useEffect(() => {
    loadCampaign(campaignId).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load campaign"));
  }, [campaignId]);

  async function seedDemo() {
    setBusy(true);
    setError("");
    setMessage("Preparing 30 synthetic contacts, evidence, channels, and two drafts per candidate...");
    try {
      const result = await api<{ campaign_id: string; contacts: number }>("/network/demo/seed", { method: "POST" });
      await loadShell(result.campaign_id);
      await loadCampaign(result.campaign_id);
      setMessage(`${result.contacts} synthetic contacts are ready. No live contact data was used.`);
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "Could not prepare demo");
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api<Campaign>("/network/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: campaignForm.name,
          objective: campaignForm.objective,
          target_companies: list(campaignForm.targetCompanies),
          target_roles: list(campaignForm.targetRoles),
          relevant_schools: list(campaignForm.schools),
          relevant_skills: list(campaignForm.skills),
          preferred_locations: list(campaignForm.locations),
          intended_ask: campaignForm.ask,
        }),
      });
      await api(`/network/campaigns/${created.id}/rank`, { method: "POST" });
      await loadShell(created.id);
      await loadCampaign(created.id);
      setShowBuilder(false);
      setMessage("Campaign created and ranked with a transparent deterministic score.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create campaign");
    } finally {
      setBusy(false);
    }
  }

  async function readCsv(file?: File) {
    if (!file) return;
    const text = await file.text();
    setImportFile(file.name);
    setImportText(text);
    setImportPreview(null);
  }

  async function previewImport() {
    setBusy(true);
    setError("");
    try {
      setImportPreview(await api("/network/imports/preview", {
        method: "POST",
        body: JSON.stringify({ filename: importFile, csv_text: importText, consent_confirmed: importConsent }),
      }));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not preview CSV");
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ row_count: number }>("/network/imports/commit", {
        method: "POST",
        body: JSON.stringify({ filename: importFile, csv_text: importText, consent_confirmed: importConsent }),
      });
      await loadShell();
      setShowImport(false);
      setImportPreview(null);
      setMessage(`${result.row_count} authorized contact rows imported. Raw and normalized values were preserved.`);
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : "Could not import CSV");
    } finally {
      setBusy(false);
    }
  }

  async function rerank() {
    if (!campaignId) return;
    setBusy(true);
    try {
      await api(`/network/campaigns/${campaignId}/rank`, { method: "POST" });
      await loadCampaign(campaignId);
      setMessage("Shortlist refreshed. Existing sends and relationship events remain in history.");
    } catch (rankError) {
      setError(rankError instanceof Error ? rankError.message : "Could not rank candidates");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateDrafts() {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/network/candidates/${selected.id}/drafts`, { method: "POST" });
      await loadCampaign(campaignId);
      setMessage("Two distinct, evidence-grounded strategies were generated.");
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Could not generate drafts");
    } finally {
      setBusy(false);
    }
  }

  async function reviewCandidate(status: "PINNED" | "DEFERRED" | "DISMISSED" | "NEEDS_VERIFICATION" | "SUPPRESSED") {
    if (!selected) return;
    if (status === "SUPPRESSED" && !window.confirm("Suppress this person globally and stop all pending outreach?")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/network/candidates/${selected.id}/review`, { method: "PATCH", body: JSON.stringify({ status }) });
      await Promise.all([loadCampaign(campaignId), loadShell()]);
      setMessage(`Candidate marked ${status.replaceAll("_", " ").toLowerCase()}.`);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not update candidate review");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!editingDraft) return;
    setBusy(true);
    try {
      await api(`/network/drafts/${editingDraft.id}`, {
        method: "PATCH",
        body: JSON.stringify({ subject: editingDraft.subject, body: editingDraft.body }),
      });
      setEditingDraft(null);
      await loadCampaign(campaignId);
      setMessage("Draft saved and rechecked for quality and grounding.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save draft");
    } finally {
      setBusy(false);
    }
  }

  async function approveDraft(draft: MessageDraft) {
    if (!selected) return;
    const channel = selected.channels.find((item) => item.permitted_use_status === "PERMITTED");
    if (!channel) {
      setError("This candidate has no permitted contact channel.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const approval = await api<{ id: string }>(`/network/drafts/${draft.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ channel: channel.channel_type, contact_channel_id: channel.id }),
      });
      setApprovalId(approval.id);
      setAssistedReady(false);
      await loadCampaign(campaignId);
      setMessage(`Approved the exact ${channel.channel_type === "EMAIL" ? "email" : "LinkedIn-assisted message"}. It has not been sent.`);
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Could not approve draft");
    } finally {
      setBusy(false);
    }
  }

  async function sendApproved() {
    if (!approvalId) return;
    setBusy(true);
    setError("");
    try {
      const channel = selected?.channels.find((item) => item.permitted_use_status === "PERMITTED");
      if (channel?.channel_type === "LINKEDIN_ASSISTED" && activeDraft) {
        await navigator.clipboard.writeText(activeDraft.body);
        window.open(selected.contact.profile_url || channel.address_or_profile_url, "_blank", "noopener,noreferrer");
      }
      const result = await api<{ approval: { status: string }; event: { provider: string; provider_message_id?: string } }>(`/network/approvals/${approvalId}/send`, { method: "POST" });
      await Promise.all([loadCampaign(campaignId), loadShell()]);
      if (result.event.provider === "MOCK_EMAIL") {
        setMessage(`Sent through the mock provider (${result.event.provider_message_id}).`);
        setApprovalId("");
      } else {
        setMessage("Approved copy is ready. Open the stored profile, send it manually, then record it here.");
        setAssistedReady(true);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not complete send step");
    } finally {
      setBusy(false);
    }
  }

  async function recordAssistedSent() {
    if (!approvalId) return;
    setBusy(true);
    setError("");
    try {
      await api(`/network/approvals/${approvalId}/record-assisted-sent`, { method: "POST" });
      await Promise.all([loadCampaign(campaignId), loadShell()]);
      setMessage("LinkedIn message recorded as manually sent. Follow-up rules now use this event history.");
      setApprovalId("");
      setAssistedReady(false);
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : "Could not record assisted send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack network-workspace">
      <section className="page-intro network-intro">
        <div>
          <p className="eyebrow">Human-approved networking</p>
          <h2>Find the few people worth contacting—and know why.</h2>
          <p>Cordial ranks your authorized network, keeps evidence visible, prepares two approaches, and waits for your exact approval.</p>
          <div className="network-actions">
            <button className="btn-primary" onClick={() => setShowBuilder(true)} type="button"><Plus size={16} /> New campaign</button>
            <button className="btn-soft" onClick={() => setShowImport(true)} type="button"><FileUp size={16} /> Import CSV</button>
            {overview.contacts === 0 && <button className="btn-soft" onClick={seedDemo} disabled={busy} type="button"><Sparkles size={16} /> Load synthetic demo</button>}
          </div>
        </div>
        <div className="approval-principle"><ShieldCheck size={23} /><strong>AI prepares.</strong><span>You authorize.</span></div>
      </section>

      {(message || error) && (
        <div className={`network-banner ${error ? "network-banner-error" : ""}`}>
          {error ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
          <span>{error || message}</span>
          <button type="button" onClick={() => { setError(""); setMessage(""); }} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      <section className="network-metrics" aria-label="Networking workspace summary">
        <div><UsersRound size={17} /><span><strong>{overview.contacts}</strong> authorized contacts</span></div>
        <div><Target size={17} /><span><strong>{overview.campaigns}</strong> campaigns</span></div>
        <div><SearchCheck size={17} /><span><strong>{overview.needs_review}</strong> need review</span></div>
        <div><Send size={17} /><span><strong>{overview.sent}</strong> sent</span></div>
      </section>

      {campaigns.length === 0 ? (
        <section className="network-empty surface">
          <span><Sparkles size={26} /></span>
          <h3>Start with safe, synthetic data.</h3>
          <p>Explore the full workflow with 30 fictional contacts, mock evidence, reserved email addresses, and zero external sends.</p>
          <button className="btn-primary" type="button" onClick={seedDemo} disabled={busy}>{busy ? "Preparing demo..." : "Build demo workspace"}</button>
        </section>
      ) : (
        <>
          <section className="campaign-toolbar surface">
            <label>
              <span>Active campaign</span>
              <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
                {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </select>
            </label>
            <div className="campaign-objective">
              <small>Objective</small>
              <strong>{campaigns.find((campaign) => campaign.id === campaignId)?.objective}</strong>
            </div>
            <button className="btn-soft" onClick={rerank} disabled={busy} type="button"><RefreshCw size={15} /> Re-rank</button>
          </section>

          <section className="outcome-strip surface">
            <div><strong>{analytics.candidates_reviewed}</strong><span>reviewed</span></div>
            <div><strong>{analytics.candidates_approved}</strong><span>approved</span></div>
            <div><strong>{analytics.messages_sent}</strong><span>sent</span></div>
            <div><strong>{analytics.response_rate}%</strong><span>response</span></div>
            <div><strong>{analytics.meetings_generated}</strong><span>meetings</span></div>
            <div><strong>{analytics.referrals_generated}</strong><span>referrals</span></div>
          </section>

          <div className="approval-layout">
            <section className="candidate-queue surface">
              <div className="queue-heading"><div><p className="eyebrow">Approval queue</p><h3>{candidates.length} shortlisted people</h3></div><span>No bulk approve</span></div>
              {candidates.map((candidate) => (
                <button className={`candidate-row ${selected?.id === candidate.id ? "active" : ""}`} key={candidate.id} onClick={() => { setSelectedId(candidate.id); setActiveDraftId(""); setApprovalId(""); setAssistedReady(false); }} type="button">
                  <span className="rank-number">{candidate.rank}</span>
                  <span className="candidate-main"><strong>{candidate.contact.name}</strong><small>{candidate.contact.position} · {candidate.contact.company}</small><span>{candidate.score_breakdown.slice(0, 2).map((item) => item.label).join(" · ")}</span></span>
                  <span className="candidate-score"><strong>{candidate.relevance_score}</strong><small>match</small></span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </section>

            {selected && (
              <section className="candidate-review surface">
                <div className="review-header">
                  <div><p className="eyebrow">Candidate #{selected.rank}</p><h3>{selected.contact.name}</h3><p>{selected.contact.position} at {selected.contact.company}</p></div>
                  <div className="score-orbit"><strong>{selected.relevance_score}</strong><span>/ 100</span></div>
                </div>
                <div className="candidate-review-actions" aria-label="Candidate review actions">
                  <button type="button" onClick={() => reviewCandidate("PINNED")} disabled={busy}>Pin</button>
                  <button type="button" onClick={() => reviewCandidate("NEEDS_VERIFICATION")} disabled={busy}>Needs verification</button>
                  <button type="button" onClick={() => reviewCandidate("DEFERRED")} disabled={busy}>Defer</button>
                  <button type="button" onClick={() => reviewCandidate("DISMISSED")} disabled={busy}>Dismiss</button>
                  <button className="danger" type="button" onClick={() => reviewCandidate("SUPPRESSED")} disabled={busy}>Suppress</button>
                </div>

                <div className="confidence-grid">
                  <div><small>Employment</small><span className={`confidence-pill ${confidenceTone(selected.employment_confidence.status)}`}>{selected.employment_confidence.status.replaceAll("_", " ")}</span><p>{selected.employment_confidence.reason}</p></div>
                  <div><small>Contact channel</small>{selected.channels[0] ? <><span className={`confidence-pill ${confidenceTone(selected.channels[0].verification_status)}`}>{selected.channels[0].verification_status.replaceAll("_", " ")}</span><p>{selected.channels[0].channel_type.replaceAll("_", " ")} · {selected.channels[0].confidence_score}% confidence</p></> : <><span className="confidence-pill quiet">UNVERIFIED</span><p>No permitted channel attached.</p></>}</div>
                </div>

                <div className="review-section">
                  <div className="review-section-title"><div><BarChart3 size={16} /><strong>Why this person</strong></div><small>deterministic-v1</small></div>
                  <div className="score-breakdown">{selected.score_breakdown.slice(0, 5).map((item) => <div key={item.key}><span>{item.label}</span><strong>+{item.points}</strong></div>)}</div>
                </div>

                <div className="review-section">
                  <div className="review-section-title"><div><ShieldCheck size={16} /><strong>Evidence</strong></div><small>{selected.evidence.length} source{selected.evidence.length === 1 ? "" : "s"}</small></div>
                  {selected.evidence.length ? selected.evidence.map((item) => <div className="evidence-row" key={item.id}><SearchCheck size={15} /><span><strong>{item.observed_value}</strong><small>{item.source_type.replaceAll("_", " ")} · observed {new Date(item.observed_at).toLocaleDateString()}</small></span></div>) : <p className="quiet-copy">Imported employment has not been independently checked.</p>}
                </div>

                <div className="review-section message-review">
                  <div className="review-section-title"><div><MessageSquareText size={16} /><strong>Two message strategies</strong></div><button type="button" onClick={regenerateDrafts} disabled={busy}><RefreshCw size={14} /> Regenerate</button></div>
                  <div className="variant-tabs">
                    {selected.drafts.map((draft) => <button className={(activeDraft?.id === draft.id) ? "active" : ""} key={draft.id} onClick={() => setActiveDraftId(draft.id)} type="button">{draft.strategy === "SHARED_CONTEXT" ? "A · Shared context" : "B · Direct relevance"}</button>)}
                  </div>
                  {activeDraft ? (
                    <div className="draft-card">
                      <div className="draft-subject"><small>Subject</small><strong>{activeDraft.subject}</strong></div>
                      <pre>{activeDraft.body}</pre>
                      <div className="grounding"><ShieldCheck size={14} /><span>Grounded in: {activeDraft.evidence_used.join(" · ") || "No evidence"}</span></div>
                      {activeDraft.quality_review.status === "PASSED" ? <div className="quality-pass"><Check size={14} /> Quality review passed</div> : <div className="quality-block"><AlertTriangle size={14} /> {activeDraft.quality_review.issues.join(" ")}</div>}
                      <div className="draft-actions">
                        <button className="btn-soft" type="button" onClick={() => setEditingDraft({ ...activeDraft })}>Edit exact copy</button>
                        <button className="btn-primary" type="button" onClick={() => approveDraft(activeDraft)} disabled={busy || activeDraft.quality_review.status === "BLOCKED"}><Check size={15} /> Approve this message</button>
                      </div>
                      {approvalId && <div className="send-gate"><div><strong>{assistedReady ? "Ready for manual sending" : "Approved—not sent"}</strong><span>{assistedReady ? "Send in LinkedIn yourself, then record the outcome." : "A separate action is required. Mock email cannot reach a real inbox."}</span></div><button className="btn-primary" type="button" onClick={assistedReady ? recordAssistedSent : sendApproved} disabled={busy}><Send size={15} /> {assistedReady ? "Record manually sent" : "Complete send step"}</button></div>}
                    </div>
                  ) : <button className="btn-soft" onClick={regenerateDrafts} type="button">Generate exactly two drafts</button>}
                </div>

                <div className="review-section timeline-preview">
                  <div className="review-section-title"><div><Play size={16} /><strong>Relationship history</strong></div><small>{selected.timeline.length} events</small></div>
                  {selected.timeline.slice(0, 5).map((item) => <div key={item.id}><span /><p><strong>{item.title}</strong><small>{new Date(item.created_at).toLocaleString()}</small></p></div>)}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {showBuilder && <div className="network-modal-backdrop" role="presentation"><form className="network-modal" onSubmit={createCampaign} role="dialog" aria-modal="true" aria-labelledby="campaign-builder-title"><div className="modal-heading"><div><p className="eyebrow">New campaign</p><h3 id="campaign-builder-title">Define a narrow, respectful objective.</h3></div><button type="button" onClick={() => setShowBuilder(false)} aria-label="Close"><X /></button></div><div className="form-grid"><label><span className="label">Campaign name</span><input className="input" value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} required placeholder="York alumni in AI engineering" /></label><label className="wide"><span className="label">Objective</span><textarea className="input" value={campaignForm.objective} onChange={(event) => setCampaignForm({ ...campaignForm, objective: event.target.value })} required placeholder="learn how engineers move from co-op roles into AI platform teams" /></label><label><span className="label">Target companies</span><input className="input" value={campaignForm.targetCompanies} onChange={(event) => setCampaignForm({ ...campaignForm, targetCompanies: event.target.value })} placeholder="Intuit, Shopify" /></label><label><span className="label">Target roles</span><input className="input" value={campaignForm.targetRoles} onChange={(event) => setCampaignForm({ ...campaignForm, targetRoles: event.target.value })} /></label><label><span className="label">Schools</span><input className="input" value={campaignForm.schools} onChange={(event) => setCampaignForm({ ...campaignForm, schools: event.target.value })} placeholder="York University" /></label><label><span className="label">Relevant skills</span><input className="input" value={campaignForm.skills} onChange={(event) => setCampaignForm({ ...campaignForm, skills: event.target.value })} placeholder="RAG, DevOps, TypeScript" /></label><label><span className="label">Locations</span><input className="input" value={campaignForm.locations} onChange={(event) => setCampaignForm({ ...campaignForm, locations: event.target.value })} /></label><label className="wide"><span className="label">One low-pressure ask</span><input className="input" value={campaignForm.ask} onChange={(event) => setCampaignForm({ ...campaignForm, ask: event.target.value })} required /></label></div><div className="modal-actions"><button className="btn-soft" type="button" onClick={() => setShowBuilder(false)}>Cancel</button><button className="btn-primary" disabled={busy}><Target size={16} /> Create and rank</button></div></form></div>}

      {showImport && <div className="network-modal-backdrop" role="presentation"><section className="network-modal" role="dialog" aria-modal="true" aria-labelledby="csv-import-title"><div className="modal-heading"><div><p className="eyebrow">Authorized CSV import</p><h3 id="csv-import-title">Preview before anything is stored.</h3></div><button type="button" onClick={() => setShowImport(false)} aria-label="Close"><X /></button></div><label className="csv-drop"><FileUp size={25} /><strong>{importFile || "Choose a LinkedIn export or generic CSV"}</strong><span>Up to 5,000 rows. No automatic public-profile crawling.</span><input type="file" accept=".csv,text/csv" onChange={(event) => readCsv(event.target.files?.[0])} /></label><label className="consent-line"><input type="checkbox" checked={importConsent} onChange={(event) => setImportConsent(event.target.checked)} /><span>I confirm I am authorized to import and process these professional contacts.</span></label>{importPreview && <div className="import-report"><div><CheckCircle2 size={18} /><strong>{importPreview.valid_count} valid</strong><span>of {importPreview.row_count} rows</span></div>{importPreview.errors.length > 0 && <p>{importPreview.errors.length} rows need attention before import.</p>}</div>}<div className="modal-actions"><button className="btn-soft" type="button" onClick={previewImport} disabled={!importText || !importConsent || busy}>Preview quality</button><button className="btn-primary" type="button" onClick={commitImport} disabled={!importPreview || !importConsent || importPreview.errors.length > 0 || busy}><FileUp size={16} /> Import authorized data</button></div></section></div>}

      {editingDraft && <div className="network-modal-backdrop" role="presentation"><section className="network-modal draft-editor" role="dialog" aria-modal="true" aria-labelledby="draft-editor-title"><div className="modal-heading"><div><p className="eyebrow">Exact message editor</p><h3 id="draft-editor-title">{editingDraft.strategy.replaceAll("_", " ")}</h3></div><button type="button" onClick={() => setEditingDraft(null)} aria-label="Close"><X /></button></div><label><span className="label">Subject</span><input className="input" value={editingDraft.subject} onChange={(event) => setEditingDraft({ ...editingDraft, subject: event.target.value })} /></label><label><span className="label">Body</span><textarea className="input" value={editingDraft.body} onChange={(event) => setEditingDraft({ ...editingDraft, body: event.target.value })} /></label><p className="editor-note"><ShieldCheck size={15} /> Saving reruns quality checks. Approval still requires a separate action.</p><div className="modal-actions"><button className="btn-soft" type="button" onClick={() => setEditingDraft(null)}>Cancel</button><button className="btn-primary" type="button" onClick={saveDraft} disabled={busy}>Save and review</button></div></section></div>}
    </div>
  );
}
