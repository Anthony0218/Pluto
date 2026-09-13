import "./ChessBoard.css";

type PromotionBarProps = {
  onPromote: (piece: "q" | "r" | "b" | "n") => void;
};

export default function PromotionBar({ onPromote }: PromotionBarProps) {
  return (
    <div className="promotion-menu">
      <h3>Promote pawn</h3>

      <button onClick={() => onPromote("q")}>♕</button>
      <button onClick={() => onPromote("r")}>♖</button>
      <button onClick={() => onPromote("b")}>♗</button>
      <button onClick={() => onPromote("n")}>♘</button>
    </div>
  );
}
