import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import StrategyModeMenu from "../../../components/strategy/StrategyModeMenu";
export default function GoMenu() {
  useGameLanguage();
  return <StrategyModeMenu game="go" title={gameUi("Go")} mark="●" subtitle={gameUi("Surround territory, capture stones, and balance influence in the ancient strategy game.")} />;
}
