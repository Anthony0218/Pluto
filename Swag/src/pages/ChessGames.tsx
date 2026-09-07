import ChessBoard from "../components/ChessBoard";
import "./ChessGames.css";

export default function ChessGame() {
  return (
    <div className="chess-game-page">
      <h1>Chess Game</h1>
      <ChessBoard />
    </div>
  );
}
