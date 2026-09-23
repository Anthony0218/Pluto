import SeededVariantMultiplayerLobby from "./SeededVariantMultiplayerLobby";
import SeededVariantMultiplayerGame from "./SeededVariantMultiplayerGame";

export function RandomStartMultiplayerLobby() {
  return <SeededVariantMultiplayerLobby variant="randomstart" />;
}

export function RandomStartMultiplayerGame() {
  return <SeededVariantMultiplayerGame variant="randomstart" />;
}
