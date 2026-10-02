import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { profileNameRoute, profileRoute } from "./activity";

/** Links a player's name (or avatar) to their public profile. Renders plain content when there is no account to link. */
export default function UserLink({ userId, username, children, className = "" }: {
  userId?: string | null;
  /** Used when only a display name is known, e.g. authored built-in variants. */
  username?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const to = userId ? profileRoute(userId) : username ? profileNameRoute(username) : null;
  if (!to) return <span className={className}>{children}</span>;
  // Cards and rows around the link often handle clicks themselves.
  const stop = (event: MouseEvent) => event.stopPropagation();
  return (
    <Link to={to} onClick={stop} className={`underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-amber-300 ${className}`}>
      {children}
    </Link>
  );
}
