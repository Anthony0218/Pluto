export function playSound(sound: string) {
  const audio = new Audio(`/sounds/${sound}.mp3`);

  audio.play().catch(() => {});
}

export function playPieceSelectSound(piece: string) {
  switch (piece) {
    case "p":
      playSound("p-select");
      break;

    case "n":
      playSound("n-select");
      break;

    case "b":
      playSound("b-select");
      break;

    case "r":
      playSound("r-select");
      break;

    case "q":
      playSound("q-select");
      break;

    case "k":
      playSound("k-select");
      break;
  }
}

export function playPieceMoveSound(piece: string) {
  switch (piece) {
    case "p":
      playSound("p-move");
      break;

    case "n":
      playSound("n-move");
      break;

    case "b":
      playSound("b-move");
      break;

    case "r":
      playRandomSound(["r-move-1", "r-move-2"]);
      break;

    case "q":
      playSound("q-move");
      break;

    case "k":
      playSound("k-move");
      break;
  }
}

export function playPieceCaptureSound(piece: string) {
  switch (piece) {
    case "p":
      playSound("p-capture");
      break;

    case "n":
      playSound("n-capture");
      break;

    case "b":
      playSound("b-capture");
      break;

    case "r":
      playSound("r-capture");
      break;

    case "q":
      playSound("q-capture");
      break;

    case "k":
      playSound("k-capture");
      break;
  }
}
export function playRandomSound(sounds: string[]) {
  const randomIndex = Math.floor(Math.random() * sounds.length);
  const sound = sounds[randomIndex];

  const audio = new Audio(`/sounds/${sound}.mp3`);
  audio.play().catch(() => {});
}
