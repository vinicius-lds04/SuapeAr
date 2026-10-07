import { COMPANIES, POLLUTANTS, levelOf, readingLevel, type Level, type Limits, type PollutantId, type Reading } from "./data";
import { Icon, STATUS, fmt, hhmmss } from "./ui";

const STATUS_VIEW = [
  { word: "Normal", bg: "bg-ok", fg: "text-white", panel: "bg-white/15" },
  { word: "Atenção", bg: "bg-warn", fg: "text-ink", panel: "bg-black/10" },
  { word: "Perigo", bg: "bg-danger", fg: "text-white", panel: "bg-black/20" },
] as const;

const ACTIONS: Record<Level, Record<PollutantId, string>> = {
  0: { so2: "Siga o trabalho normalmente.", pm25: "Siga o trabalho normalmente.", pm10: "Siga o trabalho normalmente.", voc: "Siga o trabalho normalmente." },
  1: { so2: "Use máscara com filtro ácido.", pm25: "Use máscara PFF2.", pm10: "Use máscara PFF2.", voc: "Use respirador com filtro orgânico." },
  2: { so2: "Evacue a área agora.", pm25: "Evacue a área agora.", pm10: "Evacue a área agora.", voc: "Evacue a área e evite faíscas." },
};

function analyse(readings: Reading[], limits: Limits) {
  const latest = readings[readings.length - 1];
  const ratio = (r: Reading, id: PollutantId) => r.v[id] / limits[id].warn;
  const worst = (r: Reading, only?: (id: PollutantId) => boolean) =>
    POLLUTANTS.map((p) => p.id)
      .filter((id) => !only || only(id))
      .reduce((a, b) => (ratio(r, b) > ratio(r, a) ? b : a));

  // Perigo "trava" até todos os poluentes voltarem ao normal.
  let latched: Reading | null = null;
  for (let i = readings.length - 1; i >= 0; i--) {
    const r = readings[i];
    if (readingLevel(r, limits) === 0) break;
    if (!latched && POLLUTANTS.some((p) => levelOf(r.v[p.id], limits[p.id]) === 2)) latched = r;
  }

  const current = readingLevel(latest, limits);
  const level: Level = latched ? 2 : current;
  if (latched) {
    const id = worst(latched, (p) => levelOf(latched!.v[p], limits[p]) === 2);
    return { level, id, latest, held: current < 2, peak: latched.v[id] };
  }
  const id = worst(latest, current ? (p) => levelOf(latest.v[p], limits[p]) === current : undefined);
  return { level, id, latest, held: false, peak: latest.v[id] };
}

export default function OperatorView({ companyId, readings, limits, onLogout }: { companyId?: string; readings: Reading[]; limits: Limits; onLogout: () => void }) {
  const company = COMPANIES.find((c) => c.id === companyId);
  const { level, id, latest, held, peak } = analyse(readings, limits);
  const v = STATUS_VIEW[level];
  const pol = POLLUTANTS.find((p) => p.id === id)!;
  const value = latest.v[id];

  return (
    <div role={level === 2 ? "alert" : "status"} aria-live={level === 2 ? "assertive" : "polite"} className={`fixed inset-0 flex flex-col overflow-y-auto px-5 pb-6 pt-4 transition-colors duration-500 ${v.bg} ${v.fg}`}>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold opacity-90">{company?.name ?? "Área"}</div>
          <div className="truncate text-sm opacity-80">{company?.point}</div>
        </div>
        <button onClick={onLogout} aria-label="Sair" className={`grid size-12 shrink-0 place-items-center rounded-full ${v.panel}`}>
          <Icon name="logout" className="size-6" />
        </button>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-6 py-6">
        <div>
          <Icon name={STATUS[level].icon} className="size-16 sm:size-20" />
          <h1 className="mt-2 font-display text-7xl font-bold leading-none tracking-tight sm:text-8xl">{v.word}</h1>
          {held && <p className="mt-3 text-lg font-semibold">Alerta mantido até o ar voltar ao normal.</p>}
        </div>

        <section className={`rounded-3xl p-5 ${v.panel}`}>
          <p className="text-lg font-semibold">
            {level === 0 ? "Maior valor" : "Poluente crítico"}: <span className="font-bold">{pol.label}</span>
          </p>
          <p className="mt-1 font-display text-6xl font-bold leading-none sm:text-7xl">
            {fmt(value, 0)}
            <span className="ml-2 text-2xl font-semibold opacity-90">{pol.unit}</span>
          </p>
          <p className="mt-3 text-base opacity-90">
            Medido às {hhmmss(latest.t)}
            {held && <> · pico de {fmt(peak, 0)} {pol.unit}</>}
          </p>
        </section>

        <section className="rounded-3xl bg-white p-5 text-ink shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-3">O que fazer</p>
          <p className="mt-1 font-display text-3xl font-bold leading-tight sm:text-4xl">{held ? ACTIONS[2][id] : ACTIONS[level][id]}</p>
        </section>
      </main>

      <footer className="text-center text-sm opacity-80">Atualiza a cada 5 segundos · dados simulados</footer>
    </div>
  );
}
