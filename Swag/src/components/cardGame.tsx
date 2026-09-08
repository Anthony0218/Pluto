import React from "react";

export type Card = {
	value: number;
	parameter: string;
};

type CardGameProps = {
	cards: Card[];
	onCardClick?: (card: Card) => void;
};

export default function CardGame({ cards, onCardClick }: CardGameProps) {
	return (
		<div
			className="card-game"
			style={{
				display: "grid",
				gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
				gap: "1.25rem",
				padding: "1.5rem",
				borderRadius: "24px",
				background: "linear-gradient(135deg, #f8faff, #eef2ff)",
				boxShadow: "0 20px 50px rgba(51, 65, 85, 0.12)",
			}}
		>
			{cards.map((card, index) => (
				<button
					className="card"
					key={`${card.parameter}-${index}`}
					type="button"
					onClick={() => onCardClick?.(card)}
					style={{
						display: "flex",
						minHeight: "180px",
						padding: "1.5rem",
						flexDirection: "column",
						alignItems: "flex-start",
						justifyContent: "space-between",
						border: "1px solid rgba(255, 255, 255, 0.8)",
						borderRadius: "20px",
						color: "#172554",
						background: "linear-gradient(145deg, #ffffff, #e0e7ff)",
						boxShadow: "0 10px 24px rgba(79, 70, 229, 0.12)",
						font: "inherit",
						textAlign: "left",
						cursor: "pointer",
						transition: "transform 180ms ease, box-shadow 180ms ease",
					}}
					onMouseEnter={(event) => {
						event.currentTarget.style.transform = "translateY(-6px)";
						event.currentTarget.style.boxShadow = "0 16px 30px rgba(79, 70, 229, 0.22)";
					}}
					onMouseLeave={(event) => {
						event.currentTarget.style.transform = "translateY(0)";
						event.currentTarget.style.boxShadow = "0 10px 24px rgba(79, 70, 229, 0.12)";
					}}
				>
					<span className="card-value" style={{ fontSize: "3.5rem", fontWeight: 800, lineHeight: 1 }}>
						{card.value}
					</span>
					<span
						className="card-parameter"
						style={{ color: "#4f46e5", fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
					>
						{card.parameter}
					</span>
				</button>
			))}
		</div>
	);
}
