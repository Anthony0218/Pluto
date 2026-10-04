import { useEffect, useState } from "react";
import type { AtlasDataset, AtlasExtras, GeographicEntity } from "./types";

type LoadState = { data: AtlasDataset | null; error: string | null; loading: boolean };
let cached: AtlasDataset | null = null;
let pending:Promise<AtlasDataset>|null=null;

export function useAtlasData(): LoadState {
  const [state, setState] = useState<LoadState>({ data: cached, error: null, loading: !cached });
  useEffect(() => {
    if (cached) { setState({data:cached,error:null,loading:false}); return; }
    let live=true;
    pending??=Promise.all([
      fetch("/data/geography/countries.json").then((response) => response.ok ? response.json() : Promise.reject(new Error("Country data could not be loaded."))),
      fetch("/data/geography/world-110m.json").then((response) => response.ok ? response.json() : Promise.reject(new Error("Map geometry could not be loaded."))),
      fetch("/data/geography/version.json").then((response) => response.ok ? response.json() : Promise.reject(new Error("Dataset version could not be loaded."))),
      fetch("/data/geography/extras.json").then((response) => response.ok ? response.json() : Promise.reject(new Error("City and summit data could not be loaded."))),
    ]).then(([countries, topology, version, extras]) => {
      cached = { countries: countries as GeographicEntity[], extras: extras as AtlasExtras, topology, version };
      return cached;
    }).finally(()=>{pending=null;});
    pending.then(data=>{if(live)setState({data,error:null,loading:false});}).catch((cause: unknown) => {
      if (live) setState({ data: null, error: cause instanceof Error ? cause.message : "Atlas data could not be loaded.", loading: false });
    });
    return () => {live=false;};
  }, []);
  return state;
}
