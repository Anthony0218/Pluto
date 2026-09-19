import VariantRulesPage, { Flow, VisualCard } from "./VariantRulesPage";
import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../games/chess/i18n/chessLanguage";

const translations: Partial<TranslationTable> = {
  de: {
    "Chess Hot Potato": "Schach Hot Potato",
    "Move it, pass it, or get caught in the blast.":
      "Bewege sie, gib sie weiter oder gerate in die Explosion.",
    "Back to Hot Potato": "Zurück zu Hot Potato",
    "Play Chess Hot Potato": "Schach Hot Potato spielen",
    "A random non-King piece carries a bomb with a hidden random fuse of 4–12 completed plies. The bomb follows its carrier, transfers to a capturing piece, and eventually destroys the carrier square plus all adjacent squares.":
      "Eine zufällige Nicht-Königsfigur trägt eine Bombe mit einer zufälligen Zündzeit von 4–12 Halbzügen. Die Bombe folgt dem Träger, springt bei einer Schlagaktion auf den Schläger über und zerstört schließlich das Trägerfeld samt Nachbarfeldern.",
    "Random carrier": "Zufälliger Träger",
    "Each new potato is assigned to a random non-King piece.":
      "Jede neue Bombe wird einer zufälligen Nicht-Königsfigur zugewiesen.",
    "Random 4–12 fuse": "Zufällige Zündzeit 4–12",
    "Every new potato receives its own random countdown.":
      "Jede neue Bombe bekommt einen eigenen zufälligen Countdown.",
    "3×3 blast": "3×3-Explosion",
    "The carrier square and up to eight adjacent squares are destroyed.":
      "Das Trägerfeld und bis zu acht Nachbarfelder werden zerstört.",
    "A random non-King piece starts with the potato":
      "Eine zufällige Nicht-Königsfigur startet mit der Bombe",
    "At the beginning of the game, one non-King piece is selected as the first carrier.":
      "Zu Beginn wird eine Nicht-Königsfigur als erster Träger gewählt.",
    "Every potato gets a random fuse":
      "Jede Bombe bekommt eine zufällige Zündzeit",
    "A newly created potato receives a random countdown between 4 and 12 completed plies. The countdown decreases after each completed player move.":
      "Eine neue Bombe erhält einen Countdown zwischen 4 und 12 Halbzügen. Nach jedem abgeschlossenen Zug sinkt er um eins.",
    "The potato follows its carrier": "Die Bombe folgt ihrem Träger",
    "If the carrier moves normally, the bomb moves with that piece to its new square.":
      "Zieht der Träger normal, wandert die Bombe mit auf sein neues Feld.",
    "Capture the carrier to inherit the bomb":
      "Schlage den Träger und übernimm die Bombe",
    "If the carrier is captured, the capturing piece becomes the new carrier immediately. The same fuse continues counting down.":
      "Wird der Träger geschlagen, übernimmt die schlagende Figur sofort die Bombe. Derselbe Countdown läuft weiter.",
    "The explosion covers a 3×3 area": "Die Explosion umfasst ein 3×3-Gebiet",
    "When the fuse reaches zero, the carrier square and every valid adjacent square explode. Non-King pieces inside the blast are destroyed.":
      "Bei null explodieren das Trägerfeld und alle gültigen Nachbarfelder. Nicht-Königsfiguren im Bereich werden zerstört.",
    "A King in the blast loses the game": "Ein König in der Explosion verliert",
    "If exactly one King is inside the explosion radius, that side loses immediately.":
      "Befindet sich genau ein König im Explosionsradius, verliert diese Seite sofort.",
    "Both Kings in the blast means a draw":
      "Beide Könige in der Explosion bedeuten Remis",
    "If both Kings are caught in the same explosion, the game ends as a draw.":
      "Werden beide Könige von derselben Explosion getroffen, endet die Partie remis.",
    "Five-ply cooldown after every explosion":
      "Fünf Halbzüge Abkühlzeit nach jeder Explosion",
    "After a non-terminal explosion, five completed plies pass with no active potato. Then a new random non-King carrier receives a fresh random fuse.":
      "Nach einer nicht spielentscheidenden Explosion folgen fünf Halbzüge ohne Bombe. Danach erhält eine neue zufällige Nicht-Königsfigur eine frische Zufallszündzeit.",
    "Normal chess can still end the game":
      "Normales Schach kann die Partie weiterhin beenden",
    "Checkmate and the normal chess draw conditions remain active. A normal terminal result can end the game before the next explosion.":
      "Schachmatt und normale Remisbedingungen bleiben aktiv und können die Partie vor der nächsten Explosion beenden.",
    "One potato cycle": "Ein Bombenzyklus",
    "Carrier chosen": "Träger gewählt",
    "Random non-King piece.": "Zufällige Nicht-Königsfigur.",
    "Fuse counts down": "Countdown läuft",
    "Random 4–12 completed plies.": "Zufällige 4–12 Halbzüge.",
    Explosion: "Explosion",
    "Carrier square + adjacent 8 squares.": "Trägerfeld + 8 Nachbarfelder.",
    Cooldown: "Abkühlzeit",
    "5 plies, then a fresh potato.": "5 Halbzüge, dann eine neue Bombe.",
  },
  bar: {
    "Back to Hot Potato": "Zruck zu Hot Potato",
    "Play Chess Hot Potato": "Schach Hot Potato spuin",
  },
  ko: {
    "Chess Hot Potato": "체스 핫 포테이토",
    "Move it, pass it, or get caught in the blast.":
      "움직이고 넘기지 않으면 폭발에 휘말립니다.",
    "Back to Hot Potato": "핫 포테이토로 돌아가기",
    "Play Chess Hot Potato": "체스 핫 포테이토 플레이",
    "A random non-King piece carries a bomb with a hidden random fuse of 4–12 completed plies. The bomb follows its carrier, transfers to a capturing piece, and eventually destroys the carrier square plus all adjacent squares.":
      "무작위 비킹 기물이 4~12 하프무브의 랜덤 타이머 폭탄을 가집니다. 폭탄은 운반자를 따라 이동하고 운반자가 잡히면 잡은 기물로 넘어가며 결국 운반 칸과 주변 칸을 폭발시킵니다.",
    "Random carrier": "무작위 운반자",
    "Each new potato is assigned to a random non-King piece.":
      "새 폭탄은 무작위 비킹 기물에 지정됩니다.",
    "Random 4–12 fuse": "랜덤 4~12 타이머",
    "Every new potato receives its own random countdown.":
      "각 새 폭탄은 독립적인 랜덤 카운트다운을 받습니다.",
    "3×3 blast": "3×3 폭발",
    "The carrier square and up to eight adjacent squares are destroyed.":
      "운반 칸과 최대 8개 인접 칸이 파괴됩니다.",
    "A random non-King piece starts with the potato":
      "무작위 비킹 기물이 폭탄을 가지고 시작",
    "At the beginning of the game, one non-King piece is selected as the first carrier.":
      "게임 시작 시 비킹 기물 하나가 첫 운반자로 선택됩니다.",
    "Every potato gets a random fuse": "모든 폭탄은 랜덤 타이머",
    "A newly created potato receives a random countdown between 4 and 12 completed plies. The countdown decreases after each completed player move.":
      "새 폭탄은 4~12 하프무브의 랜덤 카운트다운을 받으며 매 수마다 1씩 줄어듭니다.",
    "The potato follows its carrier": "폭탄은 운반자를 따라감",
    "If the carrier moves normally, the bomb moves with that piece to its new square.":
      "운반자가 움직이면 폭탄도 그 기물과 함께 이동합니다.",
    "Capture the carrier to inherit the bomb": "운반자를 잡으면 폭탄 상속",
    "If the carrier is captured, the capturing piece becomes the new carrier immediately. The same fuse continues counting down.":
      "운반자가 잡히면 잡은 기물이 즉시 새 운반자가 되고 같은 타이머가 계속됩니다.",
    "The explosion covers a 3×3 area": "폭발 범위는 3×3",
    "When the fuse reaches zero, the carrier square and every valid adjacent square explode. Non-King pieces inside the blast are destroyed.":
      "타이머가 0이 되면 운반 칸과 모든 유효 인접 칸이 폭발하며 범위 안 비킹 기물이 파괴됩니다.",
    "A King in the blast loses the game": "킹이 폭발에 맞으면 패배",
    "If exactly one King is inside the explosion radius, that side loses immediately.":
      "폭발 범위에 킹 하나만 있으면 그 진영이 즉시 패배합니다.",
    "Both Kings in the blast means a draw": "두 킹 모두 폭발하면 무승부",
    "If both Kings are caught in the same explosion, the game ends as a draw.":
      "두 킹이 같은 폭발에 맞으면 무승부입니다.",
    "Five-ply cooldown after every explosion": "폭발 후 5하프무브 쿨다운",
    "After a non-terminal explosion, five completed plies pass with no active potato. Then a new random non-King carrier receives a fresh random fuse.":
      "게임이 끝나지 않은 폭발 뒤에는 5하프무브 동안 폭탄이 없고 이후 새 무작위 비킹 운반자와 새 타이머가 생깁니다.",
    "Normal chess can still end the game": "일반 체스도 게임을 끝낼 수 있음",
    "Checkmate and the normal chess draw conditions remain active. A normal terminal result can end the game before the next explosion.":
      "체크메이트와 일반 무승부 조건은 계속 적용됩니다.",
    "One potato cycle": "폭탄 한 주기",
    "Carrier chosen": "운반자 선택",
    "Random non-King piece.": "무작위 비킹 기물.",
    "Fuse counts down": "타이머 감소",
    "Random 4–12 completed plies.": "랜덤 4~12 하프무브.",
    Explosion: "폭발",
    "Carrier square + adjacent 8 squares.": "운반 칸 + 주변 8칸.",
    Cooldown: "쿨다운",
    "5 plies, then a fresh potato.": "5하프무브 후 새 폭탄.",
  },
  ru: {
    "Chess Hot Potato": "Шахматная горячая картошка",
    "Move it, pass it, or get caught in the blast.":
      "Двигайте, передавайте или попадите под взрыв.",
    "Back to Hot Potato": "Назад к Hot Potato",
    "Play Chess Hot Potato": "Играть в Hot Potato",
    "A random non-King piece carries a bomb with a hidden random fuse of 4–12 completed plies. The bomb follows its carrier, transfers to a capturing piece, and eventually destroys the carrier square plus all adjacent squares.":
      "Случайная фигура кроме короля несёт бомбу со случайным таймером 4–12 полуходов. Бомба следует за носителем, переходит к взявшей фигуре и в итоге уничтожает поле носителя и соседние поля.",
    "Random carrier": "Случайный носитель",
    "Each new potato is assigned to a random non-King piece.":
      "Каждая новая бомба назначается случайной фигуре кроме короля.",
    "Random 4–12 fuse": "Случайный таймер 4–12",
    "Every new potato receives its own random countdown.":
      "Каждая новая бомба получает свой случайный отсчёт.",
    "3×3 blast": "Взрыв 3×3",
    "The carrier square and up to eight adjacent squares are destroyed.":
      "Поле носителя и до восьми соседних полей уничтожаются.",
    "A random non-King piece starts with the potato":
      "Случайная фигура начинает с бомбой",
    "At the beginning of the game, one non-King piece is selected as the first carrier.":
      "В начале выбирается случайный первый носитель кроме короля.",
    "Every potato gets a random fuse": "У каждой бомбы случайный таймер",
    "A newly created potato receives a random countdown between 4 and 12 completed plies. The countdown decreases after each completed player move.":
      "Новая бомба получает 4–12 полуходов, после каждого хода счётчик уменьшается.",
    "The potato follows its carrier": "Бомба следует за носителем",
    "If the carrier moves normally, the bomb moves with that piece to its new square.":
      "При обычном ходе носителя бомба перемещается вместе с ним.",
    "Capture the carrier to inherit the bomb": "Взятие носителя передаёт бомбу",
    "If the carrier is captured, the capturing piece becomes the new carrier immediately. The same fuse continues counting down.":
      "Взявшая фигура сразу становится новым носителем, а старый таймер продолжается.",
    "The explosion covers a 3×3 area": "Взрыв охватывает 3×3",
    "When the fuse reaches zero, the carrier square and every valid adjacent square explode. Non-King pieces inside the blast are destroyed.":
      "При нуле взрываются поле носителя и соседние поля; все фигуры кроме королей в зоне уничтожаются.",
    "A King in the blast loses the game": "Король во взрыве проигрывает",
    "If exactly one King is inside the explosion radius, that side loses immediately.":
      "Если во взрыве только один король, его сторона сразу проигрывает.",
    "Both Kings in the blast means a draw": "Оба короля во взрыве — ничья",
    "If both Kings are caught in the same explosion, the game ends as a draw.":
      "Если оба короля попали в один взрыв, партия заканчивается ничьей.",
    "Five-ply cooldown after every explosion": "Пять полуходов перезарядки",
    "After a non-terminal explosion, five completed plies pass with no active potato. Then a new random non-King carrier receives a fresh random fuse.":
      "После взрыва, не завершившего игру, пять полуходов нет бомбы; затем выбирается новый носитель и новый таймер.",
    "Normal chess can still end the game":
      "Обычные шахматы всё ещё могут завершить партию",
    "Checkmate and the normal chess draw conditions remain active. A normal terminal result can end the game before the next explosion.":
      "Мат и обычные условия ничьей сохраняются.",
    "One potato cycle": "Один цикл бомбы",
    "Carrier chosen": "Выбран носитель",
    "Random non-King piece.": "Случайная фигура кроме короля.",
    "Fuse counts down": "Таймер идёт",
    "Random 4–12 completed plies.": "Случайные 4–12 полуходов.",
    Explosion: "Взрыв",
    "Carrier square + adjacent 8 squares.": "Поле носителя + 8 соседних.",
    Cooldown: "Перезарядка",
    "5 plies, then a fresh potato.": "5 полуходов, затем новая бомба.",
  },
};

export default function ChessHotPotatoRules() {
  const { language, setLanguage } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);
  return (
    <VariantRulesPage
      variantLabel={t("Chess Variant")}
      title={t("Chess Hot Potato")}
      subtitle={t("Move it, pass it, or get caught in the blast.")}
      icon="💣"
      accent="orange"
      backRoute="/games/chess/variants/hot-potato/hotseat"
      backLabel={t("Back to Hot Potato")}
      coreIdea={t(
        "A random non-King piece carries a bomb with a hidden random fuse of 4–12 completed plies. The bomb follows its carrier, transfers to a capturing piece, and eventually destroys the carrier square plus all adjacent squares.",
      )}
      language={language}
      onLanguageChange={setLanguage}
      languageLabel={t("Language")}
      coreIdeaLabel={t("Core idea")}
      ruleLabel={t("Rule")}
      playLabel={t("Play Chess Hot Potato")}
      features={[
        {
          icon: "💣",
          title: t("Random carrier"),
          text: t("Each new potato is assigned to a random non-King piece."),
        },
        {
          icon: "⏳",
          title: t("Random 4–12 fuse"),
          text: t("Every new potato receives its own random countdown."),
        },
        {
          icon: "💥",
          title: t("3×3 blast"),
          text: t(
            "The carrier square and up to eight adjacent squares are destroyed.",
          ),
        },
      ]}
      rules={[
        {
          icon: "💣",
          title: t("A random non-King piece starts with the potato"),
          text: t(
            "At the beginning of the game, one non-King piece is selected as the first carrier.",
          ),
        },
        {
          icon: "4–12",
          title: t("Every potato gets a random fuse"),
          text: t(
            "A newly created potato receives a random countdown between 4 and 12 completed plies. The countdown decreases after each completed player move.",
          ),
        },
        {
          icon: "→",
          title: t("The potato follows its carrier"),
          text: t(
            "If the carrier moves normally, the bomb moves with that piece to its new square.",
          ),
        },
        {
          icon: "↔",
          title: t("Capture the carrier to inherit the bomb"),
          text: t(
            "If the carrier is captured, the capturing piece becomes the new carrier immediately. The same fuse continues counting down.",
          ),
        },
        {
          icon: "💥",
          title: t("The explosion covers a 3×3 area"),
          text: t(
            "When the fuse reaches zero, the carrier square and every valid adjacent square explode. Non-King pieces inside the blast are destroyed.",
          ),
        },
        {
          icon: "♔",
          title: t("A King in the blast loses the game"),
          text: t(
            "If exactly one King is inside the explosion radius, that side loses immediately.",
          ),
        },
        {
          icon: "♔♚",
          title: t("Both Kings in the blast means a draw"),
          text: t(
            "If both Kings are caught in the same explosion, the game ends as a draw.",
          ),
        },
        {
          icon: "❄",
          title: t("Five-ply cooldown after every explosion"),
          text: t(
            "After a non-terminal explosion, five completed plies pass with no active potato. Then a new random non-King carrier receives a fresh random fuse.",
          ),
        },
        {
          icon: "♟",
          title: t("Normal chess can still end the game"),
          text: t(
            "Checkmate and the normal chess draw conditions remain active. A normal terminal result can end the game before the next explosion.",
          ),
        },
      ]}
    >
      <VisualCard
        accent="orange"
        eyebrow={t("Bomb lifecycle")}
        title={t("One potato cycle")}
      >
        <Flow
          steps={[
            {
              icon: "💣",
              label: t("Carrier chosen"),
              detail: t("Random non-King piece."),
            },
            {
              icon: "⏳",
              label: t("Fuse counts down"),
              detail: t("Random 4–12 completed plies."),
            },
            {
              icon: "💥",
              label: t("Explosion"),
              detail: t("Carrier square + adjacent 8 squares."),
            },
            {
              icon: "❄",
              label: t("Cooldown"),
              detail: t("5 plies, then a fresh potato."),
            },
          ]}
        />
      </VisualCard>
    </VariantRulesPage>
  );
}
