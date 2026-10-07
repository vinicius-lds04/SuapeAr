import { useEffect, useState } from "react";
import { COMPANIES } from "./data";
import { Icon, LimitBar, STATUS, StatusBadge } from "./ui";

export type Profile = "gestao" | "empresa" | "operador";
export type Session = { profile: Profile; companyId?: string };

const PROFILES: { id: Profile; title: string; desc: string; icon: string }[] = [
  { id: "gestao", title: "Gestão do Porto", desc: "Acompanha todas as empresas do complexo.", icon: "anchor" },
  { id: "empresa", title: "Empresa", desc: "Acompanha apenas o seu ponto de medição.", icon: "factory" },
  { id: "operador", title: "Operador", desc: "Tela simples para o celular, com a ação recomendada.", icon: "alert" },
];

export function Login({ onEnter }: { onEnter: (s: Session) => void }) {
  const [profile, setProfile] = useState<Profile>("gestao");
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-petrol-800 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -bottom-32 -right-24 size-[520px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-10 -right-2 size-[320px] rounded-full border border-white/10" />
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-white/12">
            <Icon name="wind" className="size-6" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">
            Suape<span className="text-petrol-300">Ar</span>
          </span>
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">O ar de Suape, medido a cada 5 segundos.</h2>
          <p className="mt-5 text-lg leading-relaxed text-petrol-100">
            Monitoramento da qualidade do ar do Complexo Industrial Portuário, com alertas quando algum poluente passa do limite.
          </p>
        </div>
        <p className="text-sm text-petrol-200">Ipojuca · Pernambuco · dados simulados para demonstração</p>
      </div>

      <div className="flex items-center justify-center p-5 sm:p-10">
        <form
          className="w-full max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            onEnter(profile !== "gestao" ? { profile, companyId } : { profile });
          }}
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-petrol-700 text-white">
              <Icon name="wind" className="size-6" />
            </div>
            <span className="font-display text-xl font-bold text-petrol-900">
              Suape<span className="text-petrol-500">Ar</span>
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-petrol-900">Entrar</h1>
          <p className="mt-1.5 text-[15px] text-ink-2">Escolha como você vai acompanhar a qualidade do ar. Não é preciso senha.</p>

          <div role="radiogroup" aria-label="Perfil de acesso" className="mt-7 space-y-3">
            {PROFILES.map((p) => {
              const on = profile === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setProfile(p.id)}
                  className={`flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition ${
                    on ? "border-petrol-600 ring-2 ring-petrol-600/20" : "border-line hover:border-petrol-300"
                  }`}
                >
                  <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${on ? "bg-petrol-700 text-white" : "bg-petrol-50 text-petrol-600"}`}>
                    <Icon name={p.icon} className="size-6" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-lg font-semibold text-ink">{p.title}</span>
                    <span className="block text-sm text-ink-2">{p.desc}</span>
                  </span>
                  <span className={`grid size-6 place-items-center rounded-full border-2 ${on ? "border-petrol-600 bg-petrol-600 text-white" : "border-line"}`}>
                    {on && <Icon name="tick" className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>

          {profile !== "gestao" && (
            <label className="mt-5 block text-sm font-semibold text-ink-2">
              {profile === "operador" ? "Sua área" : "Sua empresa"}
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] font-normal text-ink outline-none focus:border-petrol-500 focus:ring-4 focus:ring-petrol-500/15"
              >
                {COMPANIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.point}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button type="submit" className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-petrol-700 px-4 py-3.5 font-semibold text-white transition hover:bg-petrol-800">
            Entrar <Icon name="arrow" className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "O que é o SuapeAr", icon: "wind" },
  { title: "Como ler o painel", icon: "dashboard" },
  { title: "Como funcionam os alertas", icon: "bell" },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-petrol-900/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="ob-title" className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-petrol-500">
            Passo {step + 1} de {STEPS.length}
          </span>
          <div className="flex gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-7 bg-petrol-600" : i < step ? "w-3 bg-petrol-300" : "w-3 bg-petrol-100"}`} />
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-petrol-700 text-white">
            <Icon name={STEPS[step].icon} className="size-6" />
          </span>
          <h2 id="ob-title" className="font-display text-2xl font-semibold leading-tight text-petrol-900">
            {STEPS[step].title}
          </h2>
        </div>

        <div className="mt-5 min-h-64 text-[15px] leading-relaxed text-ink-2">
          {step === 0 && (
            <div className="space-y-4">
              <p>
                O <b className="text-ink">SuapeAr</b> acompanha a qualidade do ar no Complexo Industrial Portuário de Suape. Cada uma das 6 empresas tem um ponto de medição.
              </p>
              <p>Quatro poluentes são medidos em µg/m³, com uma leitura nova a cada 5 segundos:</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  ["SO₂", "Dióxido de enxofre"],
                  ["MP2,5", "Partículas finas"],
                  ["MP10", "Partículas inaláveis"],
                  ["COV", "Orgânicos voláteis"],
                ].map(([a, b]) => (
                  <div key={a} className="rounded-xl bg-petrol-50 px-3.5 py-2.5">
                    <div className="font-display text-lg font-semibold text-petrol-800">{a}</div>
                    <div className="text-xs text-ink-2">{b}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p>Cada cartão mostra o valor atual dos poluentes. A cor e o selo indicam a situação:</p>
              <ul className="space-y-2">
                {[
                  ["Abaixo do limite de atenção.", 0],
                  ["Chegou ao limite de atenção. Vale acompanhar.", 1],
                  ["Chegou ao limite de perigo. Exige ação.", 2],
                ].map(([t, l]) => (
                  <li key={l as number} className="flex items-center gap-3">
                    <span className="w-24 shrink-0">
                      <StatusBadge level={l as 0 | 1 | 2} />
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-petrol-50 p-3.5">
                <div className="mb-2 flex justify-between text-xs font-semibold text-ink-2">
                  <span>MP10 · exemplo</span>
                  <span className={STATUS[1].text}>58,0 µg/m³</span>
                </div>
                <LimitBar value={58} warn={50} danger={100} level={1} thick />
                <p className="mt-2 text-xs text-ink-3">A barra enche até o limite de perigo. Os traços marcam atenção (amarelo) e perigo (vermelho).</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p>Um alerta é criado quando uma leitura cruza um limite, de normal para atenção ou de atenção para perigo.</p>
              <ol className="space-y-3">
                {[
                  ["Detecção", "A nova leitura passa do limite e aparece em Alertas."],
                  ["Acompanhamento", "O alerta fica Ativo até o poluente voltar ao normal; depois vira Resolvido."],
                  ["Reconhecimento", "Use Reconhecer para avisar a equipe que você viu. O contador no menu diminui."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-petrol-100 text-sm font-bold text-petrol-700">{i + 1}</span>
                    <span>
                      <b className="text-ink">{t}.</b> {d}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-sm">No perfil Gestão do Porto, os limites podem ser ajustados na tela Limites.</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={onDone} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-3 hover:bg-canvas hover:text-ink-2">
            Pular
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-2 hover:bg-petrol-50">
                Voltar
              </button>
            )}
            <button
              autoFocus
              onClick={() => (last ? onDone() : setStep(step + 1))}
              className="flex items-center gap-2 rounded-xl bg-petrol-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-petrol-800"
            >
              {last ? "Começar" : "Próximo"} <Icon name="arrow" className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
