import { useParams } from "react-router-dom";

import Battlefield from "../../components/MedievalKingdoms/Battlefield";

export default function MedievalKingdomsBattlePage() {
  const { battleId } = useParams<{
    battleId: string;
  }>();

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <Battlefield battleId={battleId ?? "falcon-bridge"} />
    </main>
  );
}
