import VariantRulesPage, { Flow, VisualCard } from "./VariantRulesPage";
import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../games/chess/i18n/chessLanguage";

const translations: Partial<TranslationTable> = {
  de: {
    "Chess Collapse": "Schach Collapse",
    "The board gets smaller while both Kings fight to survive.":
      "Das Brett wird kleiner, während beide Könige ums Überleben kämpfen.",
    "Back to Chess Collapse": "Zurück zu Chess Collapse",
    "Play Chess Collapse": "Chess Collapse spielen",
    "Outer edges of the board are warned and then permanently destroyed. Each King has 3 collapse lives, but checkmate still ends the game immediately. A King trapped on a collapsing edge with no legal adjacent escape loses the game at once.":
      "Die äußeren Ränder werden angekündigt und anschließend dauerhaft zerstört. Jeder König hat 3 Collapse-Leben, aber Schachmatt beendet die Partie sofort. Ein König ohne legales benachbartes Fluchtfeld verliert sofort.",
    "3 King lives": "3 König-Leben",
    "Collapse damage removes a life. Checkmate ignores remaining lives and still wins immediately.":
      "Collapse-Schaden kostet ein Leben. Schachmatt ignoriert verbleibende Leben.",
    "4-ply warning": "Warnung über 4 Halbzüge",
    "A selected outer edge becomes a danger zone for 4 completed plies before it disappears.":
      "Ein gewählter Außenrand wird 4 Halbzüge lang zur Gefahrenzone, bevor er verschwindet.",
    "Central 4×4 survives": "Zentrales 4×4 bleibt",
    "Collapse stops once only the c3–f6 core remains.":
      "Der Einsturz stoppt, sobald nur noch c3–f6 übrig ist.",
    "Each King starts with 3 collapse lives":
      "Jeder König startet mit 3 Collapse-Leben",
    "Lives protect a King from surviving collapse impacts. They do not replace normal chess check and checkmate rules.":
      "Leben schützen nur vor Collapse-Treffern. Normale Schach- und Mattregeln bleiben bestehen.",
    "Checkmate always ends the game immediately":
      "Schachmatt beendet immer sofort",
    "If a move produces normal checkmate, the game ends at once even if the mated King still has collapse lives remaining.":
      "Normales Schachmatt beendet die Partie auch mit verbleibenden Leben sofort.",
    "The game chooses a safer outer edge":
      "Das Spiel bevorzugt einen sichereren Außenrand",
    "Collapse selection is board-aware so the opening does not immediately delete a fully packed back rank. Crowded edges are avoided while a meaningfully safer outer edge exists.":
      "Die Auswahl berücksichtigt die Brettbelegung, damit nicht sofort eine volle Grundreihe verschwindet. Stark belegte Ränder werden gemieden, solange ein deutlich sichererer Rand existiert.",
    "The danger zone lasts 4 completed plies":
      "Die Gefahrenzone dauert 4 Halbzüge",
    "Once an outer edge is selected, all squares on that edge are visibly warned. Players may still move onto or through legal warned squares during the countdown.":
      "Nach der Auswahl werden alle Felder des Randes markiert. Während des Countdowns dürfen legale Warnfelder weiterhin benutzt werden.",
    "The whole warned edge collapses": "Der gesamte gewarnte Rand stürzt ein",
    "When the countdown reaches zero, that complete outer row or file becomes permanently dead. Normal non-King pieces still standing there are destroyed.":
      "Bei null wird die komplette äußere Reihe oder Linie dauerhaft entfernt. Nicht-Königsfiguren darauf werden zerstört.",
    "A King hit by the collapse loses one life":
      "Ein getroffener König verliert ein Leben",
    "If the King is on the collapsing edge, one collapse life is removed. If lives reach zero, that side loses.":
      "Steht der König auf dem einstürzenden Rand, verliert er ein Leben. Bei null Leben verliert die Seite.",
    "Emergency escape is only one adjacent King move":
      "Notflucht nur auf ein benachbartes Feld",
    "A surviving hit King may relocate only to an adjacent surviving square that is empty and not attacked. It cannot teleport across the board.":
      "Ein überlebender König darf nur auf ein benachbartes, freies und nicht angegriffenes Feld fliehen. Kein Teleport über das Brett.",
    "A trapped King loses immediately":
      "Ein eingeschlossener König verliert sofort",
    "If a King is caught on the collapsing danger zone and has no legal adjacent surviving escape square, the game is over immediately even if that King still had extra lives.":
      "Hat ein König auf der Gefahrenzone kein legales benachbartes Fluchtfeld, ist die Partie sofort verloren, auch mit restlichen Leben.",
    "Collapse stops at c3–f6": "Collapse stoppt bei c3–f6",
    "Edges continue disappearing inward until the central 4×4 board remains. Those sixteen squares are never removed.":
      "Die Ränder verschwinden nach innen, bis das zentrale 4×4 bleibt. Diese 16 Felder werden nie entfernt.",
    "Simultaneous final destruction can draw":
      "Gleichzeitige letzte Zerstörung kann Remis sein",
    "If the same collapse removes both Kings' final collapse life at once, the result is a draw.":
      "Verlieren beide Könige beim selben Einsturz ihr letztes Leben, endet die Partie remis.",
    "What happens to an outer edge": "Was mit einem Außenrand passiert",
    "Edge selected": "Rand gewählt",
    "Safer available edge is preferred.":
      "Ein sichererer verfügbarer Rand wird bevorzugt.",
    "Danger zone": "Gefahrenzone",
    "4 completed plies to escape.": "4 Halbzüge zum Entkommen.",
    "Edge collapses": "Rand stürzt ein",
    "Pieces there are destroyed.": "Figuren dort werden zerstört.",
    "Board shrinks": "Brett schrumpft",
    "The new outer edge becomes eligible later.":
      "Der neue Außenrand kann später gewählt werden.",
  },
  bar: {
    "Back to Chess Collapse": "Zruck zu Chess Collapse",
    "Play Chess Collapse": "Chess Collapse spuin",
  },
  ko: {
    "Chess Collapse": "체스 콜랩스",
    "The board gets smaller while both Kings fight to survive.":
      "보드가 점점 줄어들며 두 킹이 생존을 위해 싸웁니다.",
    "Back to Chess Collapse": "체스 콜랩스로 돌아가기",
    "Play Chess Collapse": "체스 콜랩스 플레이",
    "Outer edges of the board are warned and then permanently destroyed. Each King has 3 collapse lives, but checkmate still ends the game immediately. A King trapped on a collapsing edge with no legal adjacent escape loses the game at once.":
      "보드 바깥 가장자리에 경고가 표시된 뒤 영구적으로 붕괴합니다. 각 킹은 붕괴 목숨 3개를 가지지만 체크메이트는 즉시 게임을 끝냅니다. 붕괴 가장자리에서 인접한 합법 탈출 칸이 없는 킹은 즉시 패배합니다.",
    "3 King lives": "킹 목숨 3개",
    "Collapse damage removes a life. Checkmate ignores remaining lives and still wins immediately.":
      "붕괴 피해는 목숨 1개를 제거하지만 체크메이트는 남은 목숨과 무관하게 즉시 승리합니다.",
    "4-ply warning": "4하프무브 경고",
    "A selected outer edge becomes a danger zone for 4 completed plies before it disappears.":
      "선택된 가장자리는 사라지기 전 4하프무브 동안 위험 구역이 됩니다.",
    "Central 4×4 survives": "중앙 4×4 생존",
    "Collapse stops once only the c3–f6 core remains.":
      "c3–f6 중앙 4×4만 남으면 붕괴가 멈춥니다.",
    "Each King starts with 3 collapse lives": "각 킹은 붕괴 목숨 3개로 시작",
    "Lives protect a King from surviving collapse impacts. They do not replace normal chess check and checkmate rules.":
      "목숨은 붕괴 충격에만 적용되며 일반 체크와 체크메이트 규칙을 대체하지 않습니다.",
    "Checkmate always ends the game immediately": "체크메이트는 항상 즉시 종료",
    "If a move produces normal checkmate, the game ends at once even if the mated King still has collapse lives remaining.":
      "정상 체크메이트가 되면 붕괴 목숨이 남아 있어도 즉시 끝납니다.",
    "The game chooses a safer outer edge": "더 안전한 외곽을 우선 선택",
    "Collapse selection is board-aware so the opening does not immediately delete a fully packed back rank. Crowded edges are avoided while a meaningfully safer outer edge exists.":
      "초반에 꽉 찬 백랭크가 바로 사라지지 않도록 기물 수를 고려해 더 안전한 가장자리를 우선합니다.",
    "The danger zone lasts 4 completed plies": "위험 구역은 4하프무브 지속",
    "Once an outer edge is selected, all squares on that edge are visibly warned. Players may still move onto or through legal warned squares during the countdown.":
      "가장자리가 선택되면 전체 칸이 경고 표시되며 카운트다운 동안에도 합법적으로 이동할 수 있습니다.",
    "The whole warned edge collapses": "경고된 전체 가장자리 붕괴",
    "When the countdown reaches zero, that complete outer row or file becomes permanently dead. Normal non-King pieces still standing there are destroyed.":
      "0이 되면 해당 행 또는 파일 전체가 영구적으로 사라지고 그 위 비킹 기물이 파괴됩니다.",
    "A King hit by the collapse loses one life":
      "붕괴에 맞은 킹은 목숨 1개 감소",
    "If the King is on the collapsing edge, one collapse life is removed. If lives reach zero, that side loses.":
      "킹이 붕괴 가장자리에 있으면 목숨 1개를 잃고 0이 되면 패배합니다.",
    "Emergency escape is only one adjacent King move":
      "긴급 탈출은 인접 한 칸만",
    "A surviving hit King may relocate only to an adjacent surviving square that is empty and not attacked. It cannot teleport across the board.":
      "살아남은 킹은 비어 있고 공격받지 않는 인접 생존 칸 한 곳으로만 이동할 수 있습니다.",
    "A trapped King loses immediately": "갇힌 킹은 즉시 패배",
    "If a King is caught on the collapsing danger zone and has no legal adjacent surviving escape square, the game is over immediately even if that King still had extra lives.":
      "위험 구역에 갇힌 킹에게 합법 인접 탈출 칸이 없으면 목숨이 남아 있어도 즉시 패배합니다.",
    "Collapse stops at c3–f6": "c3–f6에서 붕괴 정지",
    "Edges continue disappearing inward until the central 4×4 board remains. Those sixteen squares are never removed.":
      "중앙 4×4만 남을 때까지 안쪽으로 붕괴하며 16칸은 제거되지 않습니다.",
    "Simultaneous final destruction can draw": "동시 최종 파괴는 무승부 가능",
    "If the same collapse removes both Kings' final collapse life at once, the result is a draw.":
      "같은 붕괴로 두 킹이 동시에 마지막 목숨을 잃으면 무승부입니다.",
    "What happens to an outer edge": "외곽 가장자리의 붕괴 과정",
    "Edge selected": "가장자리 선택",
    "Safer available edge is preferred.": "더 안전한 가장자리를 우선합니다.",
    "Danger zone": "위험 구역",
    "4 completed plies to escape.": "탈출까지 4하프무브.",
    "Edge collapses": "가장자리 붕괴",
    "Pieces there are destroyed.": "그 위 기물이 파괴됩니다.",
    "Board shrinks": "보드 축소",
    "The new outer edge becomes eligible later.":
      "새 외곽이 이후 후보가 됩니다.",
  },
  ru: {
    "Chess Collapse": "Обрушающиеся шахматы",
    "The board gets smaller while both Kings fight to survive.":
      "Доска уменьшается, пока оба короля борются за выживание.",
    "Back to Chess Collapse": "Назад к Chess Collapse",
    "Play Chess Collapse": "Играть в Chess Collapse",
    "Outer edges of the board are warned and then permanently destroyed. Each King has 3 collapse lives, but checkmate still ends the game immediately. A King trapped on a collapsing edge with no legal adjacent escape loses the game at once.":
      "Внешние края сначала предупреждаются, затем навсегда уничтожаются. У каждого короля 3 жизни от обрушения, но мат завершает игру сразу. Король без соседнего безопасного выхода на рушащемся краю проигрывает немедленно.",
    "3 King lives": "3 жизни короля",
    "Collapse damage removes a life. Checkmate ignores remaining lives and still wins immediately.":
      "Урон обрушения снимает жизнь; мат игнорирует оставшиеся жизни.",
    "4-ply warning": "Предупреждение на 4 полухода",
    "A selected outer edge becomes a danger zone for 4 completed plies before it disappears.":
      "Выбранный край становится опасной зоной на 4 полухода.",
    "Central 4×4 survives": "Центральные 4×4 остаются",
    "Collapse stops once only the c3–f6 core remains.":
      "Обрушение останавливается на ядре c3–f6.",
    "Each King starts with 3 collapse lives":
      "Каждый король начинает с 3 жизнями",
    "Lives protect a King from surviving collapse impacts. They do not replace normal chess check and checkmate rules.":
      "Жизни защищают только от обрушений и не заменяют шах и мат.",
    "Checkmate always ends the game immediately":
      "Мат всегда завершает игру сразу",
    "If a move produces normal checkmate, the game ends at once even if the mated King still has collapse lives remaining.":
      "Обычный мат завершает игру независимо от оставшихся жизней.",
    "The game chooses a safer outer edge":
      "Игра предпочитает более безопасный край",
    "Collapse selection is board-aware so the opening does not immediately delete a fully packed back rank. Crowded edges are avoided while a meaningfully safer outer edge exists.":
      "Выбор учитывает заполненность, чтобы не уничтожать сразу полную заднюю линию.",
    "The danger zone lasts 4 completed plies": "Опасная зона длится 4 полухода",
    "Once an outer edge is selected, all squares on that edge are visibly warned. Players may still move onto or through legal warned squares during the countdown.":
      "Все поля края отмечаются; до конца отсчёта по ним можно ходить легально.",
    "The whole warned edge collapses": "Весь отмеченный край рушится",
    "When the countdown reaches zero, that complete outer row or file becomes permanently dead. Normal non-King pieces still standing there are destroyed.":
      "При нуле весь внешний ряд или вертикаль исчезает, а фигуры кроме короля там уничтожаются.",
    "A King hit by the collapse loses one life": "Король теряет одну жизнь",
    "If the King is on the collapsing edge, one collapse life is removed. If lives reach zero, that side loses.":
      "Король на рушащемся краю теряет жизнь; при нуле сторона проигрывает.",
    "Emergency escape is only one adjacent King move":
      "Экстренный уход только на соседнее поле",
    "A surviving hit King may relocate only to an adjacent surviving square that is empty and not attacked. It cannot teleport across the board.":
      "Выживший король может уйти только на соседнее свободное и не атакуемое поле.",
    "A trapped King loses immediately": "Запертый король проигрывает сразу",
    "If a King is caught on the collapsing danger zone and has no legal adjacent surviving escape square, the game is over immediately even if that King still had extra lives.":
      "Если безопасного соседнего выхода нет, король проигрывает сразу даже с оставшимися жизнями.",
    "Collapse stops at c3–f6": "Обрушение останавливается на c3–f6",
    "Edges continue disappearing inward until the central 4×4 board remains. Those sixteen squares are never removed.":
      "Края исчезают до центральных 4×4; эти 16 полей не удаляются.",
    "Simultaneous final destruction can draw":
      "Одновременная гибель может дать ничью",
    "If the same collapse removes both Kings' final collapse life at once, the result is a draw.":
      "Если одно обрушение снимает последние жизни обоих королей, результат — ничья.",
    "What happens to an outer edge": "Что происходит с внешним краем",
    "Edge selected": "Край выбран",
    "Safer available edge is preferred.":
      "Предпочитается более безопасный край.",
    "Danger zone": "Опасная зона",
    "4 completed plies to escape.": "4 полухода на побег.",
    "Edge collapses": "Край рушится",
    "Pieces there are destroyed.": "Фигуры там уничтожаются.",
    "Board shrinks": "Доска уменьшается",
    "The new outer edge becomes eligible later.":
      "Новый внешний край может быть выбран позже.",
  },
};

export default function ChessCollapseRules() {
  const { language, setLanguage } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);
  return (
    <VariantRulesPage
      variantLabel={t("Chess Variant")}
      title={t("Chess Collapse")}
      subtitle={t("The board gets smaller while both Kings fight to survive.")}
      icon="⚠"
      accent="red"
      backRoute="/games/chess/variants/collapse/hotseat"
      backLabel={t("Back to Chess Collapse")}
      coreIdea={t(
        "Outer edges of the board are warned and then permanently destroyed. Each King has 3 collapse lives, but checkmate still ends the game immediately. A King trapped on a collapsing edge with no legal adjacent escape loses the game at once.",
      )}
      language={language}
      onLanguageChange={setLanguage}
      languageLabel={t("Language")}
      coreIdeaLabel={t("Core idea")}
      ruleLabel={t("Rule")}
      playLabel={t("Play Chess Collapse")}
      features={[
        {
          icon: "♥♥♥",
          title: t("3 King lives"),
          text: t(
            "Collapse damage removes a life. Checkmate ignores remaining lives and still wins immediately.",
          ),
        },
        {
          icon: "⚠",
          title: t("4-ply warning"),
          text: t(
            "A selected outer edge becomes a danger zone for 4 completed plies before it disappears.",
          ),
        },
        {
          icon: "▣",
          title: t("Central 4×4 survives"),
          text: t("Collapse stops once only the c3–f6 core remains."),
        },
      ]}
      rules={[
        {
          icon: "♥",
          title: t("Each King starts with 3 collapse lives"),
          text: t(
            "Lives protect a King from surviving collapse impacts. They do not replace normal chess check and checkmate rules.",
          ),
        },
        {
          icon: "♔",
          title: t("Checkmate always ends the game immediately"),
          text: t(
            "If a move produces normal checkmate, the game ends at once even if the mated King still has collapse lives remaining.",
          ),
        },
        {
          icon: "🎯",
          title: t("The game chooses a safer outer edge"),
          text: t(
            "Collapse selection is board-aware so the opening does not immediately delete a fully packed back rank. Crowded edges are avoided while a meaningfully safer outer edge exists.",
          ),
        },
        {
          icon: "⚠",
          title: t("The danger zone lasts 4 completed plies"),
          text: t(
            "Once an outer edge is selected, all squares on that edge are visibly warned. Players may still move onto or through legal warned squares during the countdown.",
          ),
        },
        {
          icon: "💥",
          title: t("The whole warned edge collapses"),
          text: t(
            "When the countdown reaches zero, that complete outer row or file becomes permanently dead. Normal non-King pieces still standing there are destroyed.",
          ),
        },
        {
          icon: "♥−1",
          title: t("A King hit by the collapse loses one life"),
          text: t(
            "If the King is on the collapsing edge, one collapse life is removed. If lives reach zero, that side loses.",
          ),
        },
        {
          icon: "↗",
          title: t("Emergency escape is only one adjacent King move"),
          text: t(
            "A surviving hit King may relocate only to an adjacent surviving square that is empty and not attacked. It cannot teleport across the board.",
          ),
        },
        {
          icon: "☠",
          title: t("A trapped King loses immediately"),
          text: t(
            "If a King is caught on the collapsing danger zone and has no legal adjacent surviving escape square, the game is over immediately even if that King still had extra lives.",
          ),
        },
        {
          icon: "▣",
          title: t("Collapse stops at c3–f6"),
          text: t(
            "Edges continue disappearing inward until the central 4×4 board remains. Those sixteen squares are never removed.",
          ),
        },
        {
          icon: "♔♚",
          title: t("Simultaneous final destruction can draw"),
          text: t(
            "If the same collapse removes both Kings' final collapse life at once, the result is a draw.",
          ),
        },
      ]}
    >
      <VisualCard
        accent="red"
        eyebrow={t("Collapse cycle")}
        title={t("What happens to an outer edge")}
      >
        <Flow
          steps={[
            {
              icon: "🎯",
              label: t("Edge selected"),
              detail: t("Safer available edge is preferred."),
            },
            {
              icon: "⚠",
              label: t("Danger zone"),
              detail: t("4 completed plies to escape."),
            },
            {
              icon: "💥",
              label: t("Edge collapses"),
              detail: t("Pieces there are destroyed."),
            },
            {
              icon: "▣",
              label: t("Board shrinks"),
              detail: t("The new outer edge becomes eligible later."),
            },
          ]}
        />
      </VisualCard>
    </VariantRulesPage>
  );
}
