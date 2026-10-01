import { Plus, Zap } from "lucide-react";
import { useState } from "react";
import { createId } from "@/games/chess/custom/engine/presets";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { newEvent } from "@/games/chess/custom/editor/eventLabels";
import { ui } from "@/i18n/ui";
import { EventCard } from "../EventBuilder";
import { Button, EmptyState, SectionHeading } from "../ui";

export default function EventsSection() {
  const { variant, dispatch, focusTarget } = useEditor();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(focusTarget ? [focusTarget] : variant.events.slice(0, 1).map((event) => event.id)));
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function add() {
    const event = newEvent();
    dispatch({ type: "addEvent", event });
    setExpanded((current) => new Set(current).add(event.id));
  }

  return (
    <div>
      <SectionHeading
        step="events"
        eyebrow="Events"
        title="When this happens…"
        description={ui("Events react to the game: WHEN something happens, optionally wait, check IF conditions hold, THEN run actions — or ELSE run others. King-capture consequences live here too.")}
        actions={
          <Button tone="primary" onClick={add}>
            <Plus size={15} />
            {ui("New event")}
          </Button>
        }
      />
      {variant.events.length === 0 ? (
        <EmptyState icon={<Zap size={20} />} title={ui("No events yet")} action={<Button tone="primary" onClick={add}>{ui("Create the first event")}</Button>}>
          {ui("Events can spawn reinforcements, transform pieces, change tiles, grant extra turns or decide the game.")}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {variant.events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              variant={variant}
              highlighted={focusTarget === event.id}
              expanded={expanded.has(event.id)}
              onToggleExpanded={() => toggle(event.id)}
              onChange={(recipe, coalesceKey) => dispatch({ type: "updateEvent", id: event.id, recipe, coalesceKey })}
              onRemove={() => dispatch({ type: "removeEvent", id: event.id })}
              onDuplicate={() => {
                const copy = { ...structuredClone(event), id: createId("event"), name: `${event.name} (copy)`, source: undefined };
                dispatch({ type: "addEvent", event: copy });
                setExpanded((current) => new Set(current).add(copy.id));
              }}
            />
          ))}
        </div>
      )}
      <p className="mt-6 text-xs leading-5 text-zinc-500">
        {ui("Safety: event chains are capped at 6 nested triggers and 200 actions per move, so a loop can never freeze a game. Advanced scripting is reserved for a future version — the variant format keeps an extensions slot for it.")}
      </p>
    </div>
  );
}
