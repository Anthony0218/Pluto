import VariantRulesPage, { EffectGrid, VisualCard } from "./VariantRulesPage";
import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../games/chess/i18n/chessLanguage";

const translations: Partial<TranslationTable> = {
  de: {
    ChessRoulette: "ChessRoulette",
    "Visible Lucky Squares can completely change a piece's fate.":
      "Sichtbare Glücksfelder können das Schicksal einer Figur komplett verändern.",
    "Back to ChessRoulette": "Zurück zu ChessRoulette",
    "Play ChessRoulette": "ChessRoulette spielen",
    "Normal chess is interrupted by visible Lucky Squares on the middle ranks. Landing on one reveals a random effect: Destroy, Teleport, Swap or Promote. Kings are protected from Lucky Square effects.":
      "Normales Schach wird durch sichtbare Glücksfelder auf den mittleren Reihen verändert. Wer darauf landet, löst Zerstören, Teleport, Tausch oder Verwandlung aus. Könige sind vor den Effekten geschützt.",
    "Visible Lucky Squares": "Sichtbare Glücksfelder",
    "The game begins with 2 visible Lucky Squares and can spawn 2 more after each 15-move interval.":
      "Die Partie beginnt mit 2 sichtbaren Glücksfeldern. Nach jeweils 15 Zügen können 2 weitere erscheinen.",
    "Middle of the board": "Mitte des Bretts",
    "Lucky Squares spawn only on ranks 3 through 6.":
      "Glücksfelder erscheinen nur auf den Reihen 3 bis 6.",
    "Promotion roulette": "Verwandlungs-Roulette",
    "Any non-King piece can be transformed — or demoted — by drawing a mystery card.":
      "Jede Nicht-Königsfigur kann durch eine Geheimkarte verwandelt oder sogar abgewertet werden.",
    "Lucky Squares are visible": "Glücksfelder sind sichtbar",
    "Lucky Squares are shown on the board before they are triggered. Their effect stays hidden until a piece actually lands on the square.":
      "Glücksfelder sind vor der Aktivierung sichtbar. Der Effekt bleibt verborgen, bis eine Figur darauf landet.",
    "New squares appear during the game":
      "Neue Felder erscheinen während der Partie",
    "The game starts with exactly 2 Lucky Squares. Every 15 completed moves, 2 additional Lucky Squares try to spawn on eligible squares.":
      "Die Partie startet mit genau 2 Glücksfeldern. Alle 15 abgeschlossenen Züge versuchen 2 weitere auf geeigneten Feldern zu erscheinen.",
    Destroy: "Zerstören",
    "The triggering non-King piece disappears from the board.":
      "Die auslösende Nicht-Königsfigur verschwindet vom Brett.",
    Teleport: "Teleport",
    "The triggering non-King piece is moved to a random safe empty square.":
      "Die auslösende Nicht-Königsfigur wird auf ein zufälliges sicheres freies Feld versetzt.",
    Swap: "Tausch",
    "The triggering non-King piece may exchange places with a randomly selected enemy piece.":
      "Die auslösende Nicht-Königsfigur kann den Platz mit einer zufälligen gegnerischen Figur tauschen.",
    "Promote can transform any non-King piece":
      "Promote kann jede Nicht-Königsfigur verwandeln",
    "The player chooses one mystery card. The card becomes the piece's new type, so a Queen can become a Pawn just as a Pawn can become a Queen. Drawing the same type leaves the piece unchanged.":
      "Der Spieler wählt eine Geheimkarte. Sie bestimmt den neuen Figurentyp: Eine Dame kann zum Bauern werden und ein Bauer zur Dame. Derselbe Typ bedeutet keine Änderung.",
    "The King card is a prank": "Die Königskarte ist ein Streich",
    "There are no additional Kings. If the mystery card is King, the triggering non-King piece is removed instead.":
      "Es gibt keine zusätzlichen Könige. Wird König gezogen, verschwindet die auslösende Figur stattdessen.",
    "Actual Kings are immune": "Echte Könige sind immun",
    "A King may occupy or reveal a Lucky Square, but the random Lucky Square effect is not applied to the King.":
      "Ein König darf ein Glücksfeld betreten oder aufdecken, aber der Zufallseffekt wird nicht auf ihn angewendet.",
    "Triggered squares expire": "Ausgelöste Felder verschwinden",
    "A triggered Lucky Square keeps showing its revealed result through the opponent's turn, then disappears when the player who triggered it is to move again.":
      "Ein ausgelöstes Feld zeigt den Effekt noch während des gegnerischen Zuges und verschwindet, sobald der Auslöser wieder am Zug ist.",
    "Normal chess victory rules still apply":
      "Normale Siegbedingungen bleiben bestehen",
    "Checkmate still wins normally, and standard stalemate, insufficient-material, 50-move and repetition draw rules remain active.":
      "Schachmatt gewinnt weiterhin normal; Patt, Materialmangel, 50-Züge-Regel und Wiederholung bleiben gültig.",
    "Four possible effects": "Vier mögliche Effekte",
    "Your triggering piece vanishes.": "Deine auslösende Figur verschwindet.",
    "Your piece jumps to a random safe empty square.":
      "Deine Figur springt auf ein zufälliges sicheres freies Feld.",
    "Your piece exchanges places with an enemy piece.":
      "Deine Figur tauscht den Platz mit einer gegnerischen Figur.",
    Promote: "Verwandeln",
    "Choose a mystery card that replaces the piece type.":
      "Wähle eine Geheimkarte, die den Figurentyp ersetzt.",
    "Promotion card pool": "Verwandlungs-Kartenpool",
    "8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King":
      "8 Bauer · 2 Läufer · 2 Springer · 2 Türme · 1 Dame · 1 König",
  },
  bar: {
    "Back to ChessRoulette": "Zruck zu ChessRoulette",
    "Play ChessRoulette": "ChessRoulette spuin",
    Destroy: "Zerstörn",
    Swap: "Tausch",
    Promote: "Verwandeln",
    "8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King":
      "8 Bauan · 2 Läufa · 2 Springa · 2 Türm · 1 Dame · 1 Kini",
  },
  ko: {
    "Visible Lucky Squares can completely change a piece's fate.":
      "보이는 행운 칸이 기물의 운명을 완전히 바꿀 수 있습니다.",
    "Back to ChessRoulette": "ChessRoulette로 돌아가기",
    "Play ChessRoulette": "ChessRoulette 플레이",
    "Normal chess is interrupted by visible Lucky Squares on the middle ranks. Landing on one reveals a random effect: Destroy, Teleport, Swap or Promote. Kings are protected from Lucky Square effects.":
      "중앙 랭크의 보이는 행운 칸이 일반 체스에 변수를 만듭니다. 기물이 착지하면 파괴, 텔레포트, 교환, 변환 중 하나가 발동하며 실제 킹은 효과에 면역입니다.",
    "Visible Lucky Squares": "보이는 행운 칸",
    "The game begins with 2 visible Lucky Squares and can spawn 2 more after each 15-move interval.":
      "게임은 보이는 행운 칸 2개로 시작하며 15수마다 2개가 추가로 생길 수 있습니다.",
    "Middle of the board": "보드 중앙",
    "Lucky Squares spawn only on ranks 3 through 6.":
      "행운 칸은 3~6랭크에만 생성됩니다.",
    "Promotion roulette": "프로모션 룰렛",
    "Any non-King piece can be transformed — or demoted — by drawing a mystery card.":
      "킹이 아닌 모든 기물은 미스터리 카드로 변환되거나 강등될 수 있습니다.",
    "Lucky Squares are visible": "행운 칸은 미리 보임",
    "Lucky Squares are shown on the board before they are triggered. Their effect stays hidden until a piece actually lands on the square.":
      "행운 칸의 위치는 보이지만 효과는 기물이 착지할 때까지 숨겨집니다.",
    "New squares appear during the game": "게임 중 새 칸 생성",
    "The game starts with exactly 2 Lucky Squares. Every 15 completed moves, 2 additional Lucky Squares try to spawn on eligible squares.":
      "정확히 2개로 시작하며 15수마다 적합한 칸에 2개가 추가로 생성됩니다.",
    Destroy: "파괴",
    "The triggering non-King piece disappears from the board.":
      "발동시킨 비킹 기물이 보드에서 사라집니다.",
    Teleport: "텔레포트",
    "The triggering non-King piece is moved to a random safe empty square.":
      "발동시킨 기물이 무작위 안전한 빈 칸으로 이동합니다.",
    Swap: "교환",
    "The triggering non-King piece may exchange places with a randomly selected enemy piece.":
      "발동시킨 기물이 무작위 상대 기물과 자리를 바꿀 수 있습니다.",
    "Promote can transform any non-King piece":
      "Promote는 모든 비킹 기물을 변환",
    "The player chooses one mystery card. The card becomes the piece's new type, so a Queen can become a Pawn just as a Pawn can become a Queen. Drawing the same type leaves the piece unchanged.":
      "미스터리 카드 한 장이 새 기물 종류를 정합니다. 퀸이 폰이 될 수도, 폰이 퀸이 될 수도 있으며 같은 종류면 변화가 없습니다.",
    "The King card is a prank": "킹 카드는 장난 카드",
    "There are no additional Kings. If the mystery card is King, the triggering non-King piece is removed instead.":
      "추가 킹은 없습니다. 킹 카드를 뽑으면 발동 기물이 제거됩니다.",
    "Actual Kings are immune": "실제 킹은 면역",
    "A King may occupy or reveal a Lucky Square, but the random Lucky Square effect is not applied to the King.":
      "킹이 행운 칸을 밟거나 공개할 수는 있지만 랜덤 효과는 적용되지 않습니다.",
    "Triggered squares expire": "발동한 칸은 사라짐",
    "A triggered Lucky Square keeps showing its revealed result through the opponent's turn, then disappears when the player who triggered it is to move again.":
      "발동 결과는 상대 차례 동안 표시되고 발동한 플레이어 차례가 다시 오면 사라집니다.",
    "Normal chess victory rules still apply": "일반 체스 승리 규칙 유지",
    "Checkmate still wins normally, and standard stalemate, insufficient-material, 50-move and repetition draw rules remain active.":
      "체크메이트는 그대로 승리하며 스테일메이트, 기물 부족, 50수, 반복 무승부 규칙도 유지됩니다.",
    "Four possible effects": "네 가지 가능한 효과",
    "Your triggering piece vanishes.": "발동 기물이 사라집니다.",
    "Your piece jumps to a random safe empty square.":
      "기물이 무작위 안전한 빈 칸으로 이동합니다.",
    "Your piece exchanges places with an enemy piece.":
      "기물이 상대 기물과 자리를 바꿉니다.",
    Promote: "변환",
    "Choose a mystery card that replaces the piece type.":
      "기물 종류를 바꾸는 미스터리 카드를 선택합니다.",
    "Promotion card pool": "프로모션 카드 풀",
    "8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King":
      "폰 8 · 비숍 2 · 나이트 2 · 룩 2 · 퀸 1 · 킹 1",
  },
  ru: {
    "Visible Lucky Squares can completely change a piece's fate.":
      "Видимые счастливые поля могут полностью изменить судьбу фигуры.",
    "Back to ChessRoulette": "Назад к ChessRoulette",
    "Play ChessRoulette": "Играть в ChessRoulette",
    "Normal chess is interrupted by visible Lucky Squares on the middle ranks. Landing on one reveals a random effect: Destroy, Teleport, Swap or Promote. Kings are protected from Lucky Square effects.":
      "Обычные шахматы меняются из-за видимых счастливых полей в центре доски. Попадание на поле вызывает случайный эффект: уничтожение, телепорт, обмен или превращение. Короли защищены от эффектов.",
    "Visible Lucky Squares": "Видимые счастливые поля",
    "The game begins with 2 visible Lucky Squares and can spawn 2 more after each 15-move interval.":
      "Игра начинается с 2 полей; каждые 15 ходов могут появиться ещё 2.",
    "Middle of the board": "Середина доски",
    "Lucky Squares spawn only on ranks 3 through 6.":
      "Поля появляются только на рядах 3–6.",
    "Promotion roulette": "Рулетка превращения",
    "Any non-King piece can be transformed — or demoted — by drawing a mystery card.":
      "Любая фигура кроме короля может превратиться или понизиться после выбора карты.",
    "Lucky Squares are visible": "Счастливые поля видимы",
    "Lucky Squares are shown on the board before they are triggered. Their effect stays hidden until a piece actually lands on the square.":
      "Поля видны заранее, но их эффект скрыт до попадания фигуры.",
    "New squares appear during the game": "Новые поля появляются по ходу игры",
    "The game starts with exactly 2 Lucky Squares. Every 15 completed moves, 2 additional Lucky Squares try to spawn on eligible squares.":
      "Игра начинается ровно с 2 полей; каждые 15 завершённых ходов появляются ещё 2 подходящих поля.",
    Destroy: "Уничтожить",
    "The triggering non-King piece disappears from the board.":
      "Фигура, вызвавшая эффект, исчезает.",
    Teleport: "Телепорт",
    "The triggering non-King piece is moved to a random safe empty square.":
      "Фигура переносится на случайное безопасное пустое поле.",
    Swap: "Обмен",
    "The triggering non-King piece may exchange places with a randomly selected enemy piece.":
      "Фигура может поменяться местами со случайной фигурой соперника.",
    "Promote can transform any non-King piece":
      "Promote меняет любую фигуру кроме короля",
    "The player chooses one mystery card. The card becomes the piece's new type, so a Queen can become a Pawn just as a Pawn can become a Queen. Drawing the same type leaves the piece unchanged.":
      "Игрок выбирает карту, которая задаёт новый тип фигуры. Ферзь может стать пешкой, а пешка ферзём. Тот же тип означает отсутствие изменений.",
    "The King card is a prank": "Карта короля — ловушка",
    "There are no additional Kings. If the mystery card is King, the triggering non-King piece is removed instead.":
      "Дополнительных королей нет. Если выпал король, активировавшая фигура удаляется.",
    "Actual Kings are immune": "Настоящие короли невосприимчивы",
    "A King may occupy or reveal a Lucky Square, but the random Lucky Square effect is not applied to the King.":
      "Король может открыть поле, но случайный эффект на него не действует.",
    "Triggered squares expire": "Сработавшие поля исчезают",
    "A triggered Lucky Square keeps showing its revealed result through the opponent's turn, then disappears when the player who triggered it is to move again.":
      "Результат остаётся виден на ход соперника, затем поле исчезает, когда очередь снова доходит до активировавшего игрока.",
    "Normal chess victory rules still apply":
      "Обычные условия победы сохраняются",
    "Checkmate still wins normally, and standard stalemate, insufficient-material, 50-move and repetition draw rules remain active.":
      "Мат по-прежнему выигрывает; пат, недостаток материала, правило 50 ходов и повторение остаются в силе.",
    "Four possible effects": "Четыре возможных эффекта",
    "Your triggering piece vanishes.": "Активировавшая фигура исчезает.",
    "Your piece jumps to a random safe empty square.":
      "Фигура перемещается на случайное безопасное пустое поле.",
    "Your piece exchanges places with an enemy piece.":
      "Фигура меняется местами с фигурой соперника.",
    Promote: "Превращение",
    "Choose a mystery card that replaces the piece type.":
      "Выберите карту, заменяющую тип фигуры.",
    "Promotion card pool": "Набор карт превращения",
    "8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King":
      "8 пешек · 2 слона · 2 коня · 2 ладьи · 1 ферзь · 1 король",
  },
};

export default function ChessRouletteRules() {
  const { language, setLanguage } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);

  return (
    <VariantRulesPage
      variantLabel={t("Chess Variant")}
      title={t("ChessRoulette")}
      subtitle={t(
        "Visible Lucky Squares can completely change a piece's fate.",
      )}
      icon="🎰"
      accent="fuchsia"
      backRoute="/games/chess/variants/chess-roulette/hotseat"
      backLabel={t("Back to ChessRoulette")}
      coreIdea={t(
        "Normal chess is interrupted by visible Lucky Squares on the middle ranks. Landing on one reveals a random effect: Destroy, Teleport, Swap or Promote. Kings are protected from Lucky Square effects.",
      )}
      language={language}
      onLanguageChange={setLanguage}
      languageLabel={t("Language")}
      coreIdeaLabel={t("Core idea")}
      ruleLabel={t("Rule")}
      playLabel={t("Play ChessRoulette")}
      features={[
        {
          icon: "?",
          title: t("Visible Lucky Squares"),
          text: t(
            "The game begins with 2 visible Lucky Squares and can spawn 2 more after each 15-move interval.",
          ),
        },
        {
          icon: "▦",
          title: t("Middle of the board"),
          text: t("Lucky Squares spawn only on ranks 3 through 6."),
        },
        {
          icon: "🎴",
          title: t("Promotion roulette"),
          text: t(
            "Any non-King piece can be transformed — or demoted — by drawing a mystery card.",
          ),
        },
      ]}
      rules={[
        {
          icon: "?",
          title: t("Lucky Squares are visible"),
          text: t(
            "Lucky Squares are shown on the board before they are triggered. Their effect stays hidden until a piece actually lands on the square.",
          ),
        },
        {
          icon: "15",
          title: t("New squares appear during the game"),
          text: t(
            "The game starts with exactly 2 Lucky Squares. Every 15 completed moves, 2 additional Lucky Squares try to spawn on eligible squares.",
          ),
        },
        {
          icon: "💥",
          title: t("Destroy"),
          text: t("The triggering non-King piece disappears from the board."),
        },
        {
          icon: "🌀",
          title: t("Teleport"),
          text: t(
            "The triggering non-King piece is moved to a random safe empty square.",
          ),
        },
        {
          icon: "🔄",
          title: t("Swap"),
          text: t(
            "The triggering non-King piece may exchange places with a randomly selected enemy piece.",
          ),
        },
        {
          icon: "🎴",
          title: t("Promote can transform any non-King piece"),
          text: t(
            "The player chooses one mystery card. The card becomes the piece's new type, so a Queen can become a Pawn just as a Pawn can become a Queen. Drawing the same type leaves the piece unchanged.",
          ),
        },
        {
          icon: "♔",
          title: t("The King card is a prank"),
          text: t(
            "There are no additional Kings. If the mystery card is King, the triggering non-King piece is removed instead.",
          ),
        },
        {
          icon: "♚",
          title: t("Actual Kings are immune"),
          text: t(
            "A King may occupy or reveal a Lucky Square, but the random Lucky Square effect is not applied to the King.",
          ),
        },
        {
          icon: "⌛",
          title: t("Triggered squares expire"),
          text: t(
            "A triggered Lucky Square keeps showing its revealed result through the opponent's turn, then disappears when the player who triggered it is to move again.",
          ),
        },
        {
          icon: "♟",
          title: t("Normal chess victory rules still apply"),
          text: t(
            "Checkmate still wins normally, and standard stalemate, insufficient-material, 50-move and repetition draw rules remain active.",
          ),
        },
      ]}
    >
      <VisualCard
        accent="fuchsia"
        eyebrow={t("Lucky Square outcomes")}
        title={t("Four possible effects")}
      >
        <EffectGrid
          items={[
            {
              icon: "💥",
              title: t("Destroy"),
              text: t("Your triggering piece vanishes."),
            },
            {
              icon: "🌀",
              title: t("Teleport"),
              text: t("Your piece jumps to a random safe empty square."),
            },
            {
              icon: "🔄",
              title: t("Swap"),
              text: t("Your piece exchanges places with an enemy piece."),
            },
            {
              icon: "🎴",
              title: t("Promote"),
              text: t("Choose a mystery card that replaces the piece type."),
            },
          ]}
        />
        <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
          <p className="text-xs font-black text-amber-200">
            {t("Promotion card pool")}
          </p>
          <p className="mt-2 text-sm font-bold text-zinc-300">
            {t("8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King")}
          </p>
        </div>
      </VisualCard>
    </VariantRulesPage>
  );
}
