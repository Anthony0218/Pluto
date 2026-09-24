import { Outlet } from "react-router-dom";

import PublicHeader from "./PublicHeader";
import { useTheme } from "../../context/ThemeContext";

export default function RootLayout() {
  const { plutoMode } = useTheme();

  return (
    <div
      className={`
        min-h-screen
        w-full
        text-zinc-100
        ${plutoMode ? "bg-[#060816]" : "bg-zinc-950"}
      `}
    >
      {/* GLOBAL HEADER */}
      <PublicHeader />

      {/* 
        PublicHeader is fixed and h-16 = 64px.
        Everything below therefore starts after 64px.
      */}
      <div
        className="
          min-h-[calc(100vh-4rem)]
          pt-16
        "
      >
        <Outlet />
      </div>
    </div>
  );
}
