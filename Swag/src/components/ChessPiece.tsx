import type { CSSProperties, ReactNode } from "react";

type SquareProps = {
	color?: ChessColor;
    type?: PieceType;
};
type ChessColor = "white" | "black";
type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

const SquareStyles = (color:ChessColor, type:PieceType, ) =>
	({
		"--color": `${color}`,
		"--type": `${type}`,
	}) as CSSProperties;

const pieces: PieceType[] = [
	"king",
	"queen",
	"rook",
	"bishop",
	"knight",
	"pawn",
];

export default function ChessPiece() {
	return (
		<div className="chess-pieces" role="group" aria-label="Chess pieces">
			{(["white", "black"] as ChessColor[]).map((color) => (
				<div className={`chess-pieces__color chess-pieces__color--${color}`} key={color}>
					{pieces.map((piece) => (
						<div
							className={`chess-piece chess-piece--${color} chess-piece--${piece}`}
							data-color={color}
							data-piece={piece}
							key={`${color}-${piece}`}
							role="img"
							aria-label={`${color} ${piece}`}
						>
							{piece}
						</div>
					))}
				</div>
			))}
		</div>
	);
}
