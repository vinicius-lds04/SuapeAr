// SuapeAr - arquivo único de dados 100% simulados (empresas, limites, leituras e gerador em tempo real).

export type PollutantId = "so2" | "pm25" | "pm10" | "voc";
export type Level = 0 | 1 | 2; // 0 normal, 1 atenção, 2 perigo
export type Limits = Record<PollutantId, { warn: number; danger: number }>;
export type Reading = { t: number; v: Record<PollutantId, number> };

export const POLLUTANTS: { id: PollutantId; label: string; name: string; unit: string }[] = [
  { id: "so2", label: "SO₂", name: "Dióxido de enxofre", unit: "µg/m³" },
  { id: "pm25", label: "MP2,5", name: "Material particulado fino", unit: "µg/m³" },
  { id: "pm10", label: "MP10", name: "Material particulado inalável", unit: "µg/m³" },
  { id: "voc", label: "COV", name: "Compostos orgânicos voláteis", unit: "µg/m³" },
];

export const DEFAULT_LIMITS: Limits = {
  so2: { warn: 40, danger: 125 },
  pm25: { warn: 15, danger: 60 },
  pm10: { warn: 45, danger: 120 },
  voc: { warn: 100, danger: 300 },
};

export type Company = {
  id: string;
  name: string;
  sector: string;
  point: string;
  means: Record<PollutantId, number>;
};

export const COMPANIES: Company[] = [
  {
    id: "refinaria",
    name: "Refinaria Atlântico",
    sector: "Refino de petróleo",
    point: "P1 · Cerca Norte",
    means: { so2: 30, pm25: 14, pm10: 32, voc: 165 },
  },
  {
    id: "quimica",
    name: "Química Ipojuca",
    sector: "Petroquímica",
    point: "P2 · Portaria Leste",
    means: { so2: 17, pm25: 12, pm10: 30, voc: 185 },
  },
  {
    id: "graneis",
    name: "Terminal de Granéis",
    sector: "Movimentação de granéis sólidos",
    point: "P3 · Píer 2",
    means: { so2: 6, pm25: 19, pm10: 39, voc: 40 },
  },
  {
    id: "termo",
    name: "Termelétrica Cabo",
    sector: "Geração de energia",
    point: "P4 · Chaminé Sul",
    means: { so2: 32, pm25: 16, pm10: 30, voc: 30 },
  },
  {
    id: "estaleiro",
    name: "Estaleiro Norte",
    sector: "Construção naval",
    point: "P5 · Doca Seca",
    means: { so2: 8, pm25: 11, pm10: 28, voc: 120 },
  },
  {
    id: "logistica",
    name: "Logística Portuária",
    sector: "Armazenagem e transporte",
    point: "P6 · Pátio de Contêineres",
    means: { so2: 10, pm25: 14, pm10: 35, voc: 50 },
  },
];

export const levelOf = (value: number, lim: { warn: number; danger: number }): Level =>
  value >= lim.danger ? 2 : value >= lim.warn ? 1 : 0;

export const readingLevel = (r: Reading, limits: Limits): Level =>
  POLLUTANTS.reduce<Level>((m, p) => Math.max(m, levelOf(r.v[p.id], limits[p.id])) as Level, 0);

// ---------- gerador de leituras ----------

const STEP_MS_HISTORY = 5 * 60 * 1000;
const HISTORY_POINTS = 288; // 24 h a cada 5 min
export const LIVE_INTERVAL_MS = 5000;
export const MAX_POINTS = 2500;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (rnd: () => number) =>
  Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

type State = { x: Record<PollutantId, number>; shock: Record<PollutantId, number> };

export function createSimulator() {
  const states: Record<string, State> = {};
  COMPANIES.forEach((c) => {
    states[c.id] = {
      x: { ...c.means },
      shock: { so2: 0, pm25: 0, pm10: 0, voc: 0 },
    };
  });

  function step(c: Company, t: number, rnd: () => number, pSpike: number): Reading {
    const s = states[c.id];
    const d = new Date(t);
    const hour = d.getHours() + d.getMinutes() / 60;
    const diurnal = 1 + 0.15 * Math.sin((2 * Math.PI * (hour - 8)) / 24);
    const v = {} as Record<PollutantId, number>;
    POLLUTANTS.forEach(({ id }) => {
      const mean = c.means[id];
      const target = mean * diurnal * (1 + s.shock[id]);
      s.x[id] = Math.max(mean * 0.15, s.x[id] + 0.18 * (target - s.x[id]) + mean * 0.04 * gauss(rnd));
      s.shock[id] *= 0.9;
      v[id] = Math.round(s.x[id] * 10) / 10;
    });
    if (rnd() < pSpike) {
      const id = POLLUTANTS[Math.floor(rnd() * POLLUTANTS.length)].id;
      s.shock[id] += rnd() < 0.15 ? 2.2 + rnd() * 2.2 : 0.4 + rnd() * 0.9;
    }
    return { t, v };
  }

  const history: Record<string, Reading[]> = {};
  // Mantém a amostra final recente para que o painel não comece em estado "sem dados".
  const end = Date.now();
  COMPANIES.forEach((c, i) => {
    const rnd = mulberry32(7700 + i * 101);
    const arr: Reading[] = [];
    for (let k = HISTORY_POINTS - 1; k >= 0; k--) {
      arr.push(step(c, end - k * STEP_MS_HISTORY, rnd, 0.012));
    }
    history[c.id] = arr;
  });

  return {
    history,
    next(): Record<string, Reading> {
      const t = Date.now();
      const out: Record<string, Reading> = {};
      COMPANIES.forEach((c) => {
        out[c.id] = step(c, t, Math.random, 0.006);
      });
      return out;
    },
    spikeSO2(companyId: string, value: number): Record<string, Reading> {
      const out = this.next();
      states[companyId].x.so2 = value;
      out[companyId].v.so2 = Math.round(value * 10) / 10;
      return out;
    },
  };
}

export type Simulator = ReturnType<typeof createSimulator>;
