import { useSearchParams } from "react-router-dom";

import Chess3DGamePage from "@/pages/Chess3DGamePage";
import {
  isChess3DDifficulty,
  type Chess3DDifficulty,
} from "@/games/chess/3d/chess3dDifficulty.ts";

export default function Chess3DAiPage() {
  const [searchParams] = useSearchParams();

  const requestedDifficulty = searchParams.get("difficulty");

  const difficulty: Chess3DDifficulty = isChess3DDifficulty(requestedDifficulty)
    ? requestedDifficulty
    : "medium";

  return <Chess3DGamePage mode="ai" difficulty={difficulty} />;
}
