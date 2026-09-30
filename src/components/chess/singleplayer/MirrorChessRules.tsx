import VariantRulesPage, { Flow, VisualCard } from "./VariantRulesPage";
import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../../../games/chess/i18n/chessLanguage";

const translations: Partial<TranslationTable> = {
  de: {
    "Mirror Chess": "Spiegelschach",
    "Build one army together — every placement is mirrored.":
      "Baut gemeinsam eine Armee — jede Platzierung wird gespiegelt.",
    "Back to Mirror Chess": "Zurück zu Spiegelschach",
    "Play Mirror Chess": "Spiegelschach spielen",
    "Before normal chess begins, White and Black alternate placing pieces from one shuffled standard 16-piece bag. Whenever a player places the drawn piece, the same piece is automatically created on the opponent's vertically mirrored square.":
      "Bevor normales Schach beginnt, platzieren Weiß und Schwarz abwechselnd Figuren aus einem gemischten Standardbeutel mit 16 Figuren. Jede platzierte Figur erscheint automatisch auf dem vertikal gespiegelten Feld des Gegners.",
    "Random piece bag": "Zufälliger Figurenbeutel",
    "The bag contains the normal army: 8 Pawns, 2 Knights, 2 Bishops, 2 Rooks, 1 Queen and 1 King.":
      "Der Beutel enthält die normale Armee: 8 Bauern, 2 Springer, 2 Läufer, 2 Türme, 1 Dame und 1 König.",
    "Automatic mirror": "Automatische Spiegelung",
    "A placement on a square is copied to the same file on the opposite side of the board.":
      "Eine Platzierung wird auf derselben Linie auf die Gegenseite des Bretts gespiegelt.",
    "Alternating setup": "Abwechselnder Aufbau",
    "White and Black alternate choosing where the currently drawn piece is placed.":
      "Weiß und Schwarz wählen abwechselnd das Feld für die aktuell gezogene Figur.",
    "One shuffled standard army": "Eine gemischte Standardarmee",
    "At the start of setup, the game shuffles one standard 16-piece bag. The next piece is fixed by that bag; players choose its square, not its identity.":
      "Zu Beginn wird ein Standardbeutel mit 16 Figuren gemischt. Der Beutel bestimmt die nächste Figur; die Spieler wählen nur ihr Feld.",
    "Players alternate placement turns":
      "Spieler wechseln sich beim Platzieren ab",
    "White places the first drawn piece, then Black places the next, and setup continues by alternating sides until all 16 mirrored pairs have been created.":
      "Weiß platziert die erste gezogene Figur, danach Schwarz die nächste. So geht es weiter, bis alle 16 gespiegelten Paare gesetzt sind.",
    "Use only your two setup ranks": "Nur die zwei Aufbaureihen verwenden",
    "White chooses squares on ranks 1–2. Black chooses squares on ranks 7–8. Pawns and all other non-King pieces may use either of those two setup ranks.":
      "Weiß nutzt die Reihen 1–2, Schwarz die Reihen 7–8. Bauern und alle Nicht-Königsfiguren dürfen beide Aufbaureihen verwenden.",
    "The King stays on the back rank": "Der König bleibt auf der Grundreihe",
    "The White King must be placed on rank 1 and the Black King on rank 8. While the King is still waiting in the bag, the setup logic keeps a suitable back-rank mirrored pair available.":
      "Der weiße König muss auf Reihe 1, der schwarze König auf Reihe 8 stehen. Solange der König noch im Beutel ist, bleibt ein geeignetes gespiegeltes Grundreihenpaar frei.",
    "Every placement is mirrored": "Jede Platzierung wird gespiegelt",
    "If a player places a piece on a square, the opponent receives the same piece on the vertically mirrored square. For example, d2 mirrors to d7 and f1 mirrors to f8.":
      "Platziert ein Spieler eine Figur, erhält der Gegner dieselbe Figur auf dem vertikal gespiegelten Feld. Zum Beispiel wird d2 zu d7 und f1 zu f8 gespiegelt.",
    "Complete the full formation": "Die ganze Formation fertigstellen",
    "All 16 piece pairs must be placed before the battle can begin. The finished mirrored formation is validated before the game starts.":
      "Alle 16 Figurenpaare müssen platziert sein. Vor Spielbeginn wird die fertige Spiegelstellung geprüft.",
    "Castling depends on the generated formation":
      "Rochade hängt von der erzeugten Stellung ab",
    "Normal castling rights exist only if the King and the corresponding Rook actually begin on their orthodox starting squares: e1 with a1/h1 for White or e8 with a8/h8 for Black.":
      "Rochade ist nur möglich, wenn König und entsprechender Turm tatsächlich auf ihren normalen Startfeldern stehen: e1 mit a1/h1 bzw. e8 mit a8/h8.",
    "Normal chess begins with White": "Normales Schach beginnt mit Weiß",
    "After setup is complete, White moves first and normal chess rules apply: check, checkmate, promotion, stalemate, repetition and the 50-move rule.":
      "Nach dem Aufbau beginnt Weiß. Danach gelten normale Regeln für Schach, Matt, Umwandlung, Patt, Wiederholung und die 50-Züge-Regel.",
    "Build the position together": "Baut die Stellung gemeinsam",
    "Draw piece": "Figur ziehen",
    "The shuffled bag decides the piece.":
      "Der gemischte Beutel bestimmt die Figur.",
    "Current side places": "Aktuelle Seite platziert",
    "Choose an available setup square.": "Wähle ein verfügbares Aufbaufeld.",
    "Opponent mirrors": "Gegner wird gespiegelt",
    "Same piece, vertically mirrored square.":
      "Gleiche Figur, vertikal gespiegeltes Feld.",
    "Switch sides": "Seite wechseln",
    "Continue until all 16 pairs are placed.":
      "Weiter bis alle 16 Paare gesetzt sind.",
  },
  bar: {
    "Mirror Chess": "Spiegelschach",
    "Back to Mirror Chess": "Zruck zum Spiegelschach",
    "Play Mirror Chess": "Spiegelschach spuin",
    "Build the position together": "Baut de Stellung zamm",
  },
  ko: {
    "Mirror Chess": "미러 체스",
    "Build one army together — every placement is mirrored.":
      "하나의 군대를 함께 구성하며 모든 배치는 상대편에 대칭 복제됩니다.",
    "Back to Mirror Chess": "미러 체스로 돌아가기",
    "Play Mirror Chess": "미러 체스 플레이",
    "Before normal chess begins, White and Black alternate placing pieces from one shuffled standard 16-piece bag. Whenever a player places the drawn piece, the same piece is automatically created on the opponent's vertically mirrored square.":
      "일반 체스가 시작되기 전에 백과 흑이 표준 16기물 주머니에서 나온 기물을 번갈아 배치합니다. 기물을 놓으면 같은 기물이 상대편의 세로 대칭 칸에 자동으로 생성됩니다.",
    "Random piece bag": "랜덤 기물 주머니",
    "The bag contains the normal army: 8 Pawns, 2 Knights, 2 Bishops, 2 Rooks, 1 Queen and 1 King.":
      "주머니에는 표준 군대인 폰 8, 나이트 2, 비숍 2, 룩 2, 퀸 1, 킹 1이 들어 있습니다.",
    "Automatic mirror": "자동 대칭",
    "A placement on a square is copied to the same file on the opposite side of the board.":
      "한 칸에 둔 기물은 같은 파일의 상대편 대칭 칸에 복제됩니다.",
    "Alternating setup": "교대 배치",
    "White and Black alternate choosing where the currently drawn piece is placed.":
      "백과 흑이 현재 뽑힌 기물을 놓을 칸을 번갈아 선택합니다.",
    "One shuffled standard army": "섞인 표준 군대 하나",
    "At the start of setup, the game shuffles one standard 16-piece bag. The next piece is fixed by that bag; players choose its square, not its identity.":
      "배치 시작 시 표준 16기물 주머니가 섞입니다. 다음 기물은 주머니가 정하며 플레이어는 기물 종류가 아니라 놓을 칸을 선택합니다.",
    "Players alternate placement turns": "플레이어가 번갈아 배치",
    "White places the first drawn piece, then Black places the next, and setup continues by alternating sides until all 16 mirrored pairs have been created.":
      "백이 첫 기물을 놓고 다음에는 흑이 놓습니다. 16개의 대칭 쌍이 모두 만들어질 때까지 교대합니다.",
    "Use only your two setup ranks": "각자의 두 배치 랭크만 사용",
    "White chooses squares on ranks 1–2. Black chooses squares on ranks 7–8. Pawns and all other non-King pieces may use either of those two setup ranks.":
      "백은 1–2랭크, 흑은 7–8랭크에서 선택합니다. 폰과 킹을 제외한 모든 기물은 두 배치 랭크 어디든 놓을 수 있습니다.",
    "The King stays on the back rank": "킹은 후방 랭크에 배치",
    "The White King must be placed on rank 1 and the Black King on rank 8. While the King is still waiting in the bag, the setup logic keeps a suitable back-rank mirrored pair available.":
      "백 킹은 1랭크, 흑 킹은 8랭크에 있어야 합니다. 킹이 아직 나오지 않았다면 시스템이 적절한 후방 대칭 칸을 남겨 둡니다.",
    "Every placement is mirrored": "모든 배치는 대칭 복제",
    "If a player places a piece on a square, the opponent receives the same piece on the vertically mirrored square. For example, d2 mirrors to d7 and f1 mirrors to f8.":
      "기물을 놓으면 상대는 세로 대칭 칸에 같은 기물을 받습니다. 예: d2→d7, f1→f8.",
    "Complete the full formation": "전체 배치 완성",
    "All 16 piece pairs must be placed before the battle can begin. The finished mirrored formation is validated before the game starts.":
      "16개의 기물 쌍을 모두 배치해야 게임을 시작할 수 있으며 완성된 위치를 검증합니다.",
    "Castling depends on the generated formation":
      "캐슬링은 생성된 배치에 따라 결정",
    "Normal castling rights exist only if the King and the corresponding Rook actually begin on their orthodox starting squares: e1 with a1/h1 for White or e8 with a8/h8 for Black.":
      "킹과 룩이 실제 표준 시작 칸(e1+a1/h1 또는 e8+a8/h8)에 있을 때만 캐슬링 권리가 생깁니다.",
    "Normal chess begins with White": "백부터 일반 체스 시작",
    "After setup is complete, White moves first and normal chess rules apply: check, checkmate, promotion, stalemate, repetition and the 50-move rule.":
      "배치가 끝나면 백이 먼저 두며 체크, 체크메이트, 프로모션, 스테일메이트, 반복, 50수 규칙 등 일반 체스 규칙이 적용됩니다.",
    "Build the position together": "함께 포지션 구성",
    "Draw piece": "기물 뽑기",
    "The shuffled bag decides the piece.": "섞인 주머니가 기물을 결정합니다.",
    "Current side places": "현재 진영이 배치",
    "Choose an available setup square.": "사용 가능한 배치 칸을 선택합니다.",
    "Opponent mirrors": "상대편에 대칭 복제",
    "Same piece, vertically mirrored square.":
      "같은 기물이 세로 대칭 칸에 놓입니다.",
    "Switch sides": "진영 전환",
    "Continue until all 16 pairs are placed.":
      "16개 쌍이 모두 놓일 때까지 반복합니다.",
  },
  ru: {
    "Mirror Chess": "Зеркальные шахматы",
    "Build one army together — every placement is mirrored.":
      "Создайте одну армию вместе — каждая фигура зеркально копируется.",
    "Back to Mirror Chess": "Назад к зеркальным шахматам",
    "Play Mirror Chess": "Играть в зеркальные шахматы",
    "Before normal chess begins, White and Black alternate placing pieces from one shuffled standard 16-piece bag. Whenever a player places the drawn piece, the same piece is automatically created on the opponent's vertically mirrored square.":
      "Перед обычной партией белые и чёрные по очереди расставляют фигуры из перемешанного стандартного набора из 16 фигур. Поставленная фигура автоматически появляется у соперника на вертикально зеркальном поле.",
    "Random piece bag": "Случайный набор фигур",
    "The bag contains the normal army: 8 Pawns, 2 Knights, 2 Bishops, 2 Rooks, 1 Queen and 1 King.":
      "Набор стандартный: 8 пешек, 2 коня, 2 слона, 2 ладьи, 1 ферзь и 1 король.",
    "Automatic mirror": "Автоматическое отражение",
    "A placement on a square is copied to the same file on the opposite side of the board.":
      "Фигура копируется на ту же вертикаль на противоположной стороне доски.",
    "Alternating setup": "Поочерёдная расстановка",
    "White and Black alternate choosing where the currently drawn piece is placed.":
      "Белые и чёрные по очереди выбирают поле для текущей фигуры.",
    "One shuffled standard army": "Одна перемешанная стандартная армия",
    "At the start of setup, the game shuffles one standard 16-piece bag. The next piece is fixed by that bag; players choose its square, not its identity.":
      "В начале перемешивается стандартный набор из 16 фигур. Следующую фигуру определяет набор; игрок выбирает только поле.",
    "Players alternate placement turns": "Игроки ставят фигуры по очереди",
    "White places the first drawn piece, then Black places the next, and setup continues by alternating sides until all 16 mirrored pairs have been created.":
      "Белые ставят первую фигуру, чёрные следующую. Так продолжается, пока не будут созданы все 16 зеркальных пар.",
    "Use only your two setup ranks": "Используйте только два стартовых ряда",
    "White chooses squares on ranks 1–2. Black chooses squares on ranks 7–8. Pawns and all other non-King pieces may use either of those two setup ranks.":
      "Белые используют ряды 1–2, чёрные 7–8. Пешки и все фигуры кроме короля могут стоять на любом из двух рядов.",
    "The King stays on the back rank": "Король остаётся на заднем ряду",
    "The White King must be placed on rank 1 and the Black King on rank 8. While the King is still waiting in the bag, the setup logic keeps a suitable back-rank mirrored pair available.":
      "Белый король должен быть на 1-м ряду, чёрный на 8-м. Пока король не выпал, система сохраняет подходящую зеркальную пару на заднем ряду.",
    "Every placement is mirrored": "Каждая постановка зеркальна",
    "If a player places a piece on a square, the opponent receives the same piece on the vertically mirrored square. For example, d2 mirrors to d7 and f1 mirrors to f8.":
      "Если фигура поставлена на поле, соперник получает такую же на вертикально зеркальном поле. Например, d2→d7 и f1→f8.",
    "Complete the full formation": "Завершите всю расстановку",
    "All 16 piece pairs must be placed before the battle can begin. The finished mirrored formation is validated before the game starts.":
      "До начала партии нужно поставить все 16 пар. Готовая позиция проверяется перед стартом.",
    "Castling depends on the generated formation":
      "Рокировка зависит от расстановки",
    "Normal castling rights exist only if the King and the corresponding Rook actually begin on their orthodox starting squares: e1 with a1/h1 for White or e8 with a8/h8 for Black.":
      "Рокировка доступна только если король и соответствующая ладья действительно стоят на обычных начальных полях: e1 с a1/h1 или e8 с a8/h8.",
    "Normal chess begins with White": "Обычная партия начинается ходом белых",
    "After setup is complete, White moves first and normal chess rules apply: check, checkmate, promotion, stalemate, repetition and the 50-move rule.":
      "После расстановки первыми ходят белые, далее действуют обычные правила шаха, мата, превращения, пата, повторения и 50 ходов.",
    "Build the position together": "Создайте позицию вместе",
    "Draw piece": "Выпала фигура",
    "The shuffled bag decides the piece.":
      "Фигуру определяет перемешанный набор.",
    "Current side places": "Текущая сторона ставит",
    "Choose an available setup square.": "Выберите доступное поле.",
    "Opponent mirrors": "Соперник получает отражение",
    "Same piece, vertically mirrored square.":
      "Та же фигура на зеркальном поле.",
    "Switch sides": "Смена стороны",
    "Continue until all 16 pairs are placed.": "Продолжайте до всех 16 пар.",
  },
};

export default function MirrorChessRules() {
  const { language, setLanguage } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);

  return (
    <VariantRulesPage
      variantLabel={t("Chess Variant")}
      title={t("Mirror Chess")}
      subtitle={t("Build one army together — every placement is mirrored.")}
      icon="◈"
      accent="violet"
      backRoute="/games/chess/variants/mirror/hotseat"
      backLabel={t("Back to Mirror Chess")}
      coreIdea={t(
        "Before normal chess begins, White and Black alternate placing pieces from one shuffled standard 16-piece bag. Whenever a player places the drawn piece, the same piece is automatically created on the opponent's vertically mirrored square.",
      )}
      language={language}
      onLanguageChange={setLanguage}
      languageLabel={t("Language")}
      coreIdeaLabel={t("Core idea")}
      ruleLabel={t("Rule")}
      playLabel={t("Play Mirror Chess")}
      features={[
        {
          icon: "🎲",
          title: t("Random piece bag"),
          text: t(
            "The bag contains the normal army: 8 Pawns, 2 Knights, 2 Bishops, 2 Rooks, 1 Queen and 1 King.",
          ),
        },
        {
          icon: "◈",
          title: t("Automatic mirror"),
          text: t(
            "A placement on a square is copied to the same file on the opposite side of the board.",
          ),
        },
        {
          icon: "↔",
          title: t("Alternating setup"),
          text: t(
            "White and Black alternate choosing where the currently drawn piece is placed.",
          ),
        },
      ]}
      rules={[
        {
          icon: "🎲",
          title: t("One shuffled standard army"),
          text: t(
            "At the start of setup, the game shuffles one standard 16-piece bag. The next piece is fixed by that bag; players choose its square, not its identity.",
          ),
        },
        {
          icon: "↔",
          title: t("Players alternate placement turns"),
          text: t(
            "White places the first drawn piece, then Black places the next, and setup continues by alternating sides until all 16 mirrored pairs have been created.",
          ),
        },
        {
          icon: "▦",
          title: t("Use only your two setup ranks"),
          text: t(
            "White chooses squares on ranks 1–2. Black chooses squares on ranks 7–8. Pawns and all other non-King pieces may use either of those two setup ranks.",
          ),
        },
        {
          icon: "♔",
          title: t("The King stays on the back rank"),
          text: t(
            "The White King must be placed on rank 1 and the Black King on rank 8. While the King is still waiting in the bag, the setup logic keeps a suitable back-rank mirrored pair available.",
          ),
        },
        {
          icon: "◈",
          title: t("Every placement is mirrored"),
          text: t(
            "If a player places a piece on a square, the opponent receives the same piece on the vertically mirrored square. For example, d2 mirrors to d7 and f1 mirrors to f8.",
          ),
        },
        {
          icon: "✓",
          title: t("Complete the full formation"),
          text: t(
            "All 16 piece pairs must be placed before the battle can begin. The finished mirrored formation is validated before the game starts.",
          ),
        },
        {
          icon: "♖",
          title: t("Castling depends on the generated formation"),
          text: t(
            "Normal castling rights exist only if the King and the corresponding Rook actually begin on their orthodox starting squares: e1 with a1/h1 for White or e8 with a8/h8 for Black.",
          ),
        },
        {
          icon: "♟",
          title: t("Normal chess begins with White"),
          text: t(
            "After setup is complete, White moves first and normal chess rules apply: check, checkmate, promotion, stalemate, repetition and the 50-move rule.",
          ),
        },
      ]}
    >
      <VisualCard
        accent="violet"
        eyebrow={t("Setup flow")}
        title={t("Build the position together")}
      >
        <Flow
          steps={[
            {
              icon: "🎲",
              label: t("Draw piece"),
              detail: t("The shuffled bag decides the piece."),
            },
            {
              icon: "♙",
              label: t("Current side places"),
              detail: t("Choose an available setup square."),
            },
            {
              icon: "◈",
              label: t("Opponent mirrors"),
              detail: t("Same piece, vertically mirrored square."),
            },
            {
              icon: "↔",
              label: t("Switch sides"),
              detail: t("Continue until all 16 pairs are placed."),
            },
          ]}
        />
      </VisualCard>
    </VariantRulesPage>
  );
}
