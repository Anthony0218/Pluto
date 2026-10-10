import { useState } from "react";

export type SchafkopfInterface = "scene" | "simple";
export type SchafkopfSimpleBackground = "felt" | "table";

export function useSchafkopfInterface() {
  const [interfaceMode, setInterfaceMode] = useState<SchafkopfInterface>(() => {
    try { return localStorage.getItem("schafkopf-interface") === "simple" ? "simple" : "scene"; }
    catch { return "scene"; }
  });
  const selectInterface = (mode: SchafkopfInterface) => {
    setInterfaceMode(mode);
    try { localStorage.setItem("schafkopf-interface", mode); }
    catch { /* Keep the selection for this session. */ }
  };
  const [simpleBackground, setSimpleBackground] = useState<SchafkopfSimpleBackground>(() => {
    try { return localStorage.getItem("schafkopf-simple-background") === "table" ? "table" : "felt"; }
    catch { return "felt"; }
  });
  const selectSimpleBackground = (background: SchafkopfSimpleBackground) => {
    setSimpleBackground(background);
    try { localStorage.setItem("schafkopf-simple-background", background); }
    catch { /* Keep the selection for this session. */ }
    selectInterface("simple");
  };
  return [interfaceMode, selectInterface, simpleBackground, selectSimpleBackground] as const;
}
