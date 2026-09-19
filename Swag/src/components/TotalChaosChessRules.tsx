import VariantRulesPage, {
  EffectGrid,
  Flow,
  VisualCard,
} from "./VariantRulesPage";

import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../games/chess/i18n/chessLanguage";

const translations: TranslationTable = {
  de: {
    "Total Chaos Chess": "Total-Chaos-Schach",
    "Nothing starts where it should": "Nichts beginnt dort, wo es sollte",
    "Back to Total Chaos": "Zurück zu Total Chaos",
    "Play Total Chaos Chess": "Total-Chaos-Schach spielen",
    "Every standard piece is scattered onto a random square before move one. The game keeps normal material, but throws away normal starting geometry.":
      "Jede Standardfigur wird vor dem ersten Zug auf ein zufälliges Feld verteilt. Das normale Material bleibt erhalten, die normale Startgeometrie verschwindet.",
    "32 standard pieces": "32 Standardfiguren",
    "Both sides keep the normal King, Queen, Rooks, Bishops, Knights and eight Pawns.":
      "Beide Seiten behalten König, Dame, Türme, Läufer, Springer und acht Bauern.",
    "Whole-board placement": "Ganzbrett-Platzierung",
    "Kings and non-Pawn pieces may begin anywhere on the 8×8 board.":
      "Könige und Nicht-Bauern dürfen überall auf dem 8×8-Brett beginnen.",
    "Playable chaos": "Spielbares Chaos",
    "The generator rejects immediate King attacks and frozen starting positions.":
      "Der Generator verwirft sofortige Königsangriffe und eingefrorene Startstellungen.",
    "Standard material, random geometry":
      "Normales Material, zufällige Geometrie",
    "Every game uses exactly the ordinary 16 White and 16 Black pieces. Only their starting squares change.":
      "Jede Partie verwendet exakt die normalen 16 weißen und 16 schwarzen Figuren. Nur ihre Startfelder ändern sich.",
    "Both Kings must begin safe": "Beide Könige müssen sicher beginnen",
    "The Kings are never adjacent and neither King may already be in check before White's first move.":
      "Die Könige stehen nie direkt nebeneinander und keiner darf vor dem ersten weißen Zug bereits im Schach stehen.",
    "Pawns avoid the promotion ranks": "Bauern meiden die Umwandlungsreihen",
    "Pawns are randomized across ranks 2 through 7. They never begin already sitting on rank 1 or rank 8.":
      "Bauern werden über die Reihen 2 bis 7 verteilt. Sie beginnen nie bereits auf Reihe 1 oder 8.",
    "White always moves first": "Weiß zieht immer zuerst",
    "The position is generated as a new starting position and White receives move one.":
      "Die Stellung wird als neue Startstellung erzeugt und Weiß erhält den ersten Zug.",
    "There is no castling": "Es gibt keine Rochade",
    "Because King and Rook home squares are no longer meaningful, both sides begin with no castling rights.":
      "Da die Heimatfelder von König und Turm keine verlässliche Bedeutung mehr haben, beginnt keine Seite mit Rochaderechten.",
    "After setup, play normal chess": "Nach der Aufstellung normales Schach",
    "Movement, captures, check, checkmate, promotion, stalemate, repetition and the 50-move rule work normally.":
      "Züge, Schlagen, Schach, Schachmatt, Umwandlung, Patt, Wiederholung und 50-Züge-Regel funktionieren normal.",
    "Generate a fresh board whenever you want":
      "Jederzeit ein neues Brett erzeugen",
    "New Chaos creates a completely new playable random position and resets the game history.":
      "Neues Chaos erzeugt eine völlig neue spielbare Zufallsstellung und setzt den Partieverlauf zurück.",
    "What changes": "Was sich ändert",
    "Opening theory disappears": "Eröffnungstheorie verschwindet",
    "There is no reliable e4, Sicilian, Queen's Gambit or prepared opening tree.":
      "Es gibt kein verlässliches e4, Sizilianisch, Damengambit oder vorbereiteten Eröffnungsbaum.",
    "Immediate tactics appear": "Sofortige Taktik entsteht",
    "Queens, Rooks and Bishops can begin with unusual long-range pressure from move one.":
      "Damen, Türme und Läufer können ab Zug eins ungewöhnlichen Fernangriff erzeugen.",
    "Pawn structure becomes alien": "Die Bauernstruktur wird fremd",
    "Connected, isolated and advanced Pawns are created before anyone makes a move.":
      "Verbundene, isolierte und weit vorgerückte Bauern entstehen schon vor dem ersten Zug.",
    "King safety starts as a puzzle": "Königssicherheit beginnt als Rätsel",
    "Your first strategic problem is understanding the position you were given.":
      "Das erste strategische Problem ist, die zufällig erhaltene Stellung überhaupt zu verstehen.",
    "One Total Chaos game": "Eine Total-Chaos-Partie",
    Generate: "Erzeugen",
    "32 pieces are scattered": "32 Figuren werden verteilt",
    Validate: "Prüfen",
    "Both Kings must be safe": "Beide Könige müssen sicher sein",
    "White moves": "Weiß zieht",
    "Normal chess begins": "Normales Schach beginnt",
    Adapt: "Anpassen",
    "No opening book can save you": "Kein Eröffnungsbuch kann dich retten",
  },
  bar: {
    "Total Chaos Chess": "Total-Chaos-Schach",
    "Nothing starts where it should": "Nix fangt do o, wo's sollt",
    "Back to Total Chaos": "Zruck zum Total Chaos",
    "Play Total Chaos Chess": "Total Chaos spuin",
    "Whole-board placement": "Ganzbrett-Aufstellung",
    "Playable chaos": "Spielbars Chaos",
  },
  ko: {
    "Total Chaos Chess": "토탈 카오스 체스",
    "Nothing starts where it should":
      "아무 기물도 원래 자리에서 시작하지 않습니다",
    "Back to Total Chaos": "토탈 카오스로 돌아가기",
    "Play Total Chaos Chess": "토탈 카오스 체스 플레이",
    "Every standard piece is scattered onto a random square before move one. The game keeps normal material, but throws away normal starting geometry.":
      "첫 수 전에 모든 표준 기물이 무작위 칸으로 흩어집니다. 기물 구성은 정상 체스와 같지만 시작 배치의 기하는 완전히 사라집니다.",
    "32 standard pieces": "표준 기물 32개",
    "Both sides keep the normal King, Queen, Rooks, Bishops, Knights and eight Pawns.":
      "양쪽 모두 정상적인 킹, 퀸, 룩, 비숍, 나이트와 폰 8개를 그대로 가집니다.",
    "Whole-board placement": "전체 보드 배치",
    "Kings and non-Pawn pieces may begin anywhere on the 8×8 board.":
      "킹과 폰이 아닌 기물은 8×8 보드 어디에서든 시작할 수 있습니다.",
    "Playable chaos": "플레이 가능한 혼돈",
    "The generator rejects immediate King attacks and frozen starting positions.":
      "생성기는 시작부터 킹이 공격받거나 움직일 수 없는 배치를 제외합니다.",
    "Standard material, random geometry": "표준 기물, 랜덤 기하",
    "Every game uses exactly the ordinary 16 White and 16 Black pieces. Only their starting squares change.":
      "모든 게임은 정확히 일반 백 16개와 흑 16개 기물을 사용하며 시작 칸만 달라집니다.",
    "Both Kings must begin safe": "두 킹은 안전하게 시작",
    "The Kings are never adjacent and neither King may already be in check before White's first move.":
      "두 킹은 서로 인접하지 않으며 백의 첫 수 전에 어느 킹도 체크 상태가 아닙니다.",
    "Pawns avoid the promotion ranks": "폰은 승격 랭크에서 시작하지 않음",
    "Pawns are randomized across ranks 2 through 7. They never begin already sitting on rank 1 or rank 8.":
      "폰은 2랭크부터 7랭크 사이에 무작위 배치되며 1랭크나 8랭크에서 시작하지 않습니다.",
    "White always moves first": "백이 항상 먼저 둠",
    "The position is generated as a new starting position and White receives move one.":
      "새 시작 포지션이 생성되고 백이 첫 수를 둡니다.",
    "There is no castling": "캐슬링 없음",
    "Because King and Rook home squares are no longer meaningful, both sides begin with no castling rights.":
      "킹과 룩의 원래 시작 칸이 의미가 없으므로 양쪽 모두 캐슬링 권리 없이 시작합니다.",
    "After setup, play normal chess": "배치 후 일반 체스",
    "Movement, captures, check, checkmate, promotion, stalemate, repetition and the 50-move rule work normally.":
      "이동, 잡기, 체크, 체크메이트, 승격, 스테일메이트, 반복, 50수 규칙은 정상적으로 적용됩니다.",
    "Generate a fresh board whenever you want": "언제든 새 보드 생성",
    "New Chaos creates a completely new playable random position and resets the game history.":
      "새 카오스는 완전히 새로운 플레이 가능한 랜덤 포지션을 만들고 기록을 초기화합니다.",
    "What changes": "무엇이 달라지는가",
    "Opening theory disappears": "오프닝 이론 소멸",
    "There is no reliable e4, Sicilian, Queen's Gambit or prepared opening tree.":
      "e4, 시실리안, 퀸스 갬빗 같은 준비된 오프닝 트리가 더 이상 의미가 없습니다.",
    "Immediate tactics appear": "즉각적인 전술 등장",
    "Queens, Rooks and Bishops can begin with unusual long-range pressure from move one.":
      "퀸, 룩, 비숍이 첫 수부터 비정상적인 장거리 압박을 만들 수 있습니다.",
    "Pawn structure becomes alien": "폰 구조가 완전히 달라짐",
    "Connected, isolated and advanced Pawns are created before anyone makes a move.":
      "누구도 수를 두기 전에 연결 폰, 고립 폰, 전진 폰이 이미 만들어질 수 있습니다.",
    "King safety starts as a puzzle": "킹 안전이 처음부터 퍼즐",
    "Your first strategic problem is understanding the position you were given.":
      "첫 전략 과제는 주어진 포지션 자체를 이해하는 것입니다.",
    "One Total Chaos game": "토탈 카오스 한 게임",
    Generate: "생성",
    "32 pieces are scattered": "32개 기물이 흩어짐",
    Validate: "검증",
    "Both Kings must be safe": "두 킹 모두 안전",
    "White moves": "백 첫 수",
    "Normal chess begins": "일반 체스 시작",
    Adapt: "적응",
    "No opening book can save you": "오프닝 책은 도움이 되지 않음",
  },
  ru: {
    "Total Chaos Chess": "Шахматы «Полный хаос»",
    "Nothing starts where it should": "Ничто не начинает там, где должно",
    "Back to Total Chaos": "Назад к Полному хаосу",
    "Play Total Chaos Chess": "Играть в Полный хаос",
    "Every standard piece is scattered onto a random square before move one. The game keeps normal material, but throws away normal starting geometry.":
      "Перед первым ходом все стандартные фигуры разбрасываются по случайным полям. Материал остаётся обычным, но стартовая геометрия полностью исчезает.",
    "32 standard pieces": "32 стандартные фигуры",
    "Both sides keep the normal King, Queen, Rooks, Bishops, Knights and eight Pawns.":
      "Обе стороны сохраняют обычных короля, ферзя, ладьи, слонов, коней и восемь пешек.",
    "Whole-board placement": "Расстановка по всей доске",
    "Kings and non-Pawn pieces may begin anywhere on the 8×8 board.":
      "Короли и все фигуры кроме пешек могут начинать на любом поле доски 8×8.",
    "Playable chaos": "Играбельный хаос",
    "The generator rejects immediate King attacks and frozen starting positions.":
      "Генератор отбрасывает позиции с шахом королю на старте или без легальных ходов.",
    "Standard material, random geometry":
      "Обычный материал, случайная геометрия",
    "Every game uses exactly the ordinary 16 White and 16 Black pieces. Only their starting squares change.":
      "В каждой партии ровно обычные 16 белых и 16 чёрных фигур. Меняются только стартовые поля.",
    "Both Kings must begin safe": "Оба короля начинают безопасно",
    "The Kings are never adjacent and neither King may already be in check before White's first move.":
      "Короли никогда не стоят рядом, и ни один не находится под шахом до первого хода белых.",
    "Pawns avoid the promotion ranks":
      "Пешки не начинают на линиях превращения",
    "Pawns are randomized across ranks 2 through 7. They never begin already sitting on rank 1 or rank 8.":
      "Пешки случайно размещаются на горизонталях 2–7 и никогда не начинают на 1-й или 8-й.",
    "White always moves first": "Белые всегда ходят первыми",
    "The position is generated as a new starting position and White receives move one.":
      "Позиция создаётся как новая стартовая, и первый ход получают белые.",
    "There is no castling": "Рокировки нет",
    "Because King and Rook home squares are no longer meaningful, both sides begin with no castling rights.":
      "Поскольку домашние поля короля и ладей больше не имеют смысла, рокировка отключена для обеих сторон.",
    "After setup, play normal chess": "После расстановки обычные шахматы",
    "Movement, captures, check, checkmate, promotion, stalemate, repetition and the 50-move rule work normally.":
      "Ходы, взятия, шах, мат, превращение, пат, повторение и правило 50 ходов действуют обычно.",
    "Generate a fresh board whenever you want":
      "Создавайте новую доску когда угодно",
    "New Chaos creates a completely new playable random position and resets the game history.":
      "Новый хаос создаёт совершенно новую играбельную случайную позицию и сбрасывает историю партии.",
    "What changes": "Что меняется",
    "Opening theory disappears": "Дебютная теория исчезает",
    "There is no reliable e4, Sicilian, Queen's Gambit or prepared opening tree.":
      "Нет надёжного e4, Сицилианской защиты, ферзевого гамбита или подготовленного дерева дебютов.",
    "Immediate tactics appear": "Тактика возникает сразу",
    "Queens, Rooks and Bishops can begin with unusual long-range pressure from move one.":
      "Ферзи, ладьи и слоны могут с первого хода создавать необычное дальнее давление.",
    "Pawn structure becomes alien": "Пешечная структура становится чужой",
    "Connected, isolated and advanced Pawns are created before anyone makes a move.":
      "Связанные, изолированные и продвинутые пешки могут существовать ещё до первого хода.",
    "King safety starts as a puzzle":
      "Безопасность короля сразу становится задачей",
    "Your first strategic problem is understanding the position you were given.":
      "Первая стратегическая задача — понять полученную позицию.",
    "One Total Chaos game": "Одна партия Полного хаоса",
    Generate: "Создать",
    "32 pieces are scattered": "32 фигуры разбросаны",
    Validate: "Проверить",
    "Both Kings must be safe": "Оба короля безопасны",
    "White moves": "Ход белых",
    "Normal chess begins": "Начинаются обычные шахматы",
    Adapt: "Адаптация",
    "No opening book can save you": "Дебютная книга не спасёт",
  },
};

export default function TotalChaosChessRules() {
  const { language, setLanguage } = useChessLanguage();

  const t = (key: string) => translateChess(language, key, translations);

  return (
    <VariantRulesPage
      variantLabel={t("Chess Variant")}
      title={t("Total Chaos Chess")}
      subtitle={t("Nothing starts where it should")}
      icon="🌀"
      accent="fuchsia"
      backRoute="/games/chess/variants/complete-chaos/hotseat"
      backLabel={t("Back to Total Chaos")}
      coreIdea={t(
        "Every standard piece is scattered onto a random square before move one. The game keeps normal material, but throws away normal starting geometry.",
      )}
      language={language}
      onLanguageChange={setLanguage}
      languageLabel={t("Language")}
      coreIdeaLabel={t("Core idea")}
      ruleLabel={t("Rule")}
      playLabel={t("Play Total Chaos Chess")}
      features={[
        {
          icon: "32",
          title: t("32 standard pieces"),
          text: t(
            "Both sides keep the normal King, Queen, Rooks, Bishops, Knights and eight Pawns.",
          ),
        },
        {
          icon: "▦",
          title: t("Whole-board placement"),
          text: t(
            "Kings and non-Pawn pieces may begin anywhere on the 8×8 board.",
          ),
        },
        {
          icon: "♔",
          title: t("Playable chaos"),
          text: t(
            "The generator rejects immediate King attacks and frozen starting positions.",
          ),
        },
      ]}
      rules={[
        {
          icon: "32",
          title: t("Standard material, random geometry"),
          text: t(
            "Every game uses exactly the ordinary 16 White and 16 Black pieces. Only their starting squares change.",
          ),
        },
        {
          icon: "♔",
          title: t("Both Kings must begin safe"),
          text: t(
            "The Kings are never adjacent and neither King may already be in check before White's first move.",
          ),
        },
        {
          icon: "♙",
          title: t("Pawns avoid the promotion ranks"),
          text: t(
            "Pawns are randomized across ranks 2 through 7. They never begin already sitting on rank 1 or rank 8.",
          ),
        },
        {
          icon: "1",
          title: t("White always moves first"),
          text: t(
            "The position is generated as a new starting position and White receives move one.",
          ),
        },
        {
          icon: "♖",
          title: t("There is no castling"),
          text: t(
            "Because King and Rook home squares are no longer meaningful, both sides begin with no castling rights.",
          ),
        },
        {
          icon: "✓",
          title: t("After setup, play normal chess"),
          text: t(
            "Movement, captures, check, checkmate, promotion, stalemate, repetition and the 50-move rule work normally.",
          ),
        },
        {
          icon: "🌀",
          title: t("Generate a fresh board whenever you want"),
          text: t(
            "New Chaos creates a completely new playable random position and resets the game history.",
          ),
        },
      ]}
    >
      <VisualCard
        accent="fuchsia"
        eyebrow={t("Example")}
        title={t("One Total Chaos game")}
      >
        <Flow
          steps={[
            {
              icon: "🌀",
              label: t("Generate"),
              detail: t("32 pieces are scattered"),
            },
            {
              icon: "♔",
              label: t("Validate"),
              detail: t("Both Kings must be safe"),
            },
            {
              icon: "♙",
              label: t("White moves"),
              detail: t("Normal chess begins"),
            },
            {
              icon: "⚡",
              label: t("Adapt"),
              detail: t("No opening book can save you"),
            },
          ]}
        />
      </VisualCard>

      <VisualCard
        accent="fuchsia"
        eyebrow={t("Example")}
        title={t("What changes")}
      >
        <EffectGrid
          items={[
            {
              icon: "📕",
              title: t("Opening theory disappears"),
              text: t(
                "There is no reliable e4, Sicilian, Queen's Gambit or prepared opening tree.",
              ),
            },
            {
              icon: "♛",
              title: t("Immediate tactics appear"),
              text: t(
                "Queens, Rooks and Bishops can begin with unusual long-range pressure from move one.",
              ),
            },
            {
              icon: "♙",
              title: t("Pawn structure becomes alien"),
              text: t(
                "Connected, isolated and advanced Pawns are created before anyone makes a move.",
              ),
            },
            {
              icon: "♔",
              title: t("King safety starts as a puzzle"),
              text: t(
                "Your first strategic problem is understanding the position you were given.",
              ),
            },
          ]}
        />
      </VisualCard>
    </VariantRulesPage>
  );
}
