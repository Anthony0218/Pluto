/** Elo with a 32 point provisional K for the first 20 rated games, then 20. */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function kFactor(ratedGames: number): number {
  return ratedGames < 20 ? 32 : 20;
}

export function updatedRating(rating: number, opponentRating: number, ratedGames: number, score: 0 | 0.5 | 1): number {
  return Math.max(100, Math.round(rating + kFactor(ratedGames) * (score - expectedScore(rating, opponentRating))));
}

export function ratedPair(whiteRating: number, blackRating: number, whiteGames: number, blackGames: number, result: "white" | "black" | "draw") {
  const whiteScore = result === "draw" ? 0.5 : result === "white" ? 1 : 0;
  const blackScore: 0 | 0.5 | 1 = result === "draw" ? 0.5 : result === "black" ? 1 : 0;
  return {
    white: updatedRating(whiteRating, blackRating, whiteGames, whiteScore),
    black: updatedRating(blackRating, whiteRating, blackGames, blackScore),
  };
}
