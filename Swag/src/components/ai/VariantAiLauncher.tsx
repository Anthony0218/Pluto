import { useState, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import VariantAiSettingsScreen, {
  type VariantAiStartSettings,
} from "../../games/chess/components/ai/VariantAiSettingsScreen";

import type {
  ChessPlayerColor,
  Difficulty,
} from "../../games/chess/ai/variantAi";

export type AiEnabledVariantBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

type Props = {
  title: string;
  icon?: ReactNode;
  Board: ComponentType<AiEnabledVariantBoardProps>;
};

export default function VariantAiLauncher({
  title,
  icon,
  Board,
}: Props) {
  const navigate = useNavigate();

  const [settings, setSettings] =
    useState<VariantAiStartSettings | null>(null);

  if (!settings) {
    return (
      <VariantAiSettingsScreen
        title={title}
        icon={icon}
        onBack={() => navigate(-1)}
        onStart={setSettings}
      />
    );
  }

  return (
    <Board
      aiMode
      playerColor={settings.playerColor}
      difficulty={settings.difficulty}
      onChangeSettings={() => setSettings(null)}
    />
  );
}
