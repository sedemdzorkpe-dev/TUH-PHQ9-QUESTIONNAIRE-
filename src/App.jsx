import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import * as XLSX from "xlsx";
import {
  LogIn, LogOut, Users, ClipboardList, BarChart3, Download, Plus,
  AlertTriangle, CheckCircle2, Shield, ChevronRight, ChevronLeft,
  Trash2, RefreshCw, UserPlus, Activity, X, KeyRound, ClipboardCheck,
  Eye, EyeOff, FileWarning,
} from "lucide-react";
import { auth, db } from "./firebase";
import { signInAnonymously } from "firebase/auth";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
} from "firebase/firestore";

/* ============================== DESIGN TOKENS ============================== */
const C = {
  bg: "#EEF3F1",
  surface: "#FFFFFF",
  surfaceAlt: "#F4F7F5",
  ink: "#122420",
  inkSoft: "#4C5F5A",
  border: "#D7E0DC",
  primary: "#0B5D52",
  primaryDark: "#073F38",
  primarySoft: "#DCEAE6",
  gold: "#C0922E",
  goldSoft: "#F3E6C6",
  danger: "#9B2C2C",
  dangerSoft: "#F6DEDE",
  warn: "#B7791F",
  warnSoft: "#FBEACB",
};

const SEV = {
  Minimal: "#3F7D5C",
  Mild: "#B7A233",
  Moderate: "#C97A2B",
  "Moderately severe": "#B24A1F",
  Severe: "#9B2C2C",
};

/* ============================== FORM CONSTANTS ============================== */
const EDUCATION = ["No formal education", "Primary", "JHS/Middle school", "SHS/Secondary", "Tertiary/University", "Vocational/Technical"];
const EMPLOYMENT = ["Employed (formal)", "Employed (informal/self)", "Unemployed", "Student", "Retired", "Unable to work"];
const MARITAL = ["Single", "Married/Cohabiting", "Separated", "Divorced", "Widowed"];
const INCOME = ["Less than GHS 500", "GHS 500\u2013999", "GHS 1,000\u20132,499", "GHS 2,500\u20134,999", "GHS 5,000 and above", "Unknown / Prefer not to say"];
const ETHNICITY = ["Akan", "Ga-Dangme", "Ewe", "Northern", "Other"];
const RELIGION = ["Christianity", "Islam", "Traditional", "None", "Other"];
const CHRONIC = ["Hypertension", "Diabetes", "Asthma/COPD", "HIV/AIDS", "Heart disease", "Kidney disease", "Cancer", "Stroke", "Other"];
const DURATION = ["Less than 1 year", "1\u20135 years", "More than 5 years", "Not applicable"];
const NUM_MEDS = ["1", "2\u20133", "4 or more"];
const SUBSTANCES = ["Alcohol (regularly)", "Tobacco/Cigarettes", "Cannabis", "Other substances", "None"];
const SOCIAL_SUPPORT = ["Very good", "Good", "Fair", "Poor", "Very poor"];
const FUNCTIONAL_IMPAIRMENT = ["Not difficult at all", "Somewhat difficult", "Very difficult", "Extremely difficult"];

const PHQ_ITEMS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself \u2014 or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading, watching TV, or completing daily tasks",
  "Moving or speaking so slowly that other people could have noticed \u2014 or being so fidgety or restless that you are moving around much more than usual",
  "Thoughts that you would be better off dead, or thoughts of hurting yourself in some way",
];
const PHQ_SCALE = [
  { v: 0, label: "Not at all" },
  { v: 1, label: "Several days" },
  { v: 2, label: "More than half the days" },
  { v: 3, label: "Nearly every day" },
];

function phqSeverity(total) {
  if (total <= 4) return "Minimal";
  if (total <= 9) return "Mild";
  if (total <= 14) return "Moderate";
  if (total <= 19) return "Moderately severe";
  return "Severe";
}

/* ============================== HELPERS ============================== */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
};
const fmtDateTime = (iso) => {
  try { return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
};

// Passwords are never stored in plain text — only a SHA-256 hash is written to Firestore.
async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function genTempPassword() {
  return Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4).toUpperCase();
}

/* ============================== SMALL UI ATOMS ============================== */
function Field({ label, required, children, hint }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold mb-1.5" style={{ color: C.ink }}>
        {label} {required && <span style={{ color: C.danger }}>*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs mt-1" style={{ color: C.inkSoft }}>{hint}</span>}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 rounded-md text-sm outline-none transition"
      style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.ink }}
      onFocus={(e) => (e.target.style.borderColor = C.primary)}
      onBlur={(e) => (e.target.style.borderColor = C.border)}
    />
  );
}

function SelectField({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-md text-sm outline-none"
      style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.ink }}
    >
      <option value="">{placeholder || "Select..."}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function RadioRow({ options, value, onChange, name }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            type="button"
            key={o}
            onClick={() => onChange(o)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition"
            style={{
              border: `1.5px solid ${active ? C.primary : C.border}`,
              backgroundColor: active ? C.primarySoft : C.surface,
              color: active ? C.primaryDark : C.inkSoft,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function CheckboxGroup({ options, value, onChange }) {
  const set = new Set(value || []);
  const toggle = (o) => {
    const next = new Set(set);
    if (o === "None" || o === "Not applicable") {
      next.clear();
      next.add(o);
    } else {
      next.delete("None");
      if (next.has(o)) next.delete(o); else next.add(o);
    }
    onChange(Array.from(next));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = set.has(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() => toggle(o)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition"
            style={{
              border: `1.5px solid ${active ? C.gold : C.border}`,
              backgroundColor: active ? C.goldSoft : C.surface,
              color: active ? "#6B4E12" : C.inkSoft,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {["Yes", "No"].map((o) => {
        const active = value === o;
        return (
          <button
            type="button"
            key={o}
            onClick={() => onChange(o)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition"
            style={{
              border: `1.5px solid ${active ? C.primary : C.border}`,
              backgroundColor: active ? C.primarySoft : C.surface,
              color: active ? C.primaryDark : C.inkSoft,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Badge({ children, color, bg }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color, backgroundColor: bg }}>
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent ? accent + "22" : C.primarySoft }}>
          <Icon size={16} color={accent || C.primary} />
        </div>
      </div>
      <span className="text-3xl font-serif" style={{ color: C.ink }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: C.inkSoft }}>{sub}</span>}
    </div>
  );
}

function KenteStripe() {
  const colors = [C.primary, C.gold, C.danger, C.primaryDark, C.gold];
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full">
      {colors.map((c, i) => (
        <div key={i} style={{ backgroundColor: c, flex: 1 }} />
      ))}
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div
      className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium"
      style={{ backgroundColor: isErr ? C.danger : C.primaryDark, color: "#fff" }}
    >
      {isErr ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      {toast.msg}
    </div>
  );
}

/* ============================== EXPORT TO EXCEL ============================== */
function exportToExcel(submissions, users, filenamePrefix = "TUH_QI_Data") {
  const nameOf = (username) => users.find((u) => u.username === username)?.name || username;
  const rows = submissions.map((s) => ({
    "Participant ID": s.participantId,
    "Date": s.visitDate,
    "OPD Clinic No.": s.opdNo,
    "Research Assistant": nameOf(s.raUsername),
    "Age": s.age,
    "Date of Birth": s.dob,
    "Sex": s.sex,
    "Education": s.education,
    "Employment Status": s.employment,
    "Marital Status": s.marital,
    "Monthly Income": s.income,
    "Ethnicity": s.ethnicity,
    "Religion": s.religion,
    "Chief Complaint": s.chiefComplaint,
    "Chronic Conditions": (s.chronicConditions || []).join("; "),
    "Condition Duration": s.conditionDuration,
    "On Medications": s.onMeds,
    "No. of Medications": s.numMeds,
    "Told Has Mental Health Condition": s.toldMentalHealth,
    "Seen Mental Health Professional": s.seenProfessional,
    "Substance Use": (s.substanceUse || []).join("; "),
    "Stressful Life Events (12mo)": s.stressfulEvents,
    "Stressful Events Description": s.stressfulEventsDesc,
    "Social Support Rating": s.socialSupport,
    "PHQ1 Anhedonia": s.phq?.[0],
    "PHQ2 Depressed Mood": s.phq?.[1],
    "PHQ3 Sleep": s.phq?.[2],
    "PHQ4 Fatigue": s.phq?.[3],
    "PHQ5 Appetite": s.phq?.[4],
    "PHQ6 Worthlessness/Guilt": s.phq?.[5],
    "PHQ7 Concentration": s.phq?.[6],
    "PHQ8 Psychomotor": s.phq?.[7],
    "PHQ9 Suicidal Ideation": s.phq?.[8],
    "PHQ-9 Total Score": s.phqTotal,
    "PHQ-9 Severity": s.phqSeverity,
    "Functional Impairment (Q10)": s.functionalImpairment,
    "Safety Flag (Q9 >=1)": s.safetyFlag ? "YES" : "No",
    "Referral Made": s.referralMade,
    "Action Taken / Notes": s.actionTaken,
    "Reviewed by Supervisor": s.reviewed ? "Yes" : "No",
    "Submitted At": s.submittedAt,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Submissions");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}_${todayISO()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================== LOGIN ============================== */
function LoginScreen({ users, onLogin, error, loggingIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const onlyDefaultAdmin = users.length === 1 && users[0].username === "admin";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: C.bg }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: C.primary }}>
            <Shield color="#fff" size={26} />
          </div>
          <h1 className="text-2xl font-serif" style={{ color: C.ink }}>Tema Urban Hospital</h1>
          <p className="text-sm mt-1" style={{ color: C.inkSoft }}>Quality Improvement &amp; IPC Research Portal</p>
        </div>
        <div className="mb-5"><KenteStripe /></div>
        <form
          className="rounded-xl p-6"
          style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
          onSubmit={(e) => { e.preventDefault(); onLogin(username, password); }}
        >
          <Field label="Username" required>
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. admin" autoFocus />
          </Field>
          <Field label="Password" required>
            <div className="relative">
              <TextInput type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: C.inkSoft }}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          {error && (
            <div className="mb-4 text-sm px-3 py-2 rounded-md flex items-center gap-2" style={{ backgroundColor: C.dangerSoft, color: C.danger }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-2.5 rounded-md font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
            style={{ backgroundColor: C.primary, color: "#fff" }}
          >
            <LogIn size={16} /> {loggingIn ? "Signing in\u2026" : "Sign in"}
          </button>
        </form>
        {onlyDefaultAdmin && (
          <div className="mt-4 text-xs text-center px-3 py-2 rounded-md" style={{ backgroundColor: C.goldSoft, color: "#6B4E12" }}>
            First time here? Sign in with <b>admin</b> / <b>admin123</b>, then create accounts for your Director and Research Assistants from the Manage Users page — and change this password.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== SHELL / LAYOUT ============================== */
function Shell({ session, page, setPage, onLogout, children, flagCount }) {
  const navByRole = {
    admin: [
      { key: "analytics", label: "Analytics", icon: BarChart3 },
      { key: "records", label: "All Records", icon: ClipboardList },
      { key: "users", label: "Manage Users", icon: Users },
    ],
    director: [
      { key: "analytics", label: "Analytics", icon: BarChart3 },
      { key: "records", label: "All Records", icon: ClipboardList },
    ],
    ra: [
      { key: "ra-dashboard", label: "My Dashboard", icon: Activity },
      { key: "form", label: "New Questionnaire", icon: Plus },
      { key: "records", label: "My Records", icon: ClipboardList },
    ],
  };
  const nav = navByRole[session.role] || [];
  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg }}>
      <div style={{ backgroundColor: C.primaryDark }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              <Shield color="#fff" size={17} />
            </div>
            <div>
              <div className="text-white text-sm font-serif leading-tight">Tema Urban Hospital</div>
              <div className="text-xs leading-tight" style={{ color: "#BFE0D8" }}>QI &amp; IPC Research Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-white text-sm font-medium">{session.name}</div>
              <div className="text-xs capitalize" style={{ color: "#BFE0D8" }}>{session.role === "ra" ? "Research Assistant" : session.role}</div>
            </div>
            <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium" style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
        <KenteStripe />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-6 pt-5 pb-16">
        <nav className="w-52 shrink-0 hidden md:flex flex-col gap-1">
          {nav.map((n) => {
            const active = page === n.key;
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                onClick={() => setPage(n.key)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition relative"
                style={{ backgroundColor: active ? C.surface : "transparent", color: active ? C.primaryDark : C.inkSoft, border: active ? `1px solid ${C.border}` : "1px solid transparent" }}
              >
                <Icon size={16} />
                {n.label}
                {n.key === "analytics" && flagCount > 0 && (
                  <span className="ml-auto text-xs font-bold px-1.5 rounded-full" style={{ backgroundColor: C.danger, color: "#fff" }}>{flagCount}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex md:hidden gap-1 mb-2 overflow-x-auto w-full">
          {nav.map((n) => (
            <button key={n.key} onClick={() => setPage(n.key)} className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{ backgroundColor: page === n.key ? C.primary : C.surface, color: page === n.key ? "#fff" : C.inkSoft, border: `1px solid ${C.border}` }}>
              {n.label}
            </button>
          ))}
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

/* ============================== ANALYTICS DASHBOARD ============================== */
function AnalyticsDashboard({ submissions, users }) {
  const total = submissions.length;
  const todayCount = submissions.filter((s) => s.visitDate === todayISO()).length;
  const weekAgo = new Date(Date.now() - 6 * 86400000);
  const weekCount = submissions.filter((s) => new Date(s.submittedAt) >= weekAgo).length;
  const flagged = submissions.filter((s) => s.safetyFlag);
  const flaggedUnreviewed = flagged.filter((s) => !s.reviewed);

  const sevData = useMemo(() => {
    const order = ["Minimal", "Mild", "Moderate", "Moderately severe", "Severe"];
    const counts = Object.fromEntries(order.map((k) => [k, 0]));
    submissions.forEach((s) => { if (s.phqSeverity) counts[s.phqSeverity] = (counts[s.phqSeverity] || 0) + 1; });
    return order.map((k) => ({ name: k, value: counts[k] }));
  }, [submissions]);

  const sexData = useMemo(() => {
    const counts = {};
    submissions.forEach((s) => { const k = s.sex || "Unspecified"; counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [submissions]);

  const ageData = useMemo(() => {
    const buckets = { "18\u201329": 0, "30\u201344": 0, "45\u201359": 0, "60+": 0, "Under 18": 0 };
    submissions.forEach((s) => {
      const a = Number(s.age);
      if (!a) return;
      if (a < 18) buckets["Under 18"]++;
      else if (a < 30) buckets["18\u201329"]++;
      else if (a < 45) buckets["30\u201344"]++;
      else if (a < 60) buckets["45\u201359"]++;
      else buckets["60+"]++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [submissions]);

  const chronicData = useMemo(() => {
    const counts = {};
    submissions.forEach((s) => (s.chronicConditions || []).forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [submissions]);

  const raData = useMemo(() => {
    const counts = {};
    submissions.forEach((s) => { counts[s.raUsername] = (counts[s.raUsername] || 0) + 1; });
    return Object.entries(counts).map(([username, value]) => ({
      name: users.find((u) => u.username === username)?.name || username,
      value,
    })).sort((a, b) => b.value - a.value);
  }, [submissions, users]);

  const trendData = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: iso.slice(5), full: iso, count: 0 });
    }
    submissions.forEach((s) => {
      const day = days.find((d) => d.full === s.visitDate);
      if (day) day.count++;
    });
    return days;
  }, [submissions]);

  const SEV_COLORS = [SEV.Minimal, SEV.Mild, SEV.Moderate, SEV["Moderately severe"], SEV.Severe];
  const SEX_COLORS = [C.primary, C.gold, C.inkSoft, "#7C9A93"];

  if (total === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No data collected yet"
        body="Once research assistants begin submitting questionnaires, prevalence, severity and safety-flag analytics will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif" style={{ color: C.ink }}>Analytics Dashboard</h2>
        <p className="text-sm mt-0.5" style={{ color: C.inkSoft }}>Live overview of all data collected across the study.</p>
      </div>

      {flaggedUnreviewed.length > 0 && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: C.dangerSoft, border: `1px solid ${C.danger}55` }}>
          <FileWarning size={20} color={C.danger} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-sm" style={{ color: C.danger }}>{flaggedUnreviewed.length} unreviewed suicide-risk safety flag{flaggedUnreviewed.length > 1 ? "s" : ""} (PHQ-9 item 9 ≥ 1)</div>
            <div className="text-sm mt-0.5" style={{ color: "#5A1E1E" }}>Review these records in All Records and confirm the on-site safety protocol was followed for each participant.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={ClipboardList} label="Total Participants" value={total} />
        <StatCard icon={Activity} label="Today" value={todayCount} />
        <StatCard icon={RefreshCw} label="Last 7 Days" value={weekCount} />
        <StatCard icon={AlertTriangle} label="Safety Flags" value={flagged.length} accent={C.danger} sub={`${flaggedUnreviewed.length} unreviewed`} />
        <StatCard icon={Users} label="Active RAs" value={new Set(submissions.map((s) => s.raUsername)).size} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="PHQ-9 Severity Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {sevData.map((entry, i) => <Cell key={i} fill={SEV_COLORS[i]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Submissions \u2014 Last 14 Days">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.inkSoft }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.inkSoft }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={C.primary} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Age Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ageData}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.inkSoft }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.inkSoft }} />
              <Tooltip />
              <Bar dataKey="value" fill={C.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sex Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={sexData} dataKey="value" nameKey="name" outerRadius={85}>
                {sexData.map((entry, i) => <Cell key={i} fill={SEX_COLORS[i % SEX_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Chronic Conditions Reported">
          <ResponsiveContainer width="100%" height={Math.max(220, chronicData.length * 34)}>
            <BarChart data={chronicData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: C.inkSoft }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: C.inkSoft }} />
              <Tooltip />
              <Bar dataKey="value" fill={C.gold} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Data Collected per Research Assistant">
          <ResponsiveContainer width="100%" height={Math.max(220, raData.length * 34)}>
            <BarChart data={raData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: C.inkSoft }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: C.inkSoft }} />
              <Tooltip />
              <Bar dataKey="value" fill={C.primaryDark} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: C.ink }}>{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="rounded-xl p-10 text-center flex flex-col items-center gap-3" style={{ backgroundColor: C.surface, border: `1px dashed ${C.border}` }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: C.primarySoft }}>
        <Icon size={22} color={C.primary} />
      </div>
      <h3 className="font-serif text-lg" style={{ color: C.ink }}>{title}</h3>
      <p className="text-sm max-w-sm" style={{ color: C.inkSoft }}>{body}</p>
      {action}
    </div>
  );
}

/* ============================== RECORDS TABLE ============================== */
function RecordsTable({ submissions, users, session, scope, onReview }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    let base = scope === "own" ? submissions.filter((s) => s.raUsername === session.username) : submissions;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      base = base.filter((s) => (s.participantId || "").toLowerCase().includes(t) || (s.opdNo || "").toLowerCase().includes(t));
    }
    return [...base].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }, [submissions, scope, session, q]);

  const nameOf = (username) => users.find((u) => u.username === username)?.name || username;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif" style={{ color: C.ink }}>{scope === "own" ? "My Records" : "All Records"}</h2>
          <p className="text-sm mt-0.5" style={{ color: C.inkSoft }}>{list.length} record{list.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <TextInput placeholder="Search by Participant ID / OPD No." value={q} onChange={(e) => setQ(e.target.value)} />
          <button
            onClick={() => exportToExcel(list, users, scope === "own" ? "TUH_My_Data" : "TUH_QI_Data")}
            disabled={list.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold shrink-0 disabled:opacity-40"
            style={{ backgroundColor: C.gold, color: "#fff" }}
          >
            <Download size={15} /> Export to Excel
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No records found" body="Records will appear here once questionnaires are submitted." />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: C.surfaceAlt }}>
                  {["Participant ID", "Date", "RA", "Age/Sex", "PHQ-9", "Severity", "Flag", "Reviewed"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: C.inkSoft }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: C.ink }}>{s.participantId}</td>
                    <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{fmtDate(s.visitDate)}</td>
                    <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{nameOf(s.raUsername)}</td>
                    <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{s.age} / {s.sex}</td>
                    <td className="px-4 py-2.5" style={{ color: C.ink }}>{s.phqTotal}/27</td>
                    <td className="px-4 py-2.5">
                      <Badge color="#fff" bg={SEV[s.phqSeverity] || C.inkSoft}>{s.phqSeverity}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.safetyFlag ? <Badge color={C.danger} bg={C.dangerSoft}>Flagged</Badge> : <span style={{ color: C.inkSoft }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.safetyFlag ? (
                        onReview ? (
                          <button
                            onClick={() => onReview(s.id, !s.reviewed)}
                            className="text-xs font-semibold px-2 py-1 rounded-full"
                            style={{ backgroundColor: s.reviewed ? C.primarySoft : C.warnSoft, color: s.reviewed ? C.primaryDark : C.warn }}
                          >
                            {s.reviewed ? "Reviewed" : "Mark reviewed"}
                          </button>
                        ) : (
                          <span style={{ color: s.reviewed ? C.primary : C.warn }}>{s.reviewed ? "Yes" : "Pending"}</span>
                        )
                      ) : (
                        <span style={{ color: C.inkSoft }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== MANAGE USERS (ADMIN) ============================== */
function ManageUsers({ users, onCreate, onToggleActive, onResetPassword, onDelete, currentUsername, submissionCount, onClearSubmissions }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("ra");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  const genPassword = () => {
    const p = Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4).toUpperCase();
    setPassword(p);
  };

  const submit = (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim() || !username.trim() || !password.trim()) { setErr("All fields are required."); return; }
    if (users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())) { setErr("That username is already taken."); return; }
    onCreate({ name: name.trim(), username: username.trim(), password: password.trim(), role, active: true, createdAt: new Date().toISOString() });
    setName(""); setUsername(""); setPassword(""); setRole("ra");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif" style={{ color: C.ink }}>Manage Users</h2>
        <p className="text-sm mt-0.5" style={{ color: C.inkSoft }}>Create login credentials for research assistants, the Director, and other administrators.</p>
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: C.ink }}><UserPlus size={16} /> Create new account</h3>
        <form onSubmit={submit} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Field label="Full name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Boateng" /></Field>
          <Field label="Username" required><TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ama.boateng" /></Field>
          <Field label="Role" required>
            <SelectField value={role} onChange={setRole} options={["ra", "director", "admin"]} placeholder="Select role" />
          </Field>
          <Field label="Temporary password" required>
            <div className="flex gap-1.5">
              <TextInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" />
              <button type="button" onClick={genPassword} className="px-2.5 rounded-md shrink-0" style={{ border: `1px solid ${C.border}`, color: C.inkSoft }} title="Generate">
                <KeyRound size={15} />
              </button>
            </div>
          </Field>
          <button type="submit" className="h-[38px] px-4 rounded-md text-sm font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: C.primary, color: "#fff" }}>
            <Plus size={15} /> Create
          </button>
        </form>
        {err && <div className="mt-3 text-sm px-3 py-2 rounded-md" style={{ backgroundColor: C.dangerSoft, color: C.danger }}>{err}</div>}
        <div className="mt-3 text-xs" style={{ color: C.inkSoft }}>Role guide — <b>ra</b>: submits questionnaires, sees own progress. <b>director</b>: read-only access to all analytics and records. <b>admin</b>: full access plus user management.</div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: C.surfaceAlt }}>
              {["Name", "Username", "Role", "Status", "Created", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold" style={{ color: C.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: C.ink }}>{u.name}</td>
                <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{u.username}</td>
                <td className="px-4 py-2.5 capitalize" style={{ color: C.inkSoft }}>{u.role === "ra" ? "Research Assistant" : u.role}</td>
                <td className="px-4 py-2.5">
                  <Badge color={u.active !== false ? C.primaryDark : C.danger} bg={u.active !== false ? C.primarySoft : C.dangerSoft}>{u.active !== false ? "Active" : "Disabled"}</Badge>
                </td>
                <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-3 items-center">
                    <button onClick={() => onToggleActive(u.id)} className="text-xs font-semibold" style={{ color: C.primary }}>
                      {u.active !== false ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => onResetPassword(u.id)} className="text-xs font-semibold" style={{ color: C.gold }}>Reset password</button>
                    {u.username !== currentUsername && u.username !== "admin" && (
                      <button onClick={() => onDelete(u.id)} className="text-xs font-semibold flex items-center gap-1" style={{ color: C.danger }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onClearSubmissions && (
        <div className="rounded-xl p-5" style={{ backgroundColor: C.dangerSoft, border: `1px solid ${C.danger}55` }}>
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: C.danger }}><AlertTriangle size={16} /> Danger zone</h3>
          <p className="text-sm mb-3" style={{ color: "#5A1E1E" }}>
            Permanently delete all {submissionCount} questionnaire submission{submissionCount === 1 ? "" : "s"} currently in the database \u2014 for example, to clear out demo/test entries before real data collection begins. Participant ID numbering will restart from 001 afterwards. This does not delete any user accounts. This cannot be undone.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label='Type "DELETE" to confirm'>
              <TextInput value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
            </Field>
            <button
              disabled={confirmText !== "DELETE" || clearing || submissionCount === 0}
              onClick={async () => {
                setClearing(true);
                await onClearSubmissions();
                setClearing(false);
                setConfirmText("");
              }}
              className="h-[38px] px-4 rounded-md text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ backgroundColor: C.danger, color: "#fff" }}
            >
              <Trash2 size={15} /> {clearing ? "Deleting\u2026" : `Delete all ${submissionCount} submissions`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== RA DASHBOARD ============================== */
function RADashboard({ submissions, session, setPage }) {
  const mine = submissions.filter((s) => s.raUsername === session.username);
  const today = mine.filter((s) => s.visitDate === todayISO()).length;
  const weekAgo = new Date(Date.now() - 6 * 86400000);
  const week = mine.filter((s) => new Date(s.submittedAt) >= weekAgo).length;
  const flagged = mine.filter((s) => s.safetyFlag).length;
  const recent = [...mine].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 6);

  const trendData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: iso.slice(5), full: iso, count: 0 });
    }
    mine.forEach((s) => { const day = days.find((d) => d.full === s.visitDate); if (day) day.count++; });
    return days;
  }, [mine]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif" style={{ color: C.ink }}>Welcome, {session.name.split(" ")[0]}</h2>
          <p className="text-sm mt-0.5" style={{ color: C.inkSoft }}>Here's your data-collection progress.</p>
        </div>
        <button onClick={() => setPage("form")} className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold" style={{ backgroundColor: C.primary, color: "#fff" }}>
          <Plus size={16} /> New Questionnaire
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={ClipboardCheck} label="Total Collected" value={mine.length} />
        <StatCard icon={Activity} label="Today" value={today} />
        <StatCard icon={RefreshCw} label="This Week" value={week} />
        <StatCard icon={AlertTriangle} label="Safety Flags" value={flagged} accent={C.danger} />
      </div>

      <ChartCard title="Your submissions \u2014 last 7 days">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trendData}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.inkSoft }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.inkSoft }} />
            <Tooltip />
            <Bar dataKey="count" fill={C.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div>
        <h3 className="text-sm font-semibold mb-2" style={{ color: C.ink }}>Recent entries</h3>
        {recent.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No entries yet" body="Your submitted questionnaires will show up here." />
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <table className="w-full text-sm">
              <thead><tr style={{ backgroundColor: C.surfaceAlt }}>
                {["Participant ID", "Date", "PHQ-9", "Severity"].map((h) => <th key={h} className="text-left px-4 py-2.5 font-semibold" style={{ color: C.inkSoft }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: C.ink }}>{s.participantId}</td>
                    <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{fmtDate(s.visitDate)}</td>
                    <td className="px-4 py-2.5" style={{ color: C.ink }}>{s.phqTotal}/27</td>
                    <td className="px-4 py-2.5"><Badge color="#fff" bg={SEV[s.phqSeverity] || C.inkSoft}>{s.phqSeverity}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== QUESTIONNAIRE WIZARD ============================== */
const BLANK_FORM = {
  participantId: "", visitDate: todayISO(), opdNo: "",
  age: "", dob: "", sex: "", education: "", employment: "", marital: "", income: "", ethnicity: "", ethnicityOther: "", religion: "", religionOther: "",
  chiefComplaint: "", hasChronic: "", chronicConditions: [], chronicOther: "", conditionDuration: "",
  onMeds: "", numMeds: "", toldMentalHealth: "", seenProfessional: "",
  substanceUse: [], stressfulEvents: "", stressfulEventsDesc: "", socialSupport: "",
  phq: Array(9).fill(null), functionalImpairment: "",
  referralMade: "", actionTaken: "",
};

function QuestionnaireWizard({ session, submissions, onSubmit, onCancel }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => {
    const n = submissions.filter((s) => s.raUsername === session.username).length + 1;
    return { ...BLANK_FORM, participantId: `TUH-${String(n).padStart(4, "0")}` };
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setPhq = (i, v) => setF((p) => { const phq = [...p.phq]; phq[i] = v; return { ...p, phq }; });

  const phqTotal = f.phq.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
  const phqAnswered = f.phq.every((v) => typeof v === "number");
  const safetyFlag = typeof f.phq[8] === "number" && f.phq[8] >= 1;
  const severity = phqAnswered ? phqSeverity(phqTotal) : null;

  const steps = ["Visit Info", "Demographics", "Clinical History", "PHQ-9 Screening", "Review & Submit"];

  const canNext = () => {
    if (step === 0) return f.participantId.trim() && f.visitDate;
    if (step === 1) return f.age && f.sex;
    if (step === 3) return phqAnswered && f.functionalImpairment;
    return true;
  };

  const submit = () => {
    const record = {
      ...f,
      raUsername: session.username,
      phqTotal,
      phqSeverity: severity,
      safetyFlag,
      reviewed: false,
      submittedAt: new Date().toISOString(),
    };
    onSubmit(record);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif" style={{ color: C.ink }}>New Questionnaire</h2>
        <button onClick={onCancel} className="text-sm font-medium flex items-center gap-1" style={{ color: C.inkSoft }}><X size={15} /> Cancel</button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: i <= step ? C.primary : C.border, color: i <= step ? "#fff" : C.inkSoft }}>{i + 1}</div>
              <span className="text-xs font-medium hidden sm:inline" style={{ color: i === step ? C.ink : C.inkSoft }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div className="w-4 sm:w-8 h-px" style={{ backgroundColor: C.border }} />}
          </React.Fragment>
        ))}
      </div>

      <div className="rounded-xl p-6" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
        {step === 0 && (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Participant ID" required><TextInput value={f.participantId} onChange={(e) => set("participantId", e.target.value)} /></Field>
            <Field label="Date of visit" required><TextInput type="date" value={f.visitDate} onChange={(e) => set("visitDate", e.target.value)} /></Field>
            <Field label="OPD Clinic No."><TextInput value={f.opdNo} onChange={(e) => set("opdNo", e.target.value)} /></Field>
            <Field label="Administrator (Research Assistant)"><TextInput value={session.name} disabled style={{ opacity: 0.7 }} /></Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Age (completed years)" required><TextInput type="number" min="0" value={f.age} onChange={(e) => set("age", e.target.value)} /></Field>
            <Field label="Date of birth (if known)"><TextInput type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
            <Field label="Sex" required><RadioRow options={["Male", "Female", "Other / Prefer not to say"]} value={f.sex} onChange={(v) => set("sex", v)} /></Field>
            <Field label="Highest level of education"><SelectField value={f.education} onChange={(v) => set("education", v)} options={EDUCATION} /></Field>
            <Field label="Employment status"><SelectField value={f.employment} onChange={(v) => set("employment", v)} options={EMPLOYMENT} /></Field>
            <Field label="Marital status"><SelectField value={f.marital} onChange={(v) => set("marital", v)} options={MARITAL} /></Field>
            <Field label="Monthly household income (approx.)"><SelectField value={f.income} onChange={(v) => set("income", v)} options={INCOME} /></Field>
            <Field label="Ethnicity / Tribe">
              <SelectField value={f.ethnicity} onChange={(v) => set("ethnicity", v)} options={ETHNICITY} />
              {f.ethnicity === "Other" && <div className="mt-2"><TextInput placeholder="Specify" value={f.ethnicityOther} onChange={(e) => set("ethnicityOther", e.target.value)} /></div>}
            </Field>
            <Field label="Religion">
              <SelectField value={f.religion} onChange={(v) => set("religion", v)} options={RELIGION} />
              {f.religion === "Other" && <div className="mt-2"><TextInput placeholder="Specify" value={f.religionOther} onChange={(e) => set("religionOther", e.target.value)} /></div>}
            </Field>
          </div>
        )}

        {step === 2 && (
          <div>
            <Field label="Reason for today's OPD visit (chief complaint)"><TextInput value={f.chiefComplaint} onChange={(e) => set("chiefComplaint", e.target.value)} /></Field>
            <Field label="Any chronic (long-term) medical condition(s)?"><YesNo value={f.hasChronic} onChange={(v) => set("hasChronic", v)} /></Field>
            {f.hasChronic === "Yes" && (
              <Field label="Tick all that apply">
                <CheckboxGroup options={CHRONIC} value={f.chronicConditions} onChange={(v) => set("chronicConditions", v)} />
                {f.chronicConditions.includes("Other") && <div className="mt-2"><TextInput placeholder="Specify" value={f.chronicOther} onChange={(e) => set("chronicOther", e.target.value)} /></div>}
              </Field>
            )}
            <Field label="How long have you had this/these condition(s)?"><SelectField value={f.conditionDuration} onChange={(v) => set("conditionDuration", v)} options={DURATION} /></Field>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Currently taking regular medications?"><YesNo value={f.onMeds} onChange={(v) => set("onMeds", v)} /></Field>
              {f.onMeds === "Yes" && <Field label="How many medications?"><SelectField value={f.numMeds} onChange={(v) => set("numMeds", v)} options={NUM_MEDS} /></Field>}
            </div>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Ever told by a health worker you have a mental health condition?"><RadioRow options={["Yes", "No", "Unsure"]} value={f.toldMentalHealth} onChange={(v) => set("toldMentalHealth", v)} /></Field>
              <Field label="Ever seen a mental health professional?"><YesNo value={f.seenProfessional} onChange={(v) => set("seenProfessional", v)} /></Field>
            </div>
            <Field label="Substance use (tick all that apply)"><CheckboxGroup options={SUBSTANCES} value={f.substanceUse} onChange={(v) => set("substanceUse", v)} /></Field>
            <Field label="Any major stressful life events in the past 12 months?"><YesNo value={f.stressfulEvents} onChange={(v) => set("stressfulEvents", v)} /></Field>
            {f.stressfulEvents === "Yes" && <Field label="Describe briefly"><TextInput value={f.stressfulEventsDesc} onChange={(e) => set("stressfulEventsDesc", e.target.value)} /></Field>}
            <Field label="Overall social support rating"><SelectField value={f.socialSupport} onChange={(v) => set("socialSupport", v)} options={SOCIAL_SUPPORT} /></Field>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-sm mb-4" style={{ color: C.inkSoft }}>Over the past 2 weeks, how often has the participant been bothered by the following problems?</p>
            {safetyFlag && (
              <div className="mb-5 rounded-lg p-4 flex items-start gap-3" style={{ backgroundColor: C.dangerSoft, border: `1.5px solid ${C.danger}` }}>
                <AlertTriangle size={20} color={C.danger} className="mt-0.5 shrink-0" />
                <div className="text-sm" style={{ color: "#5A1E1E" }}>
                  <b>Critical safety alert.</b> Item 9 indicates thoughts of self-harm. Do NOT leave the participant alone. Notify the duty doctor or Mental Health Officer immediately, and document the action taken below before finishing the interview.
                </div>
              </div>
            )}
            <div className="space-y-4">
              {PHQ_ITEMS.map((item, i) => (
                <div key={i} className="pb-4" style={{ borderBottom: i < 8 ? `1px solid ${C.border}` : "none" }}>
                  <div className="text-sm font-medium mb-2" style={{ color: C.ink }}>
                    {i + 1}. {item} {i === 8 && <Shield size={13} color={C.danger} className="inline ml-1" />}
                  </div>
                  <RadioRow options={PHQ_SCALE.map((s) => s.label)} value={PHQ_SCALE.find((s) => s.v === f.phq[i])?.label} onChange={(label) => setPhq(i, PHQ_SCALE.find((s) => s.label === label).v)} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: C.surfaceAlt }}>
              <span className="text-sm font-semibold" style={{ color: C.ink }}>Running total</span>
              <span className="text-lg font-serif" style={{ color: C.ink }}>{phqTotal} / 27 {severity && <Badge color="#fff" bg={SEV[severity]}>{severity}</Badge>}</span>
            </div>
            <Field label="Q10. If any problems were checked, how difficult have they made it to work, manage things at home, or get along with others?" required>
              <RadioRow options={FUNCTIONAL_IMPAIRMENT} value={f.functionalImpairment} onChange={(v) => set("functionalImpairment", v)} />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="rounded-lg p-4" style={{ backgroundColor: C.surfaceAlt }}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkSoft }}>Summary</div>
              <div className="grid sm:grid-cols-2 gap-y-1.5 text-sm" style={{ color: C.ink }}>
                <div><b>Participant:</b> {f.participantId}</div>
                <div><b>Date:</b> {fmtDate(f.visitDate)}</div>
                <div><b>Age / Sex:</b> {f.age} / {f.sex}</div>
                <div><b>PHQ-9 Total:</b> {phqTotal} / 27</div>
                <div><b>Severity:</b> <Badge color="#fff" bg={SEV[severity] || C.inkSoft}>{severity}</Badge></div>
                <div><b>Safety flag:</b> {safetyFlag ? <span style={{ color: C.danger, fontWeight: 700 }}>YES</span> : "No"}</div>
              </div>
            </div>
            {safetyFlag && (
              <div className="rounded-lg p-4" style={{ backgroundColor: C.dangerSoft, border: `1px solid ${C.danger}55` }}>
                <div className="text-sm font-semibold mb-1" style={{ color: C.danger }}>Confirm safety protocol before submitting</div>
                <div className="text-sm" style={{ color: "#5A1E1E" }}>Ensure the duty doctor / Mental Health Officer has been notified and the participant is not left alone.</div>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Referral made?"><YesNo value={f.referralMade} onChange={(v) => set("referralMade", v)} /></Field>
            </div>
            <Field label="Action taken / notes (administrator record)"><TextInput value={f.actionTaken} onChange={(e) => set("actionTaken", e.target.value)} placeholder="Optional notes for the record" /></Field>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-30"
          style={{ border: `1px solid ${C.border}`, color: C.inkSoft }}
        >
          <ChevronLeft size={15} /> Back
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => canNext() && setStep((s) => s + 1)}
            disabled={!canNext()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: C.primary, color: "#fff" }}
          >
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button onClick={submit} className="flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-semibold" style={{ backgroundColor: C.primary, color: "#fff" }}>
            <CheckCircle2 size={15} /> Submit questionnaire
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================== LOADING ============================== */
function LoadingScreen({ stuck, onForce }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
      <div className="flex flex-col items-center gap-3 text-center px-4">
        <div className="w-10 h-10 rounded-full animate-spin" style={{ border: `3px solid ${C.border}`, borderTopColor: C.primary }} />
        <span className="text-sm" style={{ color: C.inkSoft }}>Loading portal…</span>
        {stuck && (
          <div className="mt-3 max-w-xs">
            <p className="text-xs mb-2" style={{ color: C.inkSoft }}>This is taking longer than expected. You can continue with a temporary in-session login instead of waiting.</p>
            <button onClick={onForce} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ backgroundColor: C.primary, color: "#fff" }}>
              Continue anyway
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== ROOT APP ============================== */
const DEFAULT_ADMIN = [{ id: "default-admin", username: "admin", password: "admin123", name: "System Administrator", role: "admin", active: true, createdAt: new Date().toISOString(), _offline: true }];

export default function TemaQIApp() {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("analytics");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [stuck, setStuck] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    let unsubUsers = null;
    let unsubSubs = null;
    let usersLoaded = false;
    let subsLoaded = false;
    const markReady = () => { if (usersLoaded && subsLoaded) setReady(true); };

    (async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.warn("Anonymous sign-in failed (check Firebase Auth is enabled):", e);
      }

      unsubUsers = onSnapshot(
        collection(db, "users"),
        async (snap) => {
          if (snap.empty) {
            // First run ever — seed a default admin account. Don't block the UI on this.
            try {
              const passwordHash = await hashPassword("admin123");
              await addDoc(collection(db, "users"), {
                username: "admin", passwordHash, name: "System Administrator", role: "admin", active: true, createdAt: new Date().toISOString(),
              });
            } catch (e) {
              console.warn("Could not seed default admin (using in-memory fallback):", e);
              setUsers(DEFAULT_ADMIN);
            }
          } else {
            setUsers(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
          }
          usersLoaded = true;
          markReady();
        },
        (err) => {
          console.warn("Users listener failed, falling back to offline admin:", err);
          setUsers(DEFAULT_ADMIN);
          usersLoaded = true;
          markReady();
        }
      );

      unsubSubs = onSnapshot(
        collection(db, "submissions"),
        (snap) => {
          setSubmissions(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
          subsLoaded = true;
          markReady();
        },
        (err) => {
          console.warn("Submissions listener failed:", err);
          subsLoaded = true;
          markReady();
        }
      );
    })();

    const t = setTimeout(() => setStuck(true), 6000);
    return () => { clearTimeout(t); unsubUsers && unsubUsers(); unsubSubs && unsubSubs(); };
  }, []);

  async function handleLogin(username, password) {
    setLoggingIn(true);
    try {
      const candidate = users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
      if (!candidate) { setError("Invalid username or password."); return; }
      if (candidate.active === false) { setError("This account has been disabled. Contact your administrator."); return; }
      const offlineMatch = candidate._offline && candidate.password === password;
      const hash = candidate._offline ? null : await hashPassword(password);
      if (!offlineMatch && hash !== candidate.passwordHash) { setError("Invalid username or password."); return; }
      setError("");
      setSession({ id: candidate.id, username: candidate.username, name: candidate.name, role: candidate.role });
      setPage(candidate.role === "ra" ? "ra-dashboard" : "analytics");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() { setSession(null); setPage("analytics"); }

  async function handleCreateUser(newUser) {
    try {
      const passwordHash = await hashPassword(newUser.password);
      await addDoc(collection(db, "users"), {
        username: newUser.username, passwordHash, name: newUser.name, role: newUser.role, active: true, createdAt: new Date().toISOString(),
      });
      showToast(`Account created for ${newUser.name}.`);
    } catch (e) {
      console.warn(e);
      showToast("Could not create the account \u2014 check your connection and try again.", "error");
    }
  }
  async function handleToggleActive(id) {
    const u = users.find((x) => x.id === id);
    try { await updateDoc(doc(db, "users", id), { active: u.active === false ? true : false }); }
    catch (e) { console.warn(e); showToast("Could not update that user.", "error"); }
  }
  async function handleResetPassword(id) {
    const newPass = genTempPassword();
    try {
      const passwordHash = await hashPassword(newPass);
      await updateDoc(doc(db, "users", id), { passwordHash });
      showToast(`New password for this user: ${newPass}`);
    } catch (e) { console.warn(e); showToast("Could not reset that password.", "error"); }
  }
  async function handleDeleteUser(id) {
    if (!window.confirm("Delete this user account? This cannot be undone.")) return;
    try { await deleteDoc(doc(db, "users", id)); }
    catch (e) { console.warn(e); showToast("Could not delete that user.", "error"); }
  }

  async function handleSubmitQuestionnaire(record) {
    try {
      await addDoc(collection(db, "submissions"), record);
      showToast(record.safetyFlag ? "Submitted \u2014 safety flag recorded. Ensure protocol was followed." : "Questionnaire submitted successfully.", record.safetyFlag ? "error" : "success");
      setPage("ra-dashboard");
    } catch (e) {
      console.warn(e);
      showToast("Could not submit \u2014 check your connection and try again. Your answers are still on this screen.", "error");
    }
  }
  async function handleReview(id, reviewed) {
    try { await updateDoc(doc(db, "submissions", id), { reviewed }); }
    catch (e) { console.warn(e); showToast("Could not update that record.", "error"); }
  }
  async function handleClearAllSubmissions() {
    try {
      await Promise.all(submissions.map((s) => deleteDoc(doc(db, "submissions", s.id))));
      showToast(`Deleted ${submissions.length} submission${submissions.length === 1 ? "" : "s"}. Participant IDs will restart from 001.`);
    } catch (e) {
      console.warn(e);
      showToast("Could not delete all submissions \u2014 check your connection and try again.", "error");
    }
  }

  if (!ready) {
    return (
      <LoadingScreen
        stuck={stuck}
        onForce={() => { setUsers((cur) => (cur && cur.length > 0 ? cur : DEFAULT_ADMIN)); setSubmissions((cur) => cur || []); setReady(true); }}
      />
    );
  }
  if (!session) return <LoginScreen users={users} onLogin={handleLogin} error={error} loggingIn={loggingIn} />;

  const flagCount = submissions.filter((s) => s.safetyFlag && !s.reviewed).length;

  return (
    <Shell session={session} page={page} setPage={setPage} onLogout={handleLogout} flagCount={session.role !== "ra" ? flagCount : 0}>
      {page === "analytics" && (session.role === "admin" || session.role === "director") && (
        <AnalyticsDashboard submissions={submissions} users={users} />
      )}
      {page === "records" && session.role !== "ra" && (
        <RecordsTable submissions={submissions} users={users} session={session} scope="all" onReview={session.role === "admin" ? handleReview : session.role === "director" ? handleReview : null} />
      )}
      {page === "users" && session.role === "admin" && (
        <ManageUsers users={users} onCreate={handleCreateUser} onToggleActive={handleToggleActive} onResetPassword={handleResetPassword} onDelete={handleDeleteUser} currentUsername={session.username} submissionCount={submissions.length} onClearSubmissions={handleClearAllSubmissions} />
      )}
      {page === "ra-dashboard" && session.role === "ra" && (
        <RADashboard submissions={submissions} session={session} setPage={setPage} />
      )}
      {page === "form" && session.role === "ra" && (
        <QuestionnaireWizard session={session} submissions={submissions} onSubmit={handleSubmitQuestionnaire} onCancel={() => setPage("ra-dashboard")} />
      )}
      {page === "records" && session.role === "ra" && (
        <RecordsTable submissions={submissions} users={users} session={session} scope="own" />
      )}
      <Toast toast={toast} />
    </Shell>
  );
}
