import "./ChessBoard.css";

type EvaluationProps = {
  evaluation: number | null;
};

export default function Evaluation({ evaluation }: EvaluationProps) {
  function getEvaluationPercentage() {
    if (evaluation === null) {
      return 50;
    }

    const percentage = 50 + evaluation * 10;

    return Math.max(5, Math.min(95, percentage));
  }

  return (
    <div className="evaluation-bar">
      <div
        className="evaluation-white"
        style={{
          height: `${getEvaluationPercentage()}%`,
        }}
      />

      <div className="evaluation-black" />
    </div>
  );
}
