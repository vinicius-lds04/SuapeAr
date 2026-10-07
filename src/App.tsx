import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  COMPANIES as ALL_COMPANIES,
  DEFAULT_LIMITS,
  LIVE_INTERVAL_MS,
  MAX_POINTS,
  POLLUTANTS,
  createSimulator,
  levelOf,
  readingLevel,
  type Level,
  type Limits,
  type PollutantId,
  type Company,
  type Reading,
} from "./data";
import OperatorView from "./Operator";
import { Login, Onboarding, type Session } from "./Welcome";
import { Icon, LimitBar, LineChart, STATUS, StatusBadge, dayTime, fmt, hhmm, hhmmss } from "./ui";

type Page = "painel" | "alertas" | "historico" | "limites" | "feedback";
type Readings = Record<string, Reading[]>;
type Alert = {
  id: string;
  companyId: string;
  pollutant: PollutantId;
  level: Level;
  value: number;
  limit: number;
  t: number;
  active: boolean;
};
type LimitAudit = {
  id: string;
  user: string;
  t: number;
  pollutant: PollutantId;
  oldValue: { warn: number; danger: number };
  newValue: { warn: number; danger: number };
};

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "painel", label: "Painel", icon: "dashboard" },
  { id: "alertas", label: "Alertas", icon: "bell" },
  { id: "historico", label: "Histórico", icon: "history" },
  { id: "limites", label: "Limites", icon: "sliders" },
  { id: "feedback", label: "Feedback", icon: "message" },
];

const PAGE_INFO: Record<Page, { title: string; sub: string }> = {
  painel: { title: "Painel", sub: "Situação atual dos pontos de medição do complexo" },
  alertas: { title: "Alertas", sub: "Ultrapassagens dos limites de atenção e perigo" },
  historico: { title: "Histórico", sub: "Consulte, compare e exporte as leituras registradas" },
  limites: { title: "Limites", sub: "Defina quando uma leitura é considerada atenção ou perigo" },
  feedback: { title: "Feedback", sub: "Ajude a melhorar o monitoramento" },
};

const ScopeContext = createContext<Company[]>(ALL_COMPANIES);
const useScope = () => useContext(ScopeContext);

const company = (id: string) => ALL_COMPANIES.find((c) => c.id === id)!;
const pol = (id: PollutantId) => POLLUTANTS.find((p) => p.id === id)!;

function loadLimits(): Limits {
  try {
    const raw = localStorage.getItem("suapear-limits");
    if (raw) return { ...DEFAULT_LIMITS, ...JSON.parse(raw) };
  } catch {
    /* ignora */
  }
  return DEFAULT_LIMITS;
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function getPage(): Page {
  const h = window.location.hash.replace("#", "") as Page;
  return NAV.some((n) => n.id === h) ? h : "painel";
}

function buildAlerts(readings: Readings, limits: Limits): Alert[] {
  const out: Alert[] = [];
  ALL_COMPANIES.forEach((c) => {
    const arr = readings[c.id] ?? [];
    POLLUTANTS.forEach((p) => {
      let prev: Level = 0;
      let episode: Alert[] = [];
      arr.forEach((r) => {
        const lvl = levelOf(r.v[p.id], limits[p.id]);
        if (lvl === 0) episode = [];
        if (lvl > prev) {
          const alert: Alert = {
            id: `${c.id}:${p.id}:${r.t}`,
            companyId: c.id,
            pollutant: p.id,
            level: lvl,
            value: r.v[p.id],
            limit: lvl === 2 ? limits[p.id].danger : limits[p.id].warn,
            t: r.t,
            active: false,
          };
          out.push(alert);
          episode.push(alert);
        }
        prev = lvl;
      });
      if (prev > 0) episode.forEach((alert) => { alert.active = true; });
    });
  });
  return out.sort((a, b) => b.t - a.t);
}

function appendReadings(prev: Readings, next: Record<string, Reading>): Readings {
  const out: Readings = {};
  for (const c of ALL_COMPANIES) out[c.id] = [...prev[c.id], next[c.id]].slice(-MAX_POINTS);
  return out;
}

export default function App() {
  const [sim] = useState(createSimulator);
  const [readings, setReadings] = useState<Readings>(() => sim.history);
  const [lastTick, setLastTick] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [limits, setLimits] = useState<Limits>(loadLimits);
  const [acked, setAcked] = useState<Set<string>>(() => new Set());
  const [page, setPageState] = useState<Page>(getPage);
  const [session, setSession] = useState<Session | null>(() => load<Session>("suapear-session"));
  const [onboarded, setOnboarded] = useState<boolean>(() => localStorage.getItem("suapear-onboarded") === "1");
  const [toasts, setToasts] = useState<Alert[]>([]);
  const [limitAudit, setLimitAudit] = useState<LimitAudit[]>(() => load<LimitAudit[]>("suapear-limit-audit") ?? []);
  const seenAlertIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    document.title = "SuapeAr · Qualidade do ar em Suape";
    const onHash = () => setPageState(getPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const nx = sim.next();
      setReadings((prev) => appendReadings(prev, nx));
      setLastTick(Date.now());
    }, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, sim]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const go = (p: Page) => {
    window.location.hash = p;
    setPageState(p);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (session?.profile === "empresa" && page === "limites") {
      window.location.hash = "painel";
      setPageState("painel");
    }
  }, [page, session]);

  const scope = useMemo(
    () => (session && session.profile !== "gestao" ? ALL_COMPANIES.filter((c) => c.id === session.companyId) : ALL_COMPANIES),
    [session],
  );
  const allAlerts = useMemo(() => buildAlerts(readings, limits), [readings, limits]);
  const alerts = useMemo(() => allAlerts.filter((a) => scope.some((c) => c.id === a.companyId)), [allAlerts, scope]);
  const pending = alerts.filter((a) => a.active && !acked.has(a.id)).length;
  const nextIn = paused ? null : Math.max(0, Math.ceil((LIVE_INTERVAL_MS - (now - lastTick)) / 1000));

  useEffect(() => {
    const seen = seenAlertIds.current;
    if (!seen) {
      seenAlertIds.current = new Set(allAlerts.map((alert) => alert.id));
      return;
    }
    const fresh = alerts.filter(
      (alert) => !seen.has(alert.id) && alert.t >= Date.now() - LIVE_INTERVAL_MS * 2,
    );
    allAlerts.forEach((alert) => seen.add(alert.id));
    if (session && fresh.length) {
      setToasts((current) => [
        ...fresh,
        ...current.filter((toast) => !fresh.some((alert) => alert.id === toast.id)),
      ].slice(0, 4));
    }
  }, [alerts, allAlerts, session]);

  const updateLimits = (nextLimits: Limits) => {
    if (session?.profile !== "gestao") return;
    const t = Date.now();
    const entries = POLLUTANTS.filter(
      ({ id }) => limits[id].warn !== nextLimits[id].warn || limits[id].danger !== nextLimits[id].danger,
    ).map(({ id }, index): LimitAudit => ({
      id: `${t}:${id}:${index}`,
      user: "Gestão do Porto",
      t,
      pollutant: id,
      oldValue: { ...limits[id] },
      newValue: { ...nextLimits[id] },
    }));
    if (!entries.length) return;
    setLimits(nextLimits);
    localStorage.setItem("suapear-limits", JSON.stringify(nextLimits));
    setLimitAudit((current) => {
      const nextAudit = [...entries, ...current].slice(0, 100);
      localStorage.setItem("suapear-limit-audit", JSON.stringify(nextAudit));
      return nextAudit;
    });
  };

  const enter = (s: Session) => {
    localStorage.setItem("suapear-session", JSON.stringify(s));
    setSession(s);
    go("painel");
  };
  const logout = () => {
    localStorage.removeItem("suapear-session");
    setSession(null);
  };
  const finishOnboarding = () => {
    localStorage.setItem("suapear-onboarded", "1");
    setOnboarded(true);
  };
  const simulateSO2Spike = () => {
    const eligible = scope.filter((c) => {
      const arr = readings[c.id];
      const latest = arr[arr.length - 1];
      return levelOf(latest.v.so2, limits.so2) < 2;
    });
    const candidates = eligible.length ? eligible : scope;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const nx = sim.spikeSO2(target.id, limits.so2.danger * 1.25);
    setReadings((prev) => appendReadings(prev, nx));
    setLastTick(Date.now());
  };

  if (!session) return <Login onEnter={enter} />;
  if (session.profile === "operador" && scope[0]) {
    return <OperatorView companyId={scope[0].id} readings={readings[scope[0].id]} limits={limits} onLogout={logout} />;
  }

  const navItems = session.profile === "gestao" ? NAV : NAV.filter((item) => item.id !== "limites");
  const info = PAGE_INFO[page];
  const who = session.profile === "gestao" ? "Gestão do Porto" : (scope[0]?.name ?? "Empresa");

  return (
    <ScopeContext.Provider value={scope}>
    {!onboarded && <Onboarding onDone={finishOnboarding} />}
    <AlertToasts
      alerts={toasts}
      dismiss={(id) => setToasts((current) => current.filter((alert) => alert.id !== id))}
      showAll={() => go("alertas")}
    />
    <div className="min-h-dvh lg:pl-64">
      {/* Menu lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white p-5 lg:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Menu principal">
          {navItems.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              aria-current={page === n.id ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[15px] font-medium transition-colors ${
                page === n.id ? "bg-petrol-700 text-white shadow-sm" : "text-ink-2 hover:bg-petrol-50 hover:text-petrol-800"
              }`}
            >
              <Icon name={n.icon} className="size-5" />
              <span className="flex-1">{n.label}</span>
              {n.id === "alertas" && pending > 0 && (
                <span className="grid min-w-6 place-items-center rounded-full bg-danger px-1.5 text-xs font-bold text-white">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto mb-3 flex items-center gap-3 rounded-xl border border-line p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-petrol-100 text-petrol-700">
            <Icon name={session.profile === "gestao" ? "anchor" : "factory"} className="size-5" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold text-ink">{who}</div>
            <div className="text-xs text-ink-3">{session.profile === "gestao" ? "Todas as empresas" : "Perfil Empresa"}</div>
          </div>
          <button onClick={logout} aria-label="Sair" title="Sair" className="rounded-lg p-2 text-ink-3 hover:bg-petrol-50 hover:text-petrol-700">
            <Icon name="logout" className="size-5" />
          </button>
        </div>
        <div className="rounded-xl bg-petrol-50 p-4 text-xs leading-relaxed text-petrol-800">
          <p className="font-semibold">Dados simulados</p>
          <p className="mt-1 text-ink-2">Empresas e medições fictícias para demonstração. Nenhuma leitura é real.</p>
        </div>
      </aside>

      {/* Topo (celular) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo compact />
        <div className="flex items-center gap-2">
          <LivePill nextIn={nextIn} paused={paused} onToggle={() => setPaused((p) => !p)} compact />
          <button onClick={logout} aria-label="Sair" className="rounded-full border border-line p-2 text-ink-3 hover:text-petrol-700">
            <Icon name="logout" className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-9">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-petrol-500">Complexo Industrial Portuário de Suape · PE</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-petrol-900 sm:text-4xl">{info.title}</h1>
            <p className="mt-1 text-[15px] text-ink-2">{info.sub}</p>
          </div>
          <div className="hidden lg:block">
            <LivePill nextIn={nextIn} paused={paused} onToggle={() => setPaused((p) => !p)} />
          </div>
        </div>

        {page === "painel" && <Painel readings={readings} limits={limits} alerts={alerts} acked={acked} go={go} now={now} onSimulateSpike={simulateSO2Spike} />}
        {page === "alertas" && (
          <AlertsPage
            alerts={alerts}
            acked={acked}
            ack={(ids) => setAcked((s) => new Set([...s, ...ids]))}
          />
        )}
        {page === "historico" && <HistoryPage readings={readings} limits={limits} />}
        {page === "limites" && session.profile === "gestao" && (
          <LimitsPage limits={limits} onSave={updateLimits} readings={readings} audit={limitAudit} />
        )}
        {page === "feedback" && <FeedbackPage isGestao={session.profile === "gestao"} author={who} />}
      </main>

      <button
        onClick={() => go("feedback")}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-petrol-700 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-white/20 transition hover:bg-petrol-800 lg:bottom-6 lg:right-6"
      >
        <Icon name="message" className="size-5" /> Enviar feedback
      </button>

      {/* Menu inferior (celular) */}
      <nav className={`fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden ${navItems.length === 5 ? "grid-cols-5" : "grid-cols-4"}`} aria-label="Menu principal">
        {navItems.map((n) => (
          <button
            key={n.id}
            onClick={() => go(n.id)}
            aria-current={page === n.id ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${page === n.id ? "text-petrol-700" : "text-ink-3"}`}
          >
            <span className={`relative grid h-7 w-12 place-items-center rounded-full transition-colors ${page === n.id ? "bg-petrol-100" : ""}`}>
              <Icon name={n.icon} className="size-5" />
              {n.id === "alertas" && pending > 0 && (
                <span className="absolute -right-0.5 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{pending}</span>
              )}
            </span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
    </ScopeContext.Provider>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-petrol-700 text-white">
        <Icon name="wind" className="size-6" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-xl font-bold tracking-tight text-petrol-900">
          Suape<span className="text-petrol-500">Ar</span>
        </div>
        {!compact && <div className="text-[11px] text-ink-3">Qualidade do ar · Suape</div>}
      </div>
    </div>
  );
}

function LivePill({ nextIn, paused, onToggle, compact = false }: { nextIn: number | null; paused: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-3 pr-1.5 text-sm">
      <span className={`size-2.5 rounded-full ${paused ? "bg-ink-3" : "live-dot bg-ok"}`} />
      <span className="font-semibold text-ink">{paused ? "Pausado" : "Ao vivo"}</span>
      {!compact && !paused && <span className="text-ink-3">· próxima leitura em {nextIn}s</span>}
      <button onClick={onToggle} className="rounded-full bg-petrol-50 px-3 py-1 text-xs font-semibold text-petrol-700 hover:bg-petrol-100">
        {paused ? "Retomar" : "Pausar"}
      </button>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white ${className}`}>{children}</section>;
}

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl bg-petrol-50 p-1">
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${value === o.v ? "bg-white text-petrol-800 shadow-sm" : "text-ink-2 hover:text-petrol-800"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

const fieldCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-petrol-500 focus:ring-4 focus:ring-petrol-500/15";

/* ---------------- Painel ---------------- */

const RECENT_READING_MS = LIVE_INTERVAL_MS * 3;

function MiniTrend({ values, level, muted = false }: { values: number[]; level: Level; muted?: boolean }) {
  if (values.length < 2) return <div className="h-8 text-xs text-ink-3">Sem histórico</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 100},${28 - ((value - min) / span) * 24}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={`h-8 w-full ${muted ? "text-ink-3" : STATUS[level].text}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function PollutantReading({
  pollutant,
  reading,
  history,
  limits,
  stale,
}: {
  pollutant: (typeof POLLUTANTS)[number];
  reading: Reading;
  history: Reading[];
  limits: Limits;
  stale: boolean;
}) {
  const value = reading.v[pollutant.id];
  const level = levelOf(value, limits[pollutant.id]);
  const values = history.slice(-16).map((item) => item.v[pollutant.id]);

  return (
    <div className="rounded-xl bg-canvas p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-2">{pollutant.label}</span>
        <span className="text-[10px] text-ink-3">{pollutant.unit}</span>
      </div>
      <div className={`mt-1 font-display text-2xl font-semibold leading-none ${stale ? "text-ink-3" : level ? STATUS[level].text : "text-ink"}`}>
        {stale ? "—" : fmt(value)}
      </div>
      <div className="mt-2">
        <MiniTrend values={values} level={level} muted={stale} />
      </div>
      <div className="mt-1 text-[10px] text-ink-3">Coleta às {hhmmss(reading.t)}</div>
    </div>
  );
}

function AlertToast({
  alert,
  dismiss,
  showAll,
}: {
  alert: Alert;
  dismiss: () => void;
  showAll: () => void;
}) {
  const pollutant = pol(alert.pollutant);
  const source = company(alert.companyId);
  const status = STATUS[alert.level];

  useEffect(() => {
    const id = window.setTimeout(dismiss, 6500);
    return () => window.clearTimeout(id);
  }, [alert.id]);

  return (
    <div role="status" className={`w-full rounded-2xl border bg-white p-4 shadow-xl ${status.border}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${status.soft}`}>
          <Icon name={status.icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Novo alerta · {status.label}</p>
              <p className="mt-0.5 font-semibold text-ink">{source.name} · {pollutant.label}</p>
            </div>
            <button onClick={dismiss} aria-label="Fechar notificação" className="rounded-lg p-1 text-ink-3 hover:bg-canvas hover:text-ink">
              <Icon name="close" className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {fmt(alert.value)} {pollutant.unit} · limite {fmt(alert.limit, 0)} · {hhmmss(alert.t)}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-3">{source.point}</p>
          <button onClick={showAll} className="mt-3 text-sm font-semibold text-petrol-700 hover:text-petrol-900">
            Ver todos os alertas
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertToasts({
  alerts,
  dismiss,
  showAll,
}: {
  alerts: Alert[];
  dismiss: (id: string) => void;
  showAll: () => void;
}) {
  if (!alerts.length) return null;
  return (
    <div className="fixed right-4 top-4 z-40 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6" aria-label="Novas notificações">
      {alerts.map((alert) => (
        <AlertToast key={alert.id} alert={alert} dismiss={() => dismiss(alert.id)} showAll={showAll} />
      ))}
    </div>
  );
}

function Painel({
  readings,
  limits,
  alerts,
  acked,
  go,
  now,
  onSimulateSpike,
}: {
  readings: Readings;
  limits: Limits;
  alerts: Alert[];
  acked: Set<string>;
  go: (p: Page) => void;
  now: number;
  onSimulateSpike: () => void;
}) {
  const COMPANIES = useScope();
  const [sel, setSel] = useState(COMPANIES[0].id);
  const [pid, setPid] = useState<PollutantId>("so2");
  const [period, setPeriod] = useState(2 * 3600e3);

  const latest = COMPANIES.map((c) => {
    const r = readings[c.id][readings[c.id].length - 1];
    const stale = !r || now - r.t > RECENT_READING_MS;
    return { c, r, stale, level: stale ? null : readingLevel(r, limits) };
  }).sort((a, b) => (b.level ?? -1) - (a.level ?? -1) || a.c.name.localeCompare(b.c.name, "pt-BR"));
  const activeAlerts = alerts.filter((alert) => alert.active).length;
  const critical = POLLUTANTS.map((pollutant) => {
    const highestRatio = latest.reduce(
      (max, item) => item.stale ? max : Math.max(max, item.r.v[pollutant.id] / limits[pollutant.id].danger),
      -1,
    );
    return { pollutant, ratio: highestRatio };
  }).sort((a, b) => b.ratio - a.ratio)[0];
  const selData = readings[sel];
  const end = selData[selData.length - 1].t;
  const points = selData.filter((r) => r.t >= end - period).map((r) => ({ t: r.t, v: r.v[pid] }));
  const lim = limits[pid];
  const p = pol(pid);
  const ranking = [...latest].sort((a, b) => b.r.v[pid] - a.r.v[pid]);
  const recent = alerts.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total de empresas", value: String(COMPANIES.length), detail: "no seu escopo", icon: "factory", tone: "bg-petrol-50 text-petrol-700" },
          { label: "Alertas ativos", value: String(activeAlerts), detail: activeAlerts === 1 ? "ocorrência atual" : "ocorrências atuais", icon: "alert", tone: activeAlerts ? STATUS[2].soft : STATUS[0].soft },
          {
            label: "Poluente mais crítico agora",
            value: critical.ratio < 0 ? "Sem dados" : critical.pollutant.label,
            detail: critical.ratio < 0 ? "aguardando leitura" : `${Math.round(critical.ratio * 100)}% do limite de perigo`,
            icon: "wind",
            tone: critical.ratio >= 1 ? STATUS[2].soft : critical.ratio >= 0.5 ? STATUS[1].soft : STATUS[0].soft,
          },
        ].map((k) => (
          <Card key={k.label} className="flex items-center gap-3.5 p-4 sm:p-5">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${k.tone}`}>
              <Icon name={k.icon} className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-ink-2">{k.label}</div>
              <div className="mt-1 truncate font-display text-2xl font-semibold leading-none text-ink">{k.value}</div>
              <div className="mt-1 text-xs text-ink-3">{k.detail}</div>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-petrol-900">Pontos de medição</h2>
          <button
            onClick={onSimulateSpike}
            className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-danger-ink"
          >
            <Icon name="alert" className="size-4" />
            Simular pico de SO₂
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {latest.map(({ c, r, level, stale }) => (
            <button
              key={c.id}
              onClick={() => setSel(c.id)}
              aria-pressed={sel === c.id}
              className={`rounded-2xl border bg-white p-5 text-left transition hover:shadow-md ${
                sel === c.id ? "border-petrol-600 ring-2 ring-petrol-600/20" : "border-line"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold leading-tight text-ink">{c.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                    <Icon name="pin" className="size-3.5" />
                    {c.point}
                  </p>
                </div>
                {level === null ? (
                  <span className="inline-flex items-center rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-3">Sem dados</span>
                ) : (
                  <StatusBadge level={level} />
                )}
              </div>
              <div key={r.t} className="flash mt-4 rounded-xl">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">Poluentes regulados</div>
                <div className="grid grid-cols-3 gap-2">
                  {POLLUTANTS.filter((q) => q.id !== "voc").map((q) => (
                    <PollutantReading key={q.id} pollutant={q} reading={r} history={readings[c.id]} limits={limits} stale={stale} />
                  ))}
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Compostos orgânicos voláteis</span>
                    <span className="text-[10px] text-ink-3">Sem padrão legal definido</span>
                  </div>
                  <PollutantReading pollutant={pol("voc")} reading={r} history={readings[c.id]} limits={limits} stale={stale} />
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
          <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-warn-ink/50" />limite de atenção</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-danger-ink/60" />limite de perigo</span>
          <span>Toque em um cartão para ver a tendência abaixo.</span>
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-petrol-900">Tendência · {company(sel).name}</h2>
              <p className="text-sm text-ink-2">
                {p.name} ({p.label}) em {p.unit}
              </p>
            </div>
            <Segmented
              label="Período"
              value={period}
              onChange={setPeriod}
              options={[
                { v: 3600e3, l: "1 h" },
                { v: 2 * 3600e3, l: "2 h" },
                { v: 6 * 3600e3, l: "6 h" },
                { v: 24 * 3600e3, l: "24 h" },
              ]}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {POLLUTANTS.map((q) => (
              <button
                key={q.id}
                onClick={() => setPid(q.id)}
                aria-pressed={pid === q.id}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  pid === q.id ? "border-petrol-700 bg-petrol-700 text-white" : "border-line bg-white text-ink-2 hover:border-petrol-300"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <LineChart points={points} warn={lim.warn} danger={lim.danger} unit={p.unit} label={`${p.label} de ${company(sel).name}`} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-xl font-semibold text-petrol-900">Comparativo · {p.label}</h2>
          <p className="text-sm text-ink-2">Leitura atual de cada empresa</p>
          <ul className="mt-5 space-y-4">
            {ranking.map(({ c, r }) => {
              const v = r.v[pid];
              const l = levelOf(v, lim);
              return (
                <li key={c.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-ink">{c.name}</span>
                    <span className={`shrink-0 font-semibold ${l ? STATUS[l].text : "text-ink"}`}>
                      {fmt(v)} <span className="text-xs font-normal text-ink-3">{p.unit}</span>
                    </span>
                  </div>
                  <LimitBar value={v} warn={lim.warn} danger={lim.danger} level={l} thick />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-petrol-900">Alertas recentes</h2>
          <button onClick={() => go("alertas")} className="flex items-center gap-1 text-sm font-semibold text-petrol-600 hover:text-petrol-800">
            Ver todos <Icon name="arrow" className="size-4" />
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">Nenhum alerta nas últimas 24 horas.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((a) => (
              <AlertRow key={a.id} a={a} acked={acked.has(a.id)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AlertRow({ a, acked, onAck }: { a: Alert; acked: boolean; onAck?: () => void }) {
  const s = STATUS[a.level];
  const p = pol(a.pollutant);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${s.soft}`}>
        <Icon name={s.icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="font-semibold text-ink">
          {company(a.companyId).name} · {p.label} <span className={s.text}>{fmt(a.value)} {p.unit}</span>
        </p>
        <p className="text-sm text-ink-2">
          {company(a.companyId).point} · limite de {a.level === 2 ? "perigo" : "atenção"}: {fmt(a.limit, 0)} {p.unit}
        </p>
        <p className="text-xs text-ink-3">
          Registrado em {dayTime(a.t)} às {hhmmss(a.t)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.active ? "bg-petrol-100 text-petrol-800" : "bg-canvas text-ink-3"}`}>
          {a.active ? "Ativo" : "Resolvido"}
        </span>
        {onAck &&
          (acked ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-ok-ink">
              <Icon name="tick" className="size-4" /> Reconhecido
            </span>
          ) : (
            <button onClick={onAck} className="rounded-lg border border-petrol-200 px-3 py-1.5 text-xs font-semibold text-petrol-700 hover:bg-petrol-50">
              Reconhecer
            </button>
          ))}
      </div>
    </li>
  );
}

/* ---------------- Alertas ---------------- */

function AlertsPage({ alerts, acked, ack }: { alerts: Alert[]; acked: Set<string>; ack: (ids: string[]) => void }) {
  const COMPANIES = useScope();
  const [cid, setCid] = useState("all");
  const [pid, setPid] = useState<"all" | PollutantId>("all");
  const [level, setLevel] = useState<"all" | "1" | "2">("all");
  const [status, setStatus] = useState<"all" | "active" | "resolved">("all");
  const [period, setPeriod] = useState("24");
  const periodMs = period === "all" ? Infinity : Number(period) * 3600e3;
  const cutoff = Date.now() - periodMs;
  const list = alerts
    .filter((a) => (cid === "all" ? true : a.companyId === cid))
    .filter((a) => (pid === "all" ? true : a.pollutant === pid))
    .filter((a) => (level === "all" ? true : a.level === Number(level)))
    .filter((a) => (status === "all" ? true : status === "active" ? a.active : !a.active))
    .filter((a) => a.t >= cutoff);
  const shown = list.slice(0, 80);
  const unacked = list.filter((a) => a.active && !acked.has(a.id)).map((a) => a.id);
  const last24h = alerts.filter((a) => a.t >= Date.now() - 24 * 3600e3);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Ativos agora", v: alerts.filter((a) => a.active).length, c: "text-petrol-800" },
          { l: "De perigo (24 h)", v: last24h.filter((a) => a.level === 2).length, c: "text-danger-ink" },
          { l: "De atenção (24 h)", v: last24h.filter((a) => a.level === 1).length, c: "text-warn-ink" },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <div className={`font-display text-3xl font-semibold ${k.c}`}>{k.v}</div>
            <div className="text-xs text-ink-2 sm:text-sm">{k.l}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Situação do alerta"
            value={status}
            onChange={setStatus}
            options={[
              { v: "all", l: "Todos" },
              { v: "active", l: "Ativos" },
              { v: "resolved", l: "Resolvidos" },
            ]}
          />
          <button
            disabled={!unacked.length}
            onClick={() => ack(unacked)}
            className="whitespace-nowrap rounded-xl bg-petrol-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-petrol-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reconhecer ativos
          </button>
        </div>
        <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-ink-2">
            Empresa
            <select value={cid} onChange={(e) => setCid(e.target.value)} className={`${fieldCls} mt-1.5 !py-2 font-normal`}>
              <option value="all">Todas as empresas</option>
              {COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-ink-2">
            Poluente
            <select value={pid} onChange={(e) => setPid(e.target.value as "all" | PollutantId)} className={`${fieldCls} mt-1.5 !py-2 font-normal`}>
              <option value="all">Todos os poluentes</option>
              {POLLUTANTS.map((pollutant) => (
                <option key={pollutant.id} value={pollutant.id}>{pollutant.label} · {pollutant.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-ink-2">
            Nível
            <select value={level} onChange={(e) => setLevel(e.target.value as "all" | "1" | "2")} className={`${fieldCls} mt-1.5 !py-2 font-normal`}>
              <option value="all">Todos os níveis</option>
              <option value="1">Atenção</option>
              <option value="2">Perigo</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-ink-2">
            Período
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${fieldCls} mt-1.5 !py-2 font-normal`}>
              <option value="1">Última hora</option>
              <option value="6">Últimas 6 horas</option>
              <option value="24">Últimas 24 horas</option>
              <option value="168">Últimos 7 dias</option>
              <option value="all">Todo o histórico</option>
            </select>
          </label>
        </div>
        <p className="mb-2 text-xs text-ink-3">{list.length} {list.length === 1 ? "alerta encontrado" : "alertas encontrados"}</p>
        {shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-3">Nenhum alerta para esse filtro.</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((a) => (
              <AlertRow key={a.id} a={a} acked={acked.has(a.id)} onAck={() => ack([a.id])} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Histórico ---------------- */

function HistoryPage({ readings, limits }: { readings: Readings; limits: Limits }) {
  const COMPANIES = useScope();
  const [cid, setCid] = useState(COMPANIES[0].id);
  const [pid, setPid] = useState<PollutantId>("pm10");
  const initialEnd = readings[COMPANIES[0].id][readings[COMPANIES[0].id].length - 1].t;
  const toLocalDateTime = (t: number) => {
    const d = new Date(t);
    return new Date(t - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  };
  const [from, setFrom] = useState(() => toLocalDateTime(initialEnd - 24 * 3600e3));
  const [to, setTo] = useState(() => toLocalDateTime(initialEnd + 1000));

  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  const invalidPeriod = !Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime > toTime;
  const all = readings[cid];
  const rows = invalidPeriod ? [] : all.filter((r) => r.t >= fromTime && r.t <= toTime);
  const vals = rows.map((r) => r.v[pid]);
  const p = pol(pid);
  const lim = limits[pid];
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const above = vals.length ? (vals.filter((v) => v >= lim.warn).length / vals.length) * 100 : null;
  const table = [...rows].reverse();

  const exportCsv = () => {
    if (!rows.length) return;
    const source = company(cid);
    const head = ["data_hora", "empresa", "ponto", "poluente", "valor", "unidade", "nivel"].join(";");
    const body = rows.map((r) => {
      const level = levelOf(r.v[pid], lim);
      return [
        new Date(r.t).toISOString(),
        source.name,
        source.point,
        p.label,
        String(r.v[pid]).replace(".", ","),
        p.unit,
        STATUS[level].label,
      ].join(";");
    });
    const blob = new Blob(["﻿" + [head, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `suapear-${cid}-${pid}-${from.slice(0, 10)}-${to.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block text-sm font-semibold text-ink-2">
            Empresa
            <select value={cid} onChange={(e) => setCid(e.target.value)} className={`${fieldCls} mt-1.5 font-normal`}>
              {COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink-2">
            Poluente
            <select value={pid} onChange={(e) => setPid(e.target.value as PollutantId)} className={`${fieldCls} mt-1.5 font-normal`}>
              {POLLUTANTS.map((q) => (
                <option key={q.id} value={q.id}>{q.label} · {q.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink-2">
            Data inicial
            <input type="datetime-local" step="1" value={from} onChange={(e) => setFrom(e.target.value)} className={`${fieldCls} mt-1.5 font-normal`} />
          </label>
          <label className="block text-sm font-semibold text-ink-2">
            Data final
            <input type="datetime-local" step="1" value={to} onChange={(e) => setTo(e.target.value)} className={`${fieldCls} mt-1.5 font-normal`} />
          </label>
          <button
            onClick={exportCsv}
            disabled={!rows.length || invalidPeriod}
            className="flex items-center justify-center gap-2 rounded-xl border border-petrol-200 px-4 py-2.5 text-sm font-semibold text-petrol-700 hover:bg-petrol-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="download" className="size-4" /> Exportar CSV
          </button>
        </div>
        {invalidPeriod && <p role="alert" className="mt-3 text-sm font-medium text-danger-ink">A data inicial deve ser anterior ou igual à data final.</p>}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "Mínimo", v: min === null ? "—" : fmt(min) },
          { l: "Média", v: avg === null ? "—" : fmt(avg) },
          { l: "Máximo", v: max === null ? "—" : fmt(max) },
          { l: "Leituras acima da atenção", v: above === null ? "—" : `${fmt(above, 0)}%` },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <div className="text-sm text-ink-2">{k.l}</div>
            <div className="mt-1 font-display text-2xl font-semibold text-ink">
              {k.v} {!k.l.startsWith("Leituras") && k.v !== "—" && <span className="text-sm font-normal text-ink-3">{p.unit}</span>}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="font-display text-xl font-semibold text-petrol-900">
          {p.label} · {company(cid).name}
        </h2>
        <p className="mb-3 text-sm text-ink-2">
          {rows.length} {rows.length === 1 ? "leitura" : "leituras"} no intervalo · linhas de atenção e perigo em destaque
        </p>
        <LineChart points={rows.map((r) => ({ t: r.t, v: r.v[pid] }))} warn={lim.warn} danger={lim.danger} unit={p.unit} label={`${p.label} de ${company(cid).name}`} height={320} />
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-petrol-900">Dados filtrados</h2>
              <p className="text-sm text-ink-2">{table.length} registros · somente leitura</p>
            </div>
            <span className="rounded-full bg-petrol-50 px-3 py-1 text-xs font-semibold text-petrol-700">Não editável</span>
          </div>
        </div>
        {table.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-3">Nenhuma leitura encontrada para os filtros selecionados.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-petrol-50 text-left text-xs uppercase tracking-wide text-ink-2">
                <tr>
                  <th className="px-5 py-3 font-semibold">Data e hora</th>
                  <th className="px-4 py-3 font-semibold">Empresa / ponto</th>
                  <th className="px-4 py-3 font-semibold">Poluente</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.map((r) => (
                  <tr key={r.t}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-2">{dayTime(r.t)}:{String(new Date(r.t).getSeconds()).padStart(2, "0")}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{company(cid).name}</div>
                      <div className="text-xs text-ink-3">{company(cid).point}</div>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{p.label}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink">{fmt(r.v[pid])} <span className="text-xs font-normal text-ink-3">{p.unit}</span></td>
                    <td className="px-5 py-2.5"><StatusBadge level={levelOf(r.v[pid], lim)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Limites ---------------- */

function LimitsPage({
  limits,
  onSave,
  readings,
  audit,
}: {
  limits: Limits;
  onSave: (l: Limits) => void;
  readings: Readings;
  audit: LimitAudit[];
}) {
  const COMPANIES = useScope();
  const toDraft = (l: Limits) =>
    Object.fromEntries(POLLUTANTS.map((q) => [q.id, { warn: String(l[q.id].warn), danger: String(l[q.id].danger) }])) as Record<PollutantId, { warn: string; danger: string }>;
  const [draft, setDraft] = useState(() => toDraft(limits));
  const [saved, setSaved] = useState(false);

  const err = (id: PollutantId) => {
    const w = Number(draft[id].warn.replace(",", "."));
    const d = Number(draft[id].danger.replace(",", "."));
    if (!(w > 0) || !(d > 0)) return "Informe valores maiores que zero.";
    if (w >= d) return "O limite de atenção deve ser menor que o de perigo.";
    return "";
  };

  const edit = (id: PollutantId, key: "warn" | "danger", value: string) => {
    setSaved(false);
    setDraft({ ...draft, [id]: { ...draft[id], [key]: value } });
  };

  const reset = () => {
    setSaved(false);
    setDraft(toDraft(DEFAULT_LIMITS));
  };
  const parsed = Object.fromEntries(
    POLLUTANTS.map((q) => [q.id, {
      warn: Number(draft[q.id].warn.replace(",", ".")),
      danger: Number(draft[q.id].danger.replace(",", ".")),
    }]),
  ) as Limits;
  const invalid = POLLUTANTS.some((q) => Boolean(err(q.id)));
  const dirty = POLLUTANTS.some(
    (q) => parsed[q.id].warn !== limits[q.id].warn || parsed[q.id].danger !== limits[q.id].danger,
  );
  const save = () => {
    if (invalid || !dirty) return;
    onSave(parsed);
    setSaved(true);
  };

  const counts = [0, 1, 2].map((l) => COMPANIES.filter((c) => readingLevel(readings[c.id][readings[c.id].length - 1], limits) === l).length);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-warn/40 bg-warn-soft p-4 text-sm font-medium text-warn-ink">
        <span className="flex items-center gap-2">
          <Icon name="alert" className="size-5 shrink-0" />
          valores de exemplo, a validar com a legislação vigente
        </span>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-petrol-900">Limites por poluente</h2>
            <p className="text-sm text-ink-2">Valores em µg/m³. As alterações passam a valer após salvar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={reset} className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-ink-2 hover:bg-petrol-50">
              <Icon name="reset" className="size-4" /> Restaurar exemplos
            </button>
            <button
              onClick={save}
              disabled={invalid || !dirty}
              className="flex items-center gap-2 rounded-xl bg-petrol-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-petrol-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="tick" className="size-4" /> Salvar limites
            </button>
          </div>
        </div>
        {saved && (
          <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-sm font-semibold text-ok-ink">
            Limites salvos. O painel e os alertas já usam os novos valores.
          </p>
        )}
        <div className="space-y-4">
          {POLLUTANTS.map((q) => {
            const e = err(q.id);
            return (
              <div key={q.id} className="rounded-xl border border-line p-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-lg font-semibold text-ink">{q.label}</span>
                  <span className="text-sm text-ink-3">{q.name}</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-warn-ink">
                    <span className="flex items-center gap-1.5"><Icon name="alert" className="size-4" /> Atenção a partir de</span>
                    <input inputMode="decimal" value={draft[q.id].warn} onChange={(ev) => edit(q.id, "warn", ev.target.value)} className={`${fieldCls} mt-1.5 font-normal`} />
                  </label>
                  <label className="block text-sm font-semibold text-danger-ink">
                    <span className="flex items-center gap-1.5"><Icon name="octagon" className="size-4" /> Perigo a partir de</span>
                    <input inputMode="decimal" value={draft[q.id].danger} onChange={(ev) => edit(q.id, "danger", ev.target.value)} className={`${fieldCls} mt-1.5 font-normal`} />
                  </label>
                </div>
                {e && <p role="alert" className="mt-2 text-sm font-medium text-danger-ink">{e}</p>}
              </div>
            );
          })}
        </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
          <h2 className="font-display text-xl font-semibold text-petrol-900">Efeito agora</h2>
          <p className="text-sm text-ink-2">Situação dos {COMPANIES.length} {COMPANIES.length === 1 ? "ponto" : "pontos"} com os limites atuais</p>
          <ul className="mt-4 space-y-2.5">
            {[0, 1, 2].map((l) => (
              <li key={l} className="flex items-center justify-between">
                <StatusBadge level={l as Level} />
                <span className="font-display text-2xl font-semibold">{counts[l]}</span>
              </li>
            ))}
          </ul>
          </Card>
          <Card className="bg-petrol-50 p-5 text-sm leading-relaxed text-petrol-900">
          <h3 className="font-display text-lg font-semibold">Como funciona</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-2">
            <li><b className="text-ok-ink">Normal:</b> abaixo do limite de atenção.</li>
            <li><b className="text-warn-ink">Atenção:</b> igual ou acima do limite de atenção.</li>
            <li><b className="text-danger-ink">Perigo:</b> igual ou acima do limite de perigo.</li>
            <li>O status de uma empresa é o do seu pior poluente.</li>
            <li>Os valores de exemplo são ilustrativos e não substituem a legislação vigente.</li>
          </ul>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="font-display text-xl font-semibold text-petrol-900">Auditoria de alterações</h2>
          <p className="text-sm text-ink-2">Histórico dos últimos 100 ajustes salvos neste navegador.</p>
        </div>
        {audit.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-3">Nenhuma alteração registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-petrol-50 text-left text-xs uppercase tracking-wide text-ink-2">
                <tr>
                  <th className="px-5 py-3 font-semibold">Data e hora</th>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-4 py-3 font-semibold">Poluente</th>
                  <th className="px-4 py-3 font-semibold">Valor anterior</th>
                  <th className="px-5 py-3 font-semibold">Novo valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-2">{dayTime(entry.t)} · {hhmmss(entry.t)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{entry.user}</td>
                    <td className="px-4 py-3 font-semibold text-petrol-800">{pol(entry.pollutant).label}</td>
                    <td className="px-4 py-3 text-ink-2">Atenção {fmt(entry.oldValue.warn)} · Perigo {fmt(entry.oldValue.danger)} µg/m³</td>
                    <td className="px-5 py-3 font-semibold text-ink">Atenção {fmt(entry.newValue.warn)} · Perigo {fmt(entry.newValue.danger)} µg/m³</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Feedback ---------------- */

type FeedbackItem = {
  id: number;
  rating: number;
  useful: boolean;
  category: string;
  comment: string;
  author: string;
  t: number;
};

const FEEDBACK_CATEGORIES = ["Painel", "Alertas", "Histórico", "Outro"];
const FEEDBACK_KEY = "suapear-feedback";

function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="flex" aria-label={`Nota ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" fill={n <= Math.round(value)} className={`${size} ${n <= Math.round(value) ? "text-warn" : "text-petrol-200"}`} />
      ))}
    </span>
  );
}

function FeedbackPage({ isGestao, author }: { isGestao: boolean; author: string }) {
  const [items, setItems] = useState<FeedbackItem[]>(() => load<FeedbackItem[]>(FEEDBACK_KEY) ?? []);
  const [rating, setRating] = useState(0);
  const [useful, setUseful] = useState<boolean | null>(null);
  const [category, setCategory] = useState(FEEDBACK_CATEGORIES[0]);
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);

  const invalid = rating === 0 || useful === null;
  const avg = items.length ? items.reduce((a, f) => a + f.rating, 0) / items.length : 0;
  const usefulPct = items.length ? Math.round((items.filter((f) => f.useful).length / items.length) * 100) : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    const next = [{ id: Date.now(), rating, useful: useful === true, category, comment: comment.trim(), author, t: Date.now() }, ...items];
    setItems(next);
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
    setSent(true);
  };

  const again = () => {
    setRating(0);
    setUseful(null);
    setCategory(FEEDBACK_CATEGORIES[0]);
    setComment("");
    setTouched(false);
    setSent(false);
  };

  const choice = (active: boolean) =>
    `flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
      active ? "border-petrol-700 bg-petrol-700 text-white" : "border-line bg-white text-ink-2 hover:bg-petrol-50"
    }`;

  return (
    <div className={`grid gap-6 ${isGestao ? "xl:grid-cols-5" : "mx-auto max-w-xl"}`}>
      <Card className={`p-5 ${isGestao ? "xl:col-span-2" : ""}`}>
        {sent ? (
          <div role="status" className="flex flex-col items-center py-8 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-ok-soft text-ok-ink">
              <Icon name="check" className="size-7" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold text-petrol-900">Obrigado pelo seu feedback!</h2>
            <p className="mt-1 max-w-xs text-sm text-ink-2">Sua opinião foi registrada e ajuda a melhorar o monitoramento do ar em Suape.</p>
            <button onClick={again} className="mt-5 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-petrol-700 hover:bg-petrol-50">
              Enviar outro
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl font-semibold text-petrol-900">Envie sua opinião</h2>
            <p className="mb-5 text-sm text-ink-2">Leva menos de um minuto.</p>
            <form onSubmit={submit} className="space-y-5" noValidate>
              <fieldset>
                <legend className="text-sm font-semibold text-ink-2">Nota geral</legend>
                <div className="mt-1.5 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} de 5 estrelas`} aria-pressed={rating === n} className="rounded-lg p-1 transition hover:scale-110">
                      <Icon name="star" fill={n <= rating} className={`size-8 ${n <= rating ? "text-warn" : "text-petrol-200"}`} />
                    </button>
                  ))}
                </div>
                {touched && rating === 0 && <p role="alert" className="text-sm font-medium text-danger-ink">Escolha uma nota de 1 a 5.</p>}
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold text-ink-2">O alerta foi útil?</legend>
                <div className="mt-1.5 flex gap-2">
                  <button type="button" aria-pressed={useful === true} onClick={() => setUseful(true)} className={choice(useful === true)}>Sim</button>
                  <button type="button" aria-pressed={useful === false} onClick={() => setUseful(false)} className={choice(useful === false)}>Não</button>
                </div>
                {touched && useful === null && <p role="alert" className="mt-1 text-sm font-medium text-danger-ink">Responda Sim ou Não.</p>}
              </fieldset>
              <label className="block text-sm font-semibold text-ink-2">
                Categoria
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${fieldCls} mt-1.5 font-normal`}>
                  {FEEDBACK_CATEGORIES.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-ink-2">
                Comentário <span className="font-normal text-ink-3">(opcional)</span>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} className={`${fieldCls} mt-1.5 resize-none font-normal`} placeholder="Conte o que você observou ou gostaria de ver…" />
              </label>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-petrol-700 px-4 py-3 font-semibold text-white transition hover:bg-petrol-800">
                <Icon name="send" className="size-4" /> Enviar feedback
              </button>
            </form>
          </>
        )}
      </Card>

      {isGestao && (
        <Card className="p-5 xl:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-petrol-900">Feedbacks recebidos</h2>
              <p className="text-sm text-ink-2">{items.length} {items.length === 1 ? "resposta" : "respostas"}</p>
            </div>
            {items.length > 0 && (
              <div className="flex items-center gap-5">
                <div className="text-right leading-tight">
                  <div className="font-display text-3xl font-semibold text-petrol-900">{avg.toFixed(1).replace(".", ",")}</div>
                  <div className="text-xs text-ink-3">média das notas</div>
                </div>
                <div className="text-right leading-tight">
                  <div className="font-display text-3xl font-semibold text-petrol-900">{usefulPct}%</div>
                  <div className="text-xs text-ink-3">acharam o alerta útil</div>
                </div>
              </div>
            )}
          </div>
          {items.length === 0 ? (
            <p className="mt-6 rounded-xl bg-petrol-50 p-6 text-center text-sm text-ink-2">Nenhum feedback enviado ainda. As respostas aparecerão aqui.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {items.map((f) => (
                <li key={f.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="leading-tight">
                      <div className="font-semibold text-ink">{f.author}</div>
                      <div className="text-xs text-ink-3">{dayTime(f.t)}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-petrol-50 px-2.5 py-1 text-xs font-semibold text-petrol-700">{f.category}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${f.useful ? "bg-ok-soft text-ok-ink" : "bg-danger-soft text-danger-ink"}`}>
                        Alerta {f.useful ? "útil" : "não útil"}
                      </span>
                      <Stars value={f.rating} />
                    </div>
                  </div>
                  {f.comment && <p className="mt-2.5 text-[15px] leading-relaxed text-ink-2">{f.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
