"use client";
import { useEffect, useState, useRef } from "react";
import ThemeToggle from "./theme-toggle";
import {
  LayoutDashboard,
  Sparkles,
  Users,
  Columns3,
  ArrowUpRight,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Copy,
  RefreshCw,
  Check,
  CheckCircle2,
  MessageSquare,
  Phone,
  Mail,
  Globe,
  ShieldCheck,
  Clock,
  LogOut,
  Menu,
  X,
  SlidersHorizontal,
  Send,
  Loader2,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import {
  seed,
  groundPipeline,
  pipelineContext,
  CHANNELS,
  fieldOrigin,
  type CreateInput,
  editable,
  applySave,
  filterRows,
  csvExport,
  STAGES,
  TYPES,
  PROGRAMMES,
  LANGUAGES,
  type Enquiry,
  type Editable,
  type Analysis,
  type SaveInput,
} from "@/lib/domain";
type Screen =
  "Dashboard" | "AI Enquiry Processor" | "Enquiry List" | "Pipeline";
const NAV = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "AI Enquiry Processor", icon: Sparkles },
  { name: "Enquiry List", icon: Users },
  { name: "Pipeline", icon: Columns3 },
] as const;
const STORAGE = "biai-vercel-demo-v1";
const shortName = (s: string) => s.split(" (")[0] || "Unnamed customer";
const initials = (s: string) =>
  shortName(s)
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
const stageClass = (s: string) => s.toLowerCase().replaceAll(" ", "-");
function Avatar({ name, id = 0 }: { name: string; id?: number }) {
  return <span className={"avatar av" + (id % 5)}>{initials(name)}</span>;
}
function Badge({
  children,
  kind = "",
}: {
  children: React.ReactNode;
  kind?: string;
}) {
  return (
    <span className={"badge " + stageClass(kind)}>
      <i />
      {children}
    </span>
  );
}
function Channel({ value }: { value: string }) {
  const Icon =
    value === "WhatsApp"
      ? MessageSquare
      : value === "Phone call note" || value === "Phone Call"
        ? Phone
        : value === "Website form" || value === "Website"
          ? Globe
          : Mail;
  return (
    <span className="channel">
      <Icon size={13} />
      {value}
    </span>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  hint?: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {hint && <small className="provenance">{hint}</small>}
      <div className="select-wrap">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <ChevronDown size={14} />
      </div>
    </label>
  );
}
async function api(url: string, options?: RequestInit) {
  const r = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await r.json();
  if (!r.ok || body.error) throw Error(body.error || "Request failed.");
  return body;
}
export default function CRM() {
  const [screen, setScreen] = useState<Screen>("Dashboard"),
    [allRows, setRows] = useState<Enquiry[]>([]),
    [mode, setMode] = useState<"loading" | "demo" | "database">("loading"),
    [auth, setAuth] = useState(false),
    [aiReady, setAiReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [help, setHelp] = useState(false);
  const [creating, setCreating] = useState(false),
    [selected, setSelected] = useState(1),
    [detail, setDetail] = useState<number | null>(null),
    [query, setQuery] = useState(""),
    [type, setType] = useState("All"),
    [stage, setStage] = useState("All"),
    [programme, setProgramme] = useState("All"),
    [page, setPage] = useState(0),
    [pipelineAll, setPipelineAll] = useState(false);
  const [dataset, setDataset] = useState("Official dataset");
  const [reviewFilter, setReviewFilter] = useState<"Pending" | "Reviewed">("Pending");
  const rows = allRows.filter(
    (r) =>
      dataset === "All enquiries" ||
      (dataset === "Manual entries"
        ? r.origin === "Manual Entry"
        : r.origin !== "Manual Entry"),
  );
  const processorRows = rows.filter(
    (r) => r.needs_human_review === (reviewFilter === "Pending"),
  );
  const processorActive =
    processorRows.find((r) => r.id === selected) || processorRows[0];
  async function load() {
    setError("");
    try {
      const s = await api("/api/session");
      setMode(s.mode);
      setAuth(s.authenticated);
      setAiReady(s.ai);
      if (s.mode === "demo") {
        let data = seed();
        try {
          const stored = JSON.parse(localStorage.getItem(STORAGE) || "null");
          if (Array.isArray(stored) && stored.length === 20)
            data = data.map((original) => {
              const saved = stored.find((x) => x.id === original.id);
              if (!saved) return original;
              return {
                ...original,
                ...editable(saved),
                version: Number.isInteger(saved.version) ? saved.version : 0,
                last_follow_up: saved.last_follow_up,
                updated_at: saved.updated_at,
                analysis_origin: saved.analysis_origin,
                provenance: saved.provenance,
                analysis: saved.analysis,
                analysis_message: saved.analysis_message,
                contact_confirmed_at: saved.contact_confirmed_at,
              };
            });
        } catch {
          setNotice(
            "Could not restore local changes. Original enquiries loaded.",
          );
        }
        setRows(data);
      } else if (s.authenticated) setRows((await api("/api/crm")).rows);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (detail === null && !help) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector(
      "[role=dialog]",
    ) as HTMLElement | null;
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,summary,[href]",
        ) || [],
      );
    controls()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetail(null);
        setHelp(false);
      }
      if (e.key === "Tab") {
        const c = controls(),
          first = c[0],
          last = c[c.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [detail, help]);
  useEffect(() => {
    setPage(0);
  }, [query, type, stage, programme]);
  useEffect(() => {
    if (screen !== "AI Enquiry Processor" || creating) return;
    const visible = allRows.filter(
      (r) =>
        (dataset === "All enquiries" ||
          (dataset === "Manual entries"
            ? r.origin === "Manual Entry"
            : r.origin !== "Manual Entry")) &&
        r.needs_human_review === (reviewFilter === "Pending"),
    );
    if (!visible.some((r) => r.id === selected)) {
      const first = visible[0]?.id ?? 0;
      if (selected !== first) setSelected(first);
    }
  }, [allRows, dataset, reviewFilter, selected, screen, creating]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/session", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setCode("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveRecord(input: SaveInput) {
    let updated: Enquiry;
    if (mode === "demo") {
      const persisted = JSON.parse(localStorage.getItem(STORAGE) || "null") as
        Enquiry[] | null;
      const current =
        persisted?.find((r) => r.id === input.id) ||
        rows.find((r) => r.id === input.id)!;
      updated = applySave(current, input);
      const next = (persisted || rows).map((r) =>
        r.id === updated.id ? updated : r,
      );
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setRows(next);
    } else {
      updated = (
        await api("/api/crm", { method: "PATCH", body: JSON.stringify(input) })
      ).row;
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    }
    setNotice("Changes saved.");
    return updated;
  }
  async function createRecord(input: CreateInput) {
    const row: Enquiry = (
      await api("/api/crm", { method: "POST", body: JSON.stringify(input) })
    ).row;
    setRows((previous) =>
      previous.some((r) => r.id === row.id) ? previous : [...previous, row],
    );
    setDataset("All enquiries");
    setReviewFilter(row.needs_human_review ? "Pending" : "Reviewed");
    setSelected(row.id);
    setCreating(false);
    setPipelineAll(true);
    setNotice("New enquiry saved · Manual Entry. Official dataset preserved.");
    return row;
  }
  const filtered = filterRows(rows, query, type, stage, programme),
    sales = rows.filter((r) => r.enquiry_type === "Sales"),
    review = rows.filter((r) => r.needs_human_review),
    paid = sales.filter((r) => r.status === "Paid");
  const detailRow = rows.find((r) => r.id === detail);
  function navigate(s: Screen) {
    setCreating(false);
    if (s === "AI Enquiry Processor") {
      setReviewFilter("Pending");
      setSelected(rows.find((r) => r.needs_human_review)?.id ?? 0);
    }
    setScreen(s);
    setQuery("");
    setType("All");
    setStage("All");
    setProgramme("All");
    setMobile(false);
  }
  function openAI(id: number) {
    setCreating(false);
    const enquiry = rows.find((r) => r.id === id);
    if (enquiry) {
      setReviewFilter(enquiry.needs_human_review ? "Pending" : "Reviewed");
    }
    setSelected(id);
    setScreen("AI Enquiry Processor");
    setDetail(null);
  }
  function chooseReviewFilter(value: "Pending" | "Reviewed") {
    setReviewFilter(value);
    setSelected(
      rows.find((r) => r.needs_human_review === (value === "Pending"))?.id ?? 0,
    );
  }
  async function saveFromProcessor(input: SaveInput) {
    const index = processorRows.findIndex((r) => r.id === input.id);
    const updated = await saveRecord(input);
    if (updated.needs_human_review !== (reviewFilter === "Pending")) {
      const remaining = processorRows.filter((r) => r.id !== input.id);
      setSelected(remaining[Math.min(Math.max(index, 0), remaining.length - 1)]?.id ?? 0);
    }
    return updated;
  }
  function exportCSV() {
    const url = URL.createObjectURL(
      new Blob([csvExport(filtered)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "BIAI-enquiries.csv";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Filtered enquiries exported.");
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Dashboard");
          }}
        >
          <span className="brand-mark">
            b<span>✳</span>
          </span>
          <div>
            BIAI<span>SMART CRM</span>
          </div>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {NAV.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-label={name}
              className={screen === name ? "active" : ""}
              onClick={() => navigate(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Enquiry List" && <b>{rows.length || 20}</b>}
              {name === "AI Enquiry Processor" && (
                <span className="new-label">AI</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ThemeToggle />
          <button className="help-button" onClick={() => setHelp(true)}>
            <HelpCircle size={17} />
            Workspace guide
            <ArrowUpRight size={14} />
          </button>
          <div className="profile">
            <Avatar name="BIAI Reviewer" />
            <div>
              Reviewer<small>BIAI team</small>
            </div>
            {auth && (
              <button
                className="icon-button"
                title="Sign out"
                onClick={async () => {
                  await api("/api/session", { method: "DELETE" });
                  setAuth(false);
                  setRows([]);
                }}
              >
                <LogOut size={16} />
              </button>
            )}
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>{screen}</b>
          </div>
          <div className="topbar-right">
            <span className="workspace-status">
              <i />
              {mode === "database"
                ? "Connected workspace"
                : mode === "demo"
                  ? "Demo workspace"
                  : "Connecting"}
            </span>
            <span className="top-divider" />
            <Avatar name="BIAI Reviewer" />
          </div>
        </header>
        <div className="content">
          {auth && mode === "database" && (
            <div className="creation-toolbar">
              <Select
                label="Dataset view"
                value={dataset}
                options={[
                  "Official dataset",
                  "All enquiries",
                  "Manual entries",
                ]}
                onChange={(value) => {
                  setDataset(value);
                  setPage(0);
                  setDetail(null);
                }}
              />
              <span className="muted">
                Official dataset:{" "}
                {allRows.filter((r) => r.origin !== "Manual Entry").length} ·
                Manual entries:{" "}
                {allRows.filter((r) => r.origin === "Manual Entry").length}
              </span>
              <button
                className="primary"
                onClick={() => {
                  setCreating(true);
                  setScreen("AI Enquiry Processor");
                }}
              >
                <Plus size={16} />
                New Enquiry
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">BIAI SMART CRM</div>
              <h1>
                {screen === "Dashboard"
                  ? "Dashboard"
                  : screen === "Pipeline"
                    ? "Sales pipeline"
                    : screen}
              </h1>
              <p>
                {screen === "Dashboard"
                  ? "A clear view of your enquiries, follow-ups and opportunities."
                  : screen === "AI Enquiry Processor"
                    ? "From a customer message to a thoughtful, reviewed response."
                    : screen === "Enquiry List"
                      ? "Keep the context. Find the right conversation. Make the next move."
                      : "Move conversations forward, one meaningful step at a time."}
              </p>
            </div>
            {screen === "Dashboard" ? (
              <button
                className="primary"
                onClick={() => navigate("AI Enquiry Processor")}
              >
                <Sparkles size={16} />
                Process enquiry
              </button>
            ) : screen === "Enquiry List" ? (
              <button
                className="button"
                onClick={exportCSV}
                disabled={!rows.length}
              >
                <Download size={16} />
                Export CSV
              </button>
            ) : screen === "Pipeline" ? (
              <button
                className="primary"
                onClick={() => navigate("Enquiry List")}
              >
                <Plus size={16} />
                Review enquiries
              </button>
            ) : (
              <span className="secure-label">
                <ShieldCheck size={15} />
                Human-reviewed AI
              </span>
            )}
          </div>
          {mode === "demo" && (
            <div className="demo-banner">
              <Globe size={15} />
              <span>
                <strong>Local demo</strong> · Your edits stay in this browser.
                Connect Neon and Gemini to enable shared saves and live AI.
              </span>
            </div>
          )}
          {error && (
            <div role="alert" className="alert error">
              <AlertCircle size={17} />
              {error}
              <button onClick={() => void load()} className="text-button">
                Retry
              </button>
            </div>
          )}
          {mode === "loading" && !error && (
            <div className="empty">
              <Loader2 className="spin" />
              <h3>Opening your workspace…</h3>
            </div>
          )}
          {mode === "database" && !auth && (
            <form className="login-card" onSubmit={login}>
              <span className="sparkle-box">
                <ShieldCheck />
              </span>
              <h2>Welcome to BIAI</h2>
              <p>
                Enter your reviewer access code to open the shared workspace.
              </p>
              <label className="field">
                <span>Access code</span>
                <input
                  autoComplete="current-password"
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <ArrowRight size={16} />
                )}
                Open workspace
              </button>
            </form>
          )}
          {!!rows.length && (
            <>
              {screen === "Dashboard" && (
                <>
                  <div className="stats">
                    <Stat
                      label="Total enquiries"
                      value={rows.length}
                      note={`${new Set(rows.map((r) => r.original_phone || "source:" + r.id)).size} unique contacts`}
                      icon={<Users />}
                    />
                    <Stat
                      label="Needs review"
                      value={review.length}
                      note="Ready for a human touch"
                      icon={<Sparkles />}
                      tone="violet"
                    />
                    <Stat
                      label="Sales opportunities"
                      value={sales.length}
                      note="Classified sales enquiries"
                      icon={<Columns3 />}
                      tone="blue"
                    />
                    <Stat
                      label="Paid enquiries"
                      value={paid.length}
                      note="Staff-verified payments"
                      icon={<CheckCircle2 />}
                      tone="green"
                    />
                  </div>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>
                            Enquiry inbox{" "}
                            <span className="count">{review.length}</span>
                          </h2>
                          <p>Pending enquiries, ready for your review</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => navigate("Enquiry List")}
                        >
                          View all <ArrowUpRight size={15} />
                        </button>
                      </div>
                      <div className="inbox-list">
                        {review.length === 0 && (
                          <div className="empty">No pending enquiries. You’re all caught up.</div>
                        )}
                        {review.slice(0, 6).map((r) => (
                          <button
                            className="inbox-row"
                            key={r.id}
                            onClick={() => openAI(r.id)}
                          >
                            <Avatar name={r.name} id={r.id} />
                            <div>
                              <strong>{shortName(r.name)}</strong>
                              <p>{r.message}</p>
                              <Channel value={r.channel} />
                            </div>
                            <span>
                              <Badge kind={r.status}>{r.status}</Badge>
                              <small>#{String(r.id).padStart(2, "0")}</small>
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        ))}
                      </div>
                    </section>
                    <div className="overview-side">
                      <section className="panel funnel">
                        <div className="panel-header">
                          <div>
                            <h2>Pipeline snapshot</h2>
                            <p>Sales enquiries by stage</p>
                          </div>
                          <Columns3 size={17} />
                        </div>
                        {STAGES.map((s) => {
                          const n = sales.filter((r) => r.status === s).length;
                          return (
                            <div className="stage-meter" key={s}>
                              <div>
                                <span>
                                  <i className={"stage-dot " + stageClass(s)} />
                                  {s}
                                </span>
                                <b>{n}</b>
                              </div>
                              <div className="meter">
                                <i
                                  className={stageClass(s)}
                                  style={{
                                    width: sales.length
                                      ? `${(n / sales.length) * 100}%`
                                      : "0%",
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        <button
                          className="button full"
                          onClick={() => navigate("Pipeline")}
                        >
                          Open pipeline <ArrowRight size={15} />
                        </button>
                      </section>
                      <section className="next-step">
                        <span className="sparkle-box">
                          <Sparkles size={20} />
                        </span>
                        <h2>Start with a conversation.</h2>
                        <p>
                          Let AI suggest a programme, identify intent and draft
                          a reply. You decide what gets saved.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => navigate("AI Enquiry Processor")}
                        >
                          Open AI processor <ArrowRight size={15} />
                        </button>
                      </section>
                    </div>
                  </div>
                </>
              )}
              {screen === "AI Enquiry Processor" && creating && (
                <NewEnquiry
                  onSave={createRecord}
                  aiEnabled={aiReady}
                  onCancel={() => setCreating(false)}
                />
              )}
              {screen === "AI Enquiry Processor" && !creating && (
                <>
                  <ProcessorSelector
                    reviewFilter={reviewFilter}
                    onFilterChange={chooseReviewFilter}
                    rows={processorRows}
                    selected={processorActive?.id ?? 0}
                    onSelect={setSelected}
                  />
                  {processorActive ? (
                    <Processor
                      key={`${processorActive.id}:${processorActive.version}`}
                      record={processorActive}
                      onSave={saveFromProcessor}
                      aiEnabled={mode === "database" && aiReady}
                      notify={setNotice}
                    />
                  ) : (
                    <section className="panel empty processor-empty" aria-live="polite">
                      <CheckCircle2 size={27} />
                      <h3>
                        {reviewFilter === "Pending"
                          ? "All caught up! There are no pending enquiries to review."
                          : "No reviewed enquiries yet."}
                      </h3>
                      <p>
                        {reviewFilter === "Pending"
                          ? "Choose Reviewed to revisit saved enquiries, or add a new enquiry."
                          : "Choose Pending to review an enquiry."}
                      </p>
                    </section>
                  )}
                </>
              )}
              {screen === "Enquiry List" && (
                <section className="panel list-panel">
                  <div className="table-title">
                    <h2>
                      All enquiries <span className="count">{rows.length}</span>
                    </h2>
                    <span className="muted">Original messages preserved</span>
                  </div>
                  <div className="type-tabs">
                    {[
                      "All",
                      "Sales",
                      "Support",
                      "Job Enquiry",
                      "Spam",
                      "Unclassified",
                    ].map((t) => (
                      <button
                        className={type === t ? "active" : ""}
                        key={t}
                        onClick={() => setType(t)}
                      >
                        {t}
                        <span>
                          {t === "All"
                            ? rows.length
                            : rows.filter((r) => r.enquiry_type === t).length}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="filters">
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="Search enquiries"
                        value={query}
                        placeholder="Search name, phone or message…"
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          onClick={() => setQuery("")}
                          aria-label="Clear search"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <Select
                      label="Stage"
                      value={stage}
                      options={["All", ...STAGES]}
                      onChange={setStage}
                    />
                    <Select
                      label="Programme"
                      value={programme}
                      options={["All", ...PROGRAMMES]}
                      onChange={setProgramme}
                    />
                    <button
                      className="icon-button"
                      title="Reset filters"
                      onClick={() => {
                        setQuery("");
                        setType("All");
                        setStage("All");
                        setProgramme("All");
                      }}
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Contact</th>
                          <th>Channel</th>
                          <th>Programme</th>
                          <th>Type</th>
                          <th>Stage</th>
                          <th>Review</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(page * 8, page * 8 + 8).map((r) => (
                          <tr key={r.id} onClick={() => setDetail(r.id)}>
                            <td>
                              <div className="contact-cell">
                                <Avatar name={r.name} id={r.id} />
                                <div>
                                  <button
                                    className="contact-name"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDetail(r.id);
                                    }}
                                  >
                                    {shortName(r.name)}
                                  </button>
                                  <small>
                                    {r.phone || "No phone provided"}
                                  </small>
                                  <small className="provenance">
                                    {r.origin || "Official Dataset"}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <Channel value={r.channel} />
                            </td>
                            <td>
                              <span
                                className={
                                  r.programme === "Unclassified" ? "muted" : ""
                                }
                              >
                                {r.programme}
                              </span>
                            </td>
                            <td>
                              <span className="type-label">
                                {r.enquiry_type}
                              </span>
                            </td>
                            <td>
                              <Badge kind={r.status}>{r.status}</Badge>
                            </td>
                            <td>
                              {r.needs_human_review ? (
                                <span className="review-dot">
                                  <i />
                                  Pending
                                </span>
                              ) : (
                                <span className="reviewed">
                                  <Check size={13} />
                                  Reviewed
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={"Process enquiry from " + r.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAI(r.id);
                                }}
                              >
                                <ArrowUpRight size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!filtered.length && (
                    <div className="empty">
                      <Search />
                      <h3>No matching enquiries</h3>
                      <p>Try a different search or clear your filters.</p>
                    </div>
                  )}
                  <div className="pagination">
                    <span>
                      Showing {filtered.length ? page * 8 + 1 : 0}–
                      {Math.min(page * 8 + 8, filtered.length)} of{" "}
                      {filtered.length} enquiries
                    </span>
                    <div>
                      <button
                        className="button"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                      >
                        <ChevronLeft size={14} />
                        Previous
                      </button>
                      <span className="page-number">{page + 1}</span>
                      <button
                        className="button"
                        disabled={(page + 1) * 8 >= filtered.length}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </section>
              )}
              {screen === "Pipeline" && (
                <>
                  <div className="pipeline-toolbar">
                    <div className="segmented">
                      <button
                        className={!pipelineAll ? "active" : ""}
                        onClick={() => setPipelineAll(false)}
                      >
                        Sales only <span>{sales.length}</span>
                      </button>
                      <button
                        className={pipelineAll ? "active" : ""}
                        onClick={() => setPipelineAll(true)}
                      >
                        All enquiries <span>{rows.length}</span>
                      </button>
                    </div>
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="Search pipeline"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search pipeline…"
                      />
                    </label>
                    <Select
                      label="Programme"
                      value={programme}
                      options={["All", ...PROGRAMMES]}
                      onChange={setProgramme}
                    />
                  </div>
                  {!sales.length && !pipelineAll && (
                    <div className="pipeline-hint">
                      <Sparkles size={19} />
                      <div>
                        <strong>
                          Your next opportunity starts in the inbox.
                        </strong>
                        <p>
                          Classify an enquiry as Sales to add it here, or select
                          All enquiries to see the original records.
                        </p>
                      </div>
                      <button
                        className="button"
                        onClick={() => navigate("AI Enquiry Processor")}
                      >
                        Review inbox <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                  <div className="board">
                    {STAGES.map((s, i) => {
                      const cards = filterRows(
                        rows,
                        query,
                        pipelineAll ? "All" : "Sales",
                        s,
                        programme,
                      );
                      return (
                        <section
                          key={s}
                          className={"board-column " + stageClass(s)}
                        >
                          <div className="column-heading">
                            <span>
                              <i className={"stage-dot " + stageClass(s)} />
                              {s}
                              <b>{cards.length}</b>
                            </span>
                            <span className="column-step">0{i + 1}</span>
                          </div>
                          <div className="column-cards">
                            {cards.map((r) => (
                              <button
                                className="deal-card"
                                key={r.id}
                                onClick={() => setDetail(r.id)}
                              >
                                <div className="deal-top">
                                  <span>{r.programme}</span>
                                  <ArrowUpRight size={14} />
                                </div>
                                {r.analysis?.recommended_pipeline_stage && (
                                  <span className="ai-pipeline-label">
                                    <Sparkles size={12} />
                                    AI suggestion · review
                                  </span>
                                )}
                                <h3>{shortName(r.name)}</h3>
                                <small className="provenance">
                                  {r.origin || "Official Dataset"}
                                </small>
                                <p>{r.customer_intent || r.message}</p>
                                <Channel value={r.channel} />
                                <div className="deal-footer">
                                  <span>
                                    <Avatar name={r.name} id={r.id} />
                                    <small>
                                      #{String(r.id).padStart(2, "0")}
                                    </small>
                                  </span>
                                  {r.needs_human_review ? (
                                    <span className="review-chip">
                                      Needs review
                                    </span>
                                  ) : (
                                    <span className="review-chip done">
                                      Reviewed
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))}
                            {!cards.length && (
                              <div className="empty-column">
                                <span>◇</span>
                                <p>No enquiries yet</p>
                                <small>
                                  {s === "Paid"
                                    ? "Verified payments appear here."
                                    : "Move a reviewed enquiry to this stage."}
                                </small>
                              </div>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                  <p className="board-note">
                    <ShieldCheck size={14} />
                    Open a card to change its stage. Paid requires independent
                    payment verification.
                  </p>
                </>
              )}
            </>
          )}
        </div>
        <footer className="footer">
          <span>BIAI Smart CRM</span>
          <span>Thoughtful conversations. Clearer next steps.</span>
          <span>Round 2 · Demo</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {detailRow && (
        <div className="drawer-backdrop" onClick={() => setDetail(null)}>
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Enquiry details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <span>ENQUIRY #{String(detailRow.id).padStart(2, "0")}</span>
              <button
                className="icon-button"
                aria-label="Close detail panel"
                onClick={() => setDetail(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="drawer-person">
              <Avatar name={detailRow.name} id={detailRow.id} />
              <h2>{shortName(detailRow.name)}</h2>
              <small>{detailRow.origin || "Official Dataset"}</small>
              <Channel value={detailRow.channel} />
            </div>
            <div className="source-message">{detailRow.message}</div>
            <RecordForm
              key={`${detailRow.id}:${detailRow.version}`}
              record={detailRow}
              onSave={saveRecord}
            />
            <button
              className="button full"
              onClick={() => openAI(detailRow.id)}
            >
              <Sparkles size={16} />
              Open in AI processor
            </button>
          </section>
        </div>
      )}
      {help && (
        <div className="drawer-backdrop" onClick={() => setHelp(false)}>
          <section
            className="help-modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace guide"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button close"
              aria-label="Close guide"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <span className="sparkle-box">
              <Sparkles />
            </span>
            <h2>Your workspace, in four steps.</h2>
            <ol>
              <li>
                <strong>Choose a conversation.</strong> All 20 original
                enquiries start as New and Unclassified.
              </li>
              <li>
                <strong>Review AI suggestions.</strong> Analyse the original
                message or paste text. Verify identity, intent and the proposed
                reply.
              </li>
              <li>
                <strong>Save your decision.</strong> Source messages stay
                unchanged. Replies are drafts; copying a reply does not send it.
              </li>
              <li>
                <strong>Follow up.</strong> Move Sales enquiries through New,
                Contacted, Interested, Paid or Lost. Verify payments separately.
              </li>
            </ol>
            <p>
              {mode === "demo"
                ? "This local demo saves edits in this browser only. AI requires the server environment settings in the README."
                : "Shared changes are stored in PostgreSQL. AI usage is capped daily."}
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Got it <Check size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon,
  tone = "",
}: {
  label: string;
  value: number;
  note: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="stat">
      <div>
        <h2 className="stat-title">{label}</h2>
        <i className={"stat-icon " + tone}>{icon}</i>
      </div>
      <strong>{String(value).padStart(2, "0")}</strong>
      <p>{note}</p>
    </div>
  );
}
function RecordForm({
  record,
  onSave,
}: {
  record: Enquiry;
  onSave: (v: SaveInput) => Promise<Enquiry>;
}) {
  const [draft, setDraft] = useState(editable(record)),
    [payment, setPayment] = useState(false),
    [identity, setIdentity] = useState(false),
    [follow, setFollow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const field = (k: keyof Editable, v: unknown) =>
    setDraft((d) => ({ ...d, [k]: v }));
  return (
    <form
      className="record-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave({
            id: record.id,
            version: record.version,
            changes: draft,
            paymentVerified: payment,
            identityApproved: identity,
            followUp: follow,
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>Contact name</span>
          <small className="provenance">
            {draft.name !== record.name
              ? "Manual"
              : fieldOrigin(record, "name")}
          </small>
          <input
            aria-label="Contact name"
            value={draft.name}
            onChange={(e) => field("name", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Phone</span>
          <small className="provenance">
            {draft.phone !== record.phone
              ? "Manual"
              : fieldOrigin(record, "phone")}
          </small>
          <input
            aria-label="Phone"
            value={draft.phone}
            onChange={(e) => field("phone", e.target.value)}
          />
        </label>
        <Select
          label="Programme"
          options={PROGRAMMES}
          value={draft.programme}
          onChange={(v) => field("programme", v)}
        />
        <Select
          label="Enquiry type"
          options={TYPES}
          value={draft.enquiry_type}
          onChange={(v) => field("enquiry_type", v)}
        />
      </div>
      {record.analysis && (
        <PipelineRecommendation
          analysis={record.analysis}
          message={record.analysis_message || record.message}
          record={record}
          draftStage={draft.status}
          enquiryType={draft.enquiry_type}
          onApply={(stage) => field("status", stage)}
          disabled={busy}
        />
      )}
      <Select
        label="Pipeline stage"
        options={STAGES}
        value={draft.status}
        onChange={(v) => field("status", v)}
      />
      {draft.status === "Contacted" && (
        <p className="muted">
          By saving Contacted, you confirm that staff have actually contacted
          this customer.
        </p>
      )}
      <label className="field">
        <span>Customer intent / notes</span>
        <textarea
          value={draft.customer_intent}
          onChange={(e) => field("customer_intent", e.target.value)}
          rows={3}
        />
      </label>
      <ReviewStatus
        pending={draft.needs_human_review}
        onChange={(value) => field("needs_human_review", value)}
      />
      {(draft.name !== record.name || draft.phone !== record.phone) && (
        <label className="checkbox warning">
          <input
            type="checkbox"
            checked={identity}
            onChange={(e) => setIdentity(e.target.checked)}
          />
          I approve this identity correction.
        </label>
      )}
      {draft.status === "Paid" && record.status !== "Paid" && (
        <label className="checkbox warning">
          <input
            type="checkbox"
            checked={payment}
            onChange={(e) => setPayment(e.target.checked)}
          />
          I independently verified the payment.
        </label>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={follow}
          onChange={(e) => setFollow(e.target.checked)}
        />
        Record a completed follow-up now
      </label>
      {record.last_follow_up && (
        <p className="muted">
          Last follow-up: {new Date(record.last_follow_up).toLocaleString()}
        </p>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <button className="primary full" disabled={busy}>
        {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
        Save changes
      </button>
      <details>
        <summary>Original source details</summary>
        <p>
          {record.original_name}
          <br />
          {record.original_phone || "No phone provided"}
          <br />
          {record.received}
        </p>
      </details>
    </form>
  );
}
function ProcessorSelector({
  reviewFilter,
  onFilterChange,
  rows,
  selected,
  onSelect,
}: {
  reviewFilter: "Pending" | "Reviewed";
  onFilterChange: (value: "Pending" | "Reviewed") => void;
  rows: Enquiry[];
  selected: number;
  onSelect: (id: number) => void;
}) {
  const position = rows.findIndex((r) => r.id === selected);
  return (
    <div className="processor-toolbar">
      <div className="processor-select">
        <span className="tiny-label">CURRENT ENQUIRY</span>
        <label className="processor-selector-field">
          <span>Review status</span>
          <select
            aria-label="Filter enquiries by review status"
            value={reviewFilter}
            onChange={(e) => onFilterChange(e.target.value as "Pending" | "Reviewed")}
          >
            <option value="Pending">Pending</option>
            <option value="Reviewed">Reviewed</option>
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="processor-selector-field processor-enquiry-field">
          <span>Select enquiry</span>
          <select
            aria-label="Choose enquiry"
            value={position >= 0 ? selected : ""}
            disabled={!rows.length}
            onChange={(e) => onSelect(Number(e.target.value))}
          >
            {!rows.length && <option value="">No {reviewFilter.toLowerCase()} enquiries</option>}
            {rows.map((r) => (
              <option value={r.id} key={r.id}>
                #{String(r.id).padStart(2, "0")} · {shortName(r.name)}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <div className="processor-counter">
        <span>{rows.length ? `${position + 1} of ${rows.length}` : "0 of 0"}</span>
        <button
          className="icon-button"
          aria-label="Previous enquiry"
          disabled={position <= 0}
          onClick={() => onSelect(rows[position - 1].id)}
        >
          <ChevronLeft size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Next enquiry"
          disabled={position < 0 || position >= rows.length - 1}
          onClick={() => onSelect(rows[position + 1].id)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
function Processor({
  record,
  onSave,
  aiEnabled,
  notify,
}: {
  record: Enquiry;
  onSave: (v: SaveInput) => Promise<Enquiry>;
  aiEnabled: boolean;
  notify: (s: string) => void;
}) {
  const [draft, setDraft] = useState<Editable>(editable(record)),
    [sourceMode, setSourceMode] = useState<"official" | "paste">("official"),
    [pasted, setPasted] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [identity, setIdentity] = useState(false),
    [payment, setPayment] = useState(false),
    [analysis, setAnalysis] = useState<Analysis | null>(
      record.analysis ?? null,
    ),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [provenance, setProvenance] = useState<
    NonNullable<SaveInput["provenance"]>
  >({});
  const message = sourceMode === "official" ? record.message : pasted;
  const field = (k: keyof Editable, v: unknown) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setProvenance((p) => ({ ...p, [k]: "Manual" }));
  };
  async function run(regenerate = false) {
    setBusy(regenerate ? "regenerate" : "analyze");
    setError("");
    try {
      const current: Analysis = {
        ...(analysis || {}),
        customer_name: analysis?.customer_name ?? null,
        phone_number: analysis?.phone_number ?? null,
        programme: draft.programme,
        enquiry_type: draft.enquiry_type,
        detected_language: draft.detected_language,
        customer_intent: draft.customer_intent || "Staff review",
        suggested_reply: draft.suggested_reply,
        needs_human_review: draft.needs_human_review,
      };
      const out = (
        await api("/api/ai", {
          method: "POST",
          body: JSON.stringify({
            message,
            enquiryId: record.id,
            ...(regenerate ? { current } : {}),
          }),
        })
      ).analysis as Analysis;
      setAnalysis(out);
      if (regenerate) field("suggested_reply", out.suggested_reply);
      else
        setDraft((d) => ({
          ...d,
          programme: out.programme,
          enquiry_type: out.enquiry_type,
          detected_language: out.detected_language,
          customer_intent: out.customer_intent,
          suggested_reply: out.suggested_reply,
          needs_human_review: out.needs_human_review,
        }));
      setProvenance((p) => ({
        ...p,
        ...Object.fromEntries(
          (regenerate
            ? ["suggested_reply"]
            : [
                "programme",
                "enquiry_type",
                "detected_language",
                "customer_intent",
                "suggested_reply",
                "needs_human_review",
              ]
          ).map((key) => [key, "Extracted by AI"]),
        ),
      }));
      notify("AI draft ready. Review it before saving.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function save() {
    setBusy("save");
    setError("");
    try {
      if (sourceMode === "paste" && !confirmed)
        throw Error(
          "Confirm the target enquiry before saving pasted-text results.",
        );
      await onSave({
        id: record.id,
        version: record.version,
        changes: draft,
        paymentVerified: payment,
        identityApproved: identity,
        followUp: false,
        analysisMessage: message,
        targetConfirmed: confirmed,
        provenance,
        ...(analysis ? { analysis } : {}),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function resetSource(mode: "official" | "paste") {
    setSourceMode(mode);
    setDraft(editable(record));
    setAnalysis(null);
    setProvenance({});
    setConfirmed(false);
    setError("");
  }
  return (
    <>
      <div className="processor-grid">
        <section className="message-panel panel">
          <div className="panel-header">
            <div className="section-label">
              <MessageSquare size={18} />
              <h2>Conversation</h2>
            </div>
            <Badge kind={record.status}>{record.status}</Badge>
          </div>
          <div className="message-contact">
            <Avatar name={record.name} id={record.id} />
            <div>
              <strong>{shortName(record.name)}</strong>
              <Channel value={record.channel} />
              <small className="provenance">
                {record.origin || "Official Dataset"}
              </small>
            </div>
            <span>{record.received.split(" ")[0]}</span>
          </div>
          <div className="message-body">
            <div className="segmented compact">
              <button
                className={sourceMode === "official" ? "active" : ""}
                disabled={!!busy}
                onClick={() => resetSource("official")}
              >
                Original enquiry
              </button>
              <button
                className={sourceMode === "paste" ? "active" : ""}
                disabled={!!busy}
                onClick={() => resetSource("paste")}
              >
                Paste a message
              </button>
            </div>
            <div className="conversation-date">
              <span>Original message · {record.received.slice(11)}</span>
            </div>
            <div className="chat-row">
              <Avatar name={record.name} id={record.id} />
              <div>
                {sourceMode === "official" ? (
                  <div className="message-bubble">{record.message}</div>
                ) : (
                  <textarea
                    aria-label="Pasted message"
                    disabled={!!busy}
                    className="paste-area"
                    placeholder="Paste the customer’s message here…"
                    rows={7}
                    maxLength={15000}
                    value={pasted}
                    onChange={(e) => {
                      setPasted(e.target.value);
                      setAnalysis(null);
                      setProvenance({});
                      setConfirmed(false);
                      setDraft(editable(record));
                    }}
                  />
                )}
                <span className="message-meta">
                  {sourceMode === "official"
                    ? record.origin === "Manual Entry"
                      ? "Manual Entry · original message preserved"
                      : "Preserved from the official dataset"
                    : "Pasted text reviews this selected record. Use + New Enquiry for a new customer."}
                </span>
              </div>
            </div>
            <div className="ai-intro">
              <span className="sparkle-box">
                <Sparkles size={20} />
              </span>
              <div>
                <strong>A thoughtful next step, with AI.</strong>
                <p>
                  Extract intent, classify the enquiry and prepare a reply in
                  the customer’s language.
                </p>
              </div>
            </div>
            {analysis && (
              <div className="ai-complete">
                <CheckCircle2 size={17} />
                <div>
                  <strong>Your draft is ready to review.</strong>
                  <p>
                    Check the details and response in the panel on the right.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="message-action">
            {!aiEnabled && (
              <p className="muted">
                Live AI is not configured. You can still review and save
                manually.
              </p>
            )}
            <button
              className="primary full"
              disabled={!!busy || !aiEnabled || !message.trim()}
              onClick={() => void run()}
            >
              {busy === "analyze" ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <Sparkles size={17} />
              )}{" "}
              {busy === "analyze"
                ? "Analysing the conversation…"
                : "Analyse enquiry"}
              <ArrowRight size={16} />
            </button>
            <p className="privacy-note">
              <ShieldCheck size={12} />
              AI suggests. Your team decides.
            </p>
          </div>
        </section>
        <section className="review-panel panel">
          <div className="panel-header">
            <div className="section-label">
              <SlidersHorizontal size={18} />
              <h2>Review & prepare</h2>
            </div>
            <span className="draft-label">Editable draft</span>
          </div>
          <div className="review-content">
            <div className="form-section-heading">
              <span>01</span>
              <h3>Contact & classification</h3>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Contact name</span>
                <small className="provenance">
                  {draft.name
                    ? provenance.name || fieldOrigin(record, "name")
                    : "Not provided"}
                </small>
                <input
                  aria-label="Contact name"
                  value={draft.name}
                  maxLength={250}
                  onChange={(e) => field("name", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Phone number</span>
                <small className="provenance">
                  {draft.phone
                    ? provenance.phone || fieldOrigin(record, "phone")
                    : "Not provided"}
                </small>
                <input
                  aria-label="Phone number"
                  value={draft.phone}
                  placeholder="Not provided"
                  maxLength={100}
                  onChange={(e) => field("phone", e.target.value)}
                />
              </label>
            </div>
            {analysis && (analysis.customer_name || analysis.phone_number) && (
              <div className="identity-suggestion">
                <p>
                  Extracted by AI from message:{" "}
                  {analysis.customer_name || "No name"} ·{" "}
                  {analysis.phone_number || "No phone"}
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    if (analysis.customer_name)
                      field("name", analysis.customer_name);
                    if (analysis.phone_number)
                      field("phone", analysis.phone_number);
                    setProvenance((p) => ({
                      ...p,
                      ...(analysis.customer_name
                        ? { name: "Extracted by AI" }
                        : {}),
                      ...(analysis.phone_number
                        ? { phone: "Extracted by AI" }
                        : {}),
                    }));
                  }}
                >
                  Use extracted details <ArrowRight size={13} />
                </button>
              </div>
            )}
            <div className="form-grid">
              <Select
                label="Programme"
                hint={provenance.programme || fieldOrigin(record, "programme")}
                options={PROGRAMMES}
                value={draft.programme}
                onChange={(v) => field("programme", v)}
              />
              <Select
                label="Enquiry type"
                hint={
                  provenance.enquiry_type || fieldOrigin(record, "enquiry_type")
                }
                options={TYPES}
                value={draft.enquiry_type}
                onChange={(v) => field("enquiry_type", v)}
              />
              <Select
                label="Language"
                hint={
                  provenance.detected_language ||
                  fieldOrigin(record, "detected_language")
                }
                options={LANGUAGES}
                value={draft.detected_language}
                onChange={(v) => field("detected_language", v)}
              />
              <Select
                label="Pipeline stage"
                options={STAGES}
                value={draft.status}
                onChange={(v) => field("status", v)}
              />
            </div>
            {draft.status === "Contacted" && (
              <p className="muted">
                By saving Contacted, you confirm that staff have actually
                contacted this customer.
              </p>
            )}
            {analysis && (
              <PipelineRecommendation
                analysis={analysis}
                message={
                  analysis === record.analysis
                    ? record.analysis_message || message
                    : message
                }
                record={record}
                draftStage={draft.status}
                enquiryType={draft.enquiry_type}
                onApply={(stage) => field("status", stage)}
                disabled={!!busy}
              />
            )}
            <label className="field">
              <span>Customer intent</span>
              <small className="provenance">
                {provenance.customer_intent ||
                  fieldOrigin(record, "customer_intent")}
              </small>
              <textarea
                rows={2}
                maxLength={1500}
                aria-label="Customer intent"
                placeholder="What does this customer need?"
                value={draft.customer_intent}
                onChange={(e) => field("customer_intent", e.target.value)}
              />
            </label>
            <div className="form-section-heading reply-heading">
              <span>02</span>
              <h3>Suggested reply</h3>
              <small className="provenance">
                {provenance.suggested_reply ||
                  fieldOrigin(record, "suggested_reply")}
              </small>
              <button
                className="text-button"
                disabled={!!busy || !aiEnabled || !message.trim()}
                onClick={() => void run(true)}
              >
                <RefreshCw
                  size={13}
                  className={busy === "regenerate" ? "spin" : ""}
                />
                Regenerate
              </button>
            </div>
            <textarea
              aria-label="Suggested reply"
              className="reply-textarea"
              maxLength={4000}
              rows={5}
              value={draft.suggested_reply}
              onChange={(e) => field("suggested_reply", e.target.value)}
              placeholder="Your reply draft will appear here. You can also write it yourself."
            />
            <div className="reply-bottom">
              <span>Draft only · nothing is sent automatically</span>
              <button
                className="text-button"
                disabled={!draft.suggested_reply}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(draft.suggested_reply);
                    notify("Reply copied.");
                  } catch {
                    setError(
                      "Clipboard unavailable. Select the reply text and copy it manually.",
                    );
                  }
                }}
              >
                <Copy size={13} />
                Copy
              </button>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.needs_human_review}
                onChange={(e) => field("needs_human_review", e.target.checked)}
              />
              Flag for human review
            </label>
            {(draft.name !== record.name || draft.phone !== record.phone) && (
              <label className="checkbox warning">
                <input
                  type="checkbox"
                  checked={identity}
                  onChange={(e) => setIdentity(e.target.checked)}
                />
                I approve the name / phone correction.
              </label>
            )}
            {draft.status === "Paid" && record.status !== "Paid" && (
              <label className="checkbox warning">
                <input
                  type="checkbox"
                  checked={payment}
                  onChange={(e) => setPayment(e.target.checked)}
                />
                I independently verified the payment.
              </label>
            )}
            {sourceMode === "paste" && (
              <label className="checkbox warning">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Apply this pasted-message review to #{record.id},{" "}
                {shortName(record.name)}.
              </label>
            )}
            {error && (
              <div role="alert" className="alert error">
                {error}
              </div>
            )}
          </div>
          <div className="review-actions">
            <span>
              <ShieldCheck size={14} />
              Original source protected
            </span>
            <button
              className="primary"
              disabled={!!busy}
              onClick={() => void save()}
            >
              {busy === "save" ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Save reviewed enquiry
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function ReviewStatus({
  pending,
  onChange,
}: {
  pending: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <Select
        label="Review status"
        value={pending ? "Pending" : "Reviewed"}
        options={["Pending", "Reviewed"]}
        onChange={(v) => onChange(v === "Pending")}
      />
      <span className={pending ? "review-pending" : "review-done"}>
        {pending ? <Clock size={13} /> : <CheckCircle2 size={13} />}
        {pending ? "Pending" : "Reviewed"}
      </span>
      <p className="muted">
        Save changes to update review status. Pipeline stage is unchanged.
      </p>
    </div>
  );
}
function NewEnquiry({
  onSave,
  aiEnabled,
  onCancel,
}: {
  onSave: (input: CreateInput) => Promise<Enquiry>;
  aiEnabled: boolean;
  onCancel: () => void;
}) {
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("WhatsApp");
  const [message, setMessage] = useState("");
  const blank = (): Editable => ({
    ...editable(seed()[0]),
    name: "",
    phone: "",
  });
  const [draft, setDraft] = useState<Editable>(blank);
  const [analysis, setAnalysis] = useState<Analysis>();
  const [provenance, setProvenance] = useState<
    NonNullable<CreateInput["provenance"]>
  >({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const attempted = useRef<CreateInput | null>(null);
  function field(key: keyof Editable, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
    setProvenance((p) => ({ ...p, [key]: "Manual" }));
  }
  async function analyze() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const out: Analysis = (
        await api("/api/ai", {
          method: "POST",
          body: JSON.stringify({ message }),
        })
      ).analysis;
      setAnalysis(out);
      setDraft({
        name: out.customer_name || "",
        phone: out.phone_number || "",
        programme: out.programme,
        enquiry_type: out.enquiry_type,
        detected_language: out.detected_language,
        customer_intent: out.customer_intent,
        suggested_reply: out.suggested_reply,
        needs_human_review: out.needs_human_review,
        status: "New",
      });
      setProvenance(
        Object.fromEntries(
          [
            "name",
            "phone",
            "programme",
            "enquiry_type",
            "detected_language",
            "customer_intent",
            "suggested_reply",
            "needs_human_review",
          ]
            .filter((key) => key !== "name" || !!out.customer_name)
            .filter((key) => key !== "phone" || !!out.phone_number)
            .map((key) => [key, "Extracted by AI"]),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    attempted.current ??= {
      requestId: requestId.current,
      channel,
      message,
      changes: { ...draft, status: "New" },
      provenance,
      ...(analysis ? { analysis } : {}),
    };
    try {
      await onSave(attempted.current);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <div className="processor-toolbar">
        <strong>New Enquiry · Manual Entry</strong>
        <button
          type="button"
          className="button"
          disabled={busy || !!attempted.current}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      <fieldset
        disabled={busy || !!attempted.current}
        className="new-enquiry-fields"
      >
        <div className="processor-grid">
          <section className="message-panel panel">
            <div className="panel-header">
              <h2>New customer message</h2>
              <Badge kind="New">New</Badge>
            </div>
            <div className="message-body">
              <Select
                label="Message source"
                value={channel}
                options={CHANNELS}
                onChange={(v) => setChannel(v as typeof channel)}
              />
              <label className="field">
                <span>Raw customer message</span>
                <textarea
                  required
                  rows={9}
                  maxLength={15000}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setAnalysis(undefined);
                    setDraft(blank());
                    setProvenance({});
                  }}
                  placeholder="Paste a new customer message…"
                />
              </label>
              <p className="muted">
                Creates a separate record. Missing names and phone numbers stay
                blank. Manual entries are separate from the 20 official
                assessment records.
              </p>
              <button
                type="button"
                className="primary full"
                disabled={!aiEnabled || !message.trim()}
                onClick={() => void analyze()}
              >
                <Sparkles size={16} />
                Analyze with AI
              </button>
              {!aiEnabled && (
                <p className="muted">
                  Live AI is not configured. You can review and save manually.
                </p>
              )}
            </div>
          </section>
          <section className="review-panel panel">
            <div className="panel-header">
              <h2>Review & prepare</h2>
              <span className="draft-label">Editable draft</span>
            </div>
            <div className="review-content">
              {(
                [
                  ["name", "Contact name"],
                  ["phone", "Phone number"],
                ] as const
              ).map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <small className="provenance">
                    {draft[key] ? provenance[key] || "Manual" : "Not provided"}
                  </small>
                  <input
                    aria-label={label}
                    maxLength={key === "name" ? 250 : 100}
                    value={draft[key]}
                    onChange={(e) => field(key, e.target.value)}
                    placeholder="Not provided"
                  />
                </label>
              ))}
              {(
                [
                  ["programme", "Programme", PROGRAMMES],
                  ["enquiry_type", "Enquiry type", TYPES],
                  ["detected_language", "Language", LANGUAGES],
                ] as const
              ).map(([key, label, options]) => (
                <div key={key}>
                  <Select
                    label={label}
                    value={draft[key]}
                    options={options}
                    onChange={(v) => field(key, v)}
                  />
                  <small className="provenance">
                    {provenance[key] || "Manual"}
                  </small>
                </div>
              ))}
              {(
                [
                  ["customer_intent", "Customer intent"],
                  ["suggested_reply", "Suggested reply"],
                ] as const
              ).map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <small className="provenance">
                    {draft[key] ? provenance[key] || "Manual" : "Not provided"}
                  </small>
                  <textarea
                    aria-label={label}
                    rows={key === "suggested_reply" ? 5 : 2}
                    maxLength={key === "suggested_reply" ? 4000 : 1500}
                    value={draft[key]}
                    onChange={(e) => field(key, e.target.value)}
                  />
                </label>
              ))}
              <Select
                label="Review status"
                value={draft.needs_human_review ? "Pending" : "Reviewed"}
                options={["Pending", "Reviewed"]}
                onChange={(v) => field("needs_human_review", v === "Pending")}
              />
              {analysis && (
                <PipelineRecommendation
                  analysis={analysis}
                  message={message}
                  draftStage="New"
                  enquiryType={draft.enquiry_type}
                  disabled={busy}
                />
              )}
              <p className="muted">
                Pipeline stage: New. Review all details before saving. Nothing
                is sent automatically.
              </p>
            </div>
          </section>
        </div>
      </fieldset>
      {error && (
        <div role="alert" className="alert error">
          {error}
          {attempted.current &&
            " Your original submission is retained. Retry safely with the same details; reload after resolving configuration errors."}
        </div>
      )}
      <div className="review-actions">
        <span>Manual Entry · official dataset protected</span>
        <button className="primary" disabled={busy || !message.trim()}>
          {busy
            ? "Working…"
            : attempted.current
              ? "Retry Save New Enquiry"
              : "Save New Enquiry"}
        </button>
      </div>
    </form>
  );
}

function PipelineRecommendation({
  analysis,
  message,
  record,
  draftStage,
  enquiryType,
  onApply,
  disabled = false,
}: {
  analysis: Analysis;
  message: string;
  record?: Enquiry;
  draftStage: Enquiry["status"];
  enquiryType: Enquiry["enquiry_type"];
  onApply?: (stage: Enquiry["status"]) => void;
  disabled?: boolean;
}) {
  const suggestion = groundPipeline(
    { ...analysis, enquiry_type: enquiryType },
    message,
    pipelineContext(record),
  );
  if (!suggestion.recommended_pipeline_stage) return null;
  const stage = suggestion.recommended_pipeline_stage;
  const blocked =
    !onApply ||
    !!suggestion.payment_verification_required ||
    record?.status === "Paid" ||
    stage === "Paid" ||
    suggestion.pipeline_confidence === "low";
  return (
    <section
      className="pipeline-recommendation"
      aria-label="AI Pipeline Recommendation"
    >
      <h3>
        <Sparkles size={16} />
        AI Pipeline Recommendation
      </h3>
      <div className="pipeline-recommendation-meta">
        <Badge kind={stage}>{stage}</Badge>
        <span>Confidence: {suggestion.pipeline_confidence || "low"}</span>
      </div>
      <p>{suggestion.pipeline_reason}</p>
      {suggestion.payment_verification_required && (
        <p className="payment-warning">
          Payment verification required. Choose Paid manually only after
          independent verification.
        </p>
      )}
      <p className="muted">
        Staff approval required. Apply updates the draft only; use the existing
        Save button to persist it.
      </p>
      {!onApply && (
        <p className="muted">
          Save this new enquiry at New first. You can then review and apply the
          saved suggestion.
        </p>
      )}
      <button
        type="button"
        className="button"
        disabled={disabled || blocked || stage === draftStage}
        onClick={() => onApply?.(stage)}
      >
        Apply Recommendation
      </button>
      {onApply && stage === draftStage && (
        <small className="provenance">
          Matches the editable stage. Nothing has been saved by AI.
        </small>
      )}
    </section>
  );
}
