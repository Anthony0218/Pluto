import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Bot, Play, Wand2 } from "lucide-react";
import { explainConfiguration, generateRulebookFacts } from "@/games/cards/engine/rulebook";
import { findTemplate } from "@/games/cards/templates";
import { Chip, Panel } from "@/components/chessCustom/ui";
import CardBuilderLayout from "./CardBuilderLayout";

const button = "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-amber-300";

export default function TemplatePage() {
  useGameLanguage();
  const { templateId = "" } = useParams();
  const { hash } = useLocation();
  const template = findTemplate(templateId);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  if (!template) {
    return (
      <CardBuilderLayout crumbs={[{ label: "Unknown template" }]}>
        <p className="text-zinc-400">{gameUi("There is no template called “")}{gameUi(templateId)}”.</p>
      </CardBuilderLayout>
    );
  }
  const def = template.definition;
  const facts = generateRulebookFacts(def);
  const sections = explainConfiguration(def);
  const rulebook = [
    ["Overview", def.rulebook.overview],
    ["Setup", def.rulebook.setup],
    ["Gameplay", def.rulebook.gameplay],
    ["Winning", def.rulebook.winning],
    ["Notes", def.rulebook.notes],
  ].filter(([, text]) => text);

  return (
    <CardBuilderLayout crumbs={[{ label: def.name }]}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">{gameUi("Template")}</p>
          <h1 className="mt-2 text-4xl font-black">{gameUi(def.name)}</h1>
          <p className="mt-2 text-sm text-zinc-400">{gameUi(def.description)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={`${button} border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]`} to={`/games/create?template=${def.id}`}>
            <Wand2 size={16} />{gameUi(" Use as template ")}</Link>
          <Link className={`${button} border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]`} to={`/games/card-builder/simulation?template=${def.id}`}>
            <Bot size={16} />{gameUi(" Simulate ")}</Link>
          <Link className={`${button} border-amber-300/60 bg-amber-300 text-zinc-950 hover:bg-amber-200`} to={`/games/card-builder/play?template=${def.id}&quick=1`}>
            <Play size={16} />{gameUi(" Start test game ")}</Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section id="rules" aria-label={gameUi("Rules")} className="scroll-mt-6 space-y-4">
          <Panel title={gameUi("Rules")} eyebrow="Written by the author">
            <div className="space-y-4">
              {rulebook.map(([title, text]) => (
                <div key={title}>
                  <h3 className="text-sm font-bold text-amber-200">{gameUi(title)}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-300">{gameUi(text)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>
        <Panel title={gameUi("At a glance")} eyebrow="Generated from the configuration">
          <ul className="space-y-2 text-sm text-zinc-300">
            {facts.map((fact, index) => (
              <li key={index}>{gameUi(fact.text)}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <section id="configuration" aria-labelledby="config-title" className="mt-10 scroll-mt-6 space-y-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">{gameUi("Under the hood")}</p>
          <h2 id="config-title" className="mt-1 text-3xl font-black">{gameUi("How this template is configured")}</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">{gameUi("Nothing below is special code: the engine only knows generic zones, phases, actions, conditions, effects, rules and end conditions. This is the whole game.")}</p>
        </div>
        <Panel title={gameUi("Highlights")} eyebrow="Key ideas">
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-300">
            {template.highlights.map((highlight) => (
              <li key={highlight}>{gameUi(highlight)}</li>
            ))}
          </ul>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <Panel key={section.id} title={gameUi(section.title)} eyebrow={section.id === "winning" ? "Win / lose conditions" : section.id}>
              <ul className="space-y-2">
                {section.items.map((item, index) => (
                  <li key={index} className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-zinc-100">
                      {gameUi(item.label)}
                      {item.badge && <Chip>{gameUi(item.badge)}</Chip>}
                    </p>
                    <p className="mt-0.5 text-zinc-400">{gameUi(item.text)}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
        <details className="rounded-2xl border border-white/[0.08] bg-[#0d1014]/85 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-300">{gameUi("Developer: full JSON definition")}</summary>
          <pre className="mt-3 max-h-[60vh] overflow-auto text-[11px] leading-5 text-zinc-400">{gameUi(JSON.stringify(def, null, 2))}</pre>
        </details>
      </section>
    </CardBuilderLayout>
  );
}
