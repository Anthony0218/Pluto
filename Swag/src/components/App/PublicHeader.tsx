import { Gamepad2, Menu } from "lucide-react";

import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import Avatar from "../social/FriendAvatar";

export default function PublicHeader() {
  const { user } = useAuth();

  return (
    <header
      className="
        fixed inset-x-0 top-0 z-[300]
        h-16
        border-b border-white/[0.06]
        bg-[#060816]/80
        backdrop-blur-xl
      "
    >
      <div
        className="
          mx-auto flex h-full
          max-w-[1800px]
          items-center justify-between
          px-4 sm:px-6 lg:px-8
        "
      >
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/pluto-icon.png"
            alt="Pluto"
            className="h-9 w-9 rounded-xl"
          />

          <span className="text-lg font-bold tracking-tight">Pluto</span>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden items-center gap-7 md:flex">
          <HeaderLink to="/games">Games</HeaderLink>

          <HeaderLink to="/learn">Learn</HeaderLink>

          <HeaderLink to="/coach">Chess Coach</HeaderLink>

          <HeaderLink to="/friends">Community</HeaderLink>
        </nav>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/profile"
                className="
                  hidden items-center gap-2
                  rounded-xl px-2 py-1.5
                  transition
                  hover:bg-white/[0.05]
                  sm:flex
                "
              ></Link>

              <Link
                to="/dashboard"
                className="
                  hidden
                  rounded-xl
                  bg-indigo-500
                  px-4 py-2
                  text-sm font-semibold
                  text-white
                  transition
                  hover:bg-indigo-400
                  sm:block
                "
              >
                Open Pluto
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="
                  hidden
                  text-sm font-medium
                  text-zinc-400
                  transition
                  hover:text-white
                  sm:block
                "
              >
                Log in
              </Link>

              <Link
                to="/dashboard"
                className="
                  rounded-xl
                  bg-indigo-500
                  px-4 py-2
                  text-sm font-semibold
                  text-white
                  transition
                  hover:bg-indigo-400
                "
              >
                Open Pluto
              </Link>
            </>
          )}

          <button
            type="button"
            className="
              flex h-10 w-10
              items-center justify-center
              rounded-xl
              border border-white/10
              text-zinc-400
              md:hidden
            "
          >
            <Menu size={19} />
          </button>
        </div>
      </div>
    </header>
  );
}

function HeaderLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
          text-sm font-medium transition
          ${isActive ? "text-white" : "text-zinc-500 hover:text-zinc-200"}
        `
      }
    >
      {children}
    </NavLink>
  );
}
