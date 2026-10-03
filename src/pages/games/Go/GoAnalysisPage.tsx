import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import GoGameReview from "../../../components/strategy/GoGameReview";
import { loadGoGame } from "../../../games/go/storage";

export default function GoAnalysisPage() {
  const [game] = useState(loadGoGame);
  return <main className="go-page"><header className="go-page-header"><Link to="/games/go"><ArrowLeft size={16} /> Go</Link><h1>Go analysis</h1><span>Latest completed game</span></header><GoGameReview game={game} /></main>;
}
