import { GEHEN_RULE, useGehenText } from "@/games/watten/useGehenText";

/** Who in the answering team has voted to give up (gehen) so far, e.g. "1/2 want to give up". */
export function GehenVotes({ names, needed }: { names: string[]; needed: number }) {
  const g = useGehenText();
  if (needed < 2) return null;
  return <div className="wt-gehen-votes" role="status">
    <div className="wt-gehen-dots" aria-hidden="true">{Array.from({ length: needed }, (_, index) => <i key={index} className={index < names.length ? "is-on" : ""} />)}</div>
    <p><strong>{g("{count}/{total} want to give up (gehen)", { count: names.length, total: needed })}</strong></p>
    {names.map(name => <p key={name}>{g("{name} wants to give up (gehen)", { name })}</p>)}
  </div>;
}

/** The voting rule, spelled out for the answering side. */
export function GehenRule({ className = "" }: { className?: string }) {
  const g = useGehenText();
  return <p className={`wt-gehen-rule ${className}`}>{g(GEHEN_RULE)}</p>;
}
