import { useEffect, useState } from "react";
import type { AtlasDataset, GeographicEntity } from "./types";

type LoadState = { data: AtlasDataset | null; error: string | null; loading: boolean };
let cached: AtlasDataset | null = null;

export function useAtlasData(): LoadState {
  const [state, setState] = useState<LoadState>({ data: cached, error: null, loading: !cached });
  useEffect(() => {
    if (cached) return;
    const controller = new AbortController();
    Promise.all([
      fetch("/data/geography/countries.json", { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Country data could not be loaded."))),
      fetch("/data/geography/world-110m.json", { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Map geometry could not be loaded."))),
      fetch("/data/geography/version.json", { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Dataset version could not be loaded."))),
    ]).then(([countries, topology, version]) => {
      cached = { countries: countries as GeographicEntity[], topology, version };
      setState({ data: cached, error: null, loading: false });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setState({ data: null, error: cause instanceof Error ? cause.message : "Atlas data could not be loaded.", loading: false });
    });
    return () => controller.abort();
  }, []);
  return state;
}
