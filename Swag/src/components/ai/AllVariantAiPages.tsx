import VariantAiLauncher from "./VariantAiLauncher";

import TotalChaosChess from "../TotalChaosChess";
import BossBattleBoard from "../BossBattle";
import CapitalismChessBoard from "../CapitalismChessBoard";
import ChessCollapseBoard from "../ChessCollapse";
import ChessHotPotatoBoard from "../ChessHotPotatoBoard";
import ChessRouletteBoard from "../ChessRouletteBoard";
import DraftChessBoard from "../DraftChessBoard";
import FogOfWarChessBoard from "../FogOfWarChessBoard";
import HorrorChessBoard from "../HorrorChessBoard";
import MirrorChessBoard from "../MirrorChessBoard";
import MutationChessBoard from "../MutationChessBoard";
import PortalChessBoard from "../PortalChessBoard";
import RandomStartChess from "../RandomStartChess";
import TectonicChess from "../TectonicChess";
import ThreeLivesChessBoard from "../ThreeLivesChessBoard";

export function TotalChaosAiPage() {
  return (
    <VariantAiLauncher
      title="Total Chaos Chess"
      icon="🌀"
      Board={TotalChaosChess}
    />
  );
}

export function BossBattleAiPage() {
  return (
    <VariantAiLauncher
      title="Boss Battle Chess"
      icon="♚"
      Board={BossBattleBoard}
      sideLabels={{
        white: "White Army",
        black: "Boss",
      }}
    />
  );
}

export function CapitalismAiPage() {
  return (
    <VariantAiLauncher
      title="Capitalism Chess"
      icon="🪙"
      Board={CapitalismChessBoard}
    />
  );
}

export function CollapseAiPage() {
  return (
    <VariantAiLauncher
      title="Chess Collapse"
      icon="⚠"
      Board={ChessCollapseBoard}
    />
  );
}

export function HotPotatoAiPage() {
  return (
    <VariantAiLauncher
      title="Hot Potato Chess"
      icon="💣"
      Board={ChessHotPotatoBoard}
    />
  );
}

export function RouletteAiPage() {
  return (
    <VariantAiLauncher
      title="Chess Roulette"
      icon="🎰"
      Board={ChessRouletteBoard}
    />
  );
}

export function DraftAiPage() {
  return (
    <VariantAiLauncher title="Draft Chess" icon="⚔" Board={DraftChessBoard} />
  );
}

export function FogOfWarAiPage() {
  return (
    <VariantAiLauncher
      title="Fog of War Chess"
      icon="🌫"
      Board={FogOfWarChessBoard}
    />
  );
}

export function HorrorAiPage() {
  return (
    <VariantAiLauncher title="Horror Chess" icon="☠" Board={HorrorChessBoard} />
  );
}

export function MirrorAiPage() {
  return (
    <VariantAiLauncher title="Mirror Chess" icon="◈" Board={MirrorChessBoard} />
  );
}

export function MutationAiPage() {
  return (
    <VariantAiLauncher
      title="Mutation Chess"
      icon="🧬"
      Board={MutationChessBoard}
    />
  );
}

export function PortalAiPage() {
  return (
    <VariantAiLauncher
      title="Portal Chess"
      icon="🌀"
      Board={PortalChessBoard}
    />
  );
}

export function RandomStartAiPage() {
  return (
    <VariantAiLauncher
      title="Random Start Chess"
      icon="🎲"
      Board={RandomStartChess}
    />
  );
}

export function TectonicAiPage() {
  return (
    <VariantAiLauncher title="Tectonic Chess" icon="↻" Board={TectonicChess} />
  );
}

export function ThreeLivesAiPage() {
  return (
    <VariantAiLauncher
      title="Three Lives Chess"
      icon="♥"
      Board={ThreeLivesChessBoard}
    />
  );
}
