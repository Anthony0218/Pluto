import "./ChessBoard.css";

type MoveHistoryProps = {
  moves: string[];
};

export default function MoveHistory({ moves }: MoveHistoryProps) {
  return (
    <div className="move-history">
      <h3>Moves</h3>

      {Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => {
        const whiteMove = moves[index * 2];
        const blackMove = moves[index * 2 + 1];

        return (
          <div className="move-row" key={index}>
            <span className="move-number">{index + 1}.</span>

            <span
              className={
                index * 2 === moves.length - 1 ? "current-move" : "white-move"
              }
            >
              {whiteMove}
            </span>

            <span
              className={
                index * 2 + 1 === moves.length - 1
                  ? "current-move"
                  : "black-move"
              }
            >
              {blackMove ?? ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
