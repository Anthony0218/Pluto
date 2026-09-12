import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Outlet } from "react-router";
import SideBar from "./SideBar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950">
      {/* Menu button */}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-[200] flex h-10 w-10 items-center justify-center rounded-lg bg-white text-zinc-700 shadow-md transition hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Menu size={22} />
        </button>
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-[210] bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />

          <aside className="fixed inset-y-0 left-0 z-[220] w-64">
            <div className="relative h-full">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="absolute right-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X size={18} />
              </button>

              <SideBar />
            </div>
          </aside>
        </>
      )}

      {/* Content */}
      <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mx-auto w-full max-w-[1800px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
