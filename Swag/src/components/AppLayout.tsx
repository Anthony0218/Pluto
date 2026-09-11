import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Outlet } from "react-router";
import SideBar from "./SideBar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-zinc-50">
      {/* Menu button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed left-6 top-6 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-100"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />

          <aside className="fixed inset-y-0 left-0 z-50 w-64">
            <div className="relative h-full">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="absolute right-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-md hover:bg-zinc-100"
              >
                <X size={18} />
              </button>

              <SideBar />
            </div>
          </aside>
        </>
      )}

      {/* Content */}
      <div className="flex min-h-screen w-full items-center justify-center">
        <div className="w-full max-w-5xl px-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
