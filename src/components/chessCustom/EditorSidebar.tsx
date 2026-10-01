import { useEditor, type EditorSection } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import { SECTION_META } from "./sectionMeta";
import ValidationPanel from "./ValidationPanel";

const GROUP_LABELS = { build: "Create", play: "Test", library: "Library" };

export default function EditorSidebar() {
  const { section, setSection, issues, variant } = useEditor();
  const errorsBySection = (id: EditorSection) => issues.filter((issue) => issue.section === id && issue.severity !== "info").length;
  const counts: Partial<Record<EditorSection, number>> = {
    pieces: variant.pieces.length,
    events: variant.events.length,
    victory: variant.victoryConditions.filter((condition) => condition.enabled).length,
  };

  return (
    <>
      {/* Mobile / tablet: a scrollable tab strip. */}
      <nav aria-label={ui("Editor sections")} className="sticky top-0 z-30 -mx-4 overflow-x-auto border-b border-white/[0.06] bg-[#07090b]/95 px-4 py-2 backdrop-blur lg:hidden">
        <div className="flex w-max gap-1.5">
          {SECTION_META.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${section === id ? "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/40" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"}`}
            >
              <Icon size={14} />
              {ui(label)}
              {errorsBySection(id) > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
            </button>
          ))}
        </div>
      </nav>

      <aside className="sticky top-[73px] hidden max-h-[calc(var(--app-height)-90px)] flex-col gap-4 overflow-y-auto pb-6 lg:flex">
        {(["build", "play", "library"] as const).map((group) => (
          <nav key={group} aria-label={ui(GROUP_LABELS[group])}>
            <p className="mb-1.5 px-3 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-600">{ui(GROUP_LABELS[group])}</p>
            <ul className="space-y-0.5">
              {SECTION_META.filter((entry) => entry.group === group).map(({ id, label, icon: Icon }) => {
                const active = section === id;
                const problems = errorsBySection(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => setSection(id)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                        active ? "bg-gradient-to-r from-amber-300/15 to-transparent text-amber-50 shadow-[inset_2px_0_0_#fcd34d]" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-amber-300" : "text-zinc-500 group-hover:text-zinc-300"} />
                      <span className="flex-1 font-medium">{ui(label)}</span>
                      {problems > 0 ? (
                        <span title={`${problems} issue(s)`} className="rounded-full bg-amber-300/15 px-1.5 text-[10px] font-bold text-amber-200">
                          {problems}
                        </span>
                      ) : counts[id] !== undefined ? (
                        <span className="text-[10px] font-semibold text-zinc-600">{counts[id]}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}
        <ValidationPanel compact />
      </aside>
    </>
  );
}
