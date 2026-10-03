import { Navigate, useParams } from "react-router-dom";
import { modeForTrial } from "../../../games/atlas/modeCatalog";

/** Atlas Trials now lives in the Atlas Arena menu; old links open the same mode there. */
export default function AtlasTrialsRedirect() {
  const { modeId } = useParams();
  const mode = modeForTrial(modeId);
  return <Navigate to={mode ? `/games/atlas-arena/solo/${mode.id}` : "/games/atlas-arena"} replace />;
}
