import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import StrategyModeMenu from "../../../components/strategy/StrategyModeMenu";
export default function ShogiMenu() {
  useGameLanguage();
  return <StrategyModeMenu game="shogi" title={gameUi("Shogi")} mark="王" subtitle={gameUi("Japanese chess with promotion and drops: every captured piece can return to the fight.")} />;
}
