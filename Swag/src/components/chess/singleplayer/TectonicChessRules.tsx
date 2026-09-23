import { EffectGrid, Flow, VisualCard } from "./VariantRulesPage";
import VariantRulesPage from "./VariantRulesPage";

import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../../../games/chess/i18n/chessLanguage";

const translations: TranslationTable = {
  de: {
    "Tectonic Chess": "Tectonic Chess",
    "Rules & Examples": "Regeln & Beispiele",
    "Back to Tectonic Chess": "Zurück zu Tectonic Chess",
    "Play Tectonic Chess": "Tectonic Chess spielen",
    "Move pieces. Then move the board.":
      "Ziehe Figuren. Dann bewege das Brett.",
    "Every four normal plies, the next player does not make a normal chess move. Instead, that player receives a Tectonic Shift and may rotate one legal 4×4 quadrant 90° clockwise or skip.":
      "Alle vier normalen Halbzüge macht der nächste Spieler keinen normalen Schachzug. Stattdessen erhält er einen Tectonic Shift und darf einen legalen 4×4-Quadranten um 90° im Uhrzeigersinn drehen oder überspringen.",
    "4×4 quadrants": "4×4-Quadranten",
    "The 8×8 board is divided into A, B, C and D.":
      "Das 8×8-Brett ist in A, B, C und D geteilt.",
    "Special turn": "Spezialzug",
    "A Tectonic Shift replaces that player's normal move.":
      "Ein Tectonic Shift ersetzt den normalen Zug dieses Spielers.",
    "Strategic geometry": "Strategische Geometrie",
    "Pieces keep their identity but may suddenly occupy completely different squares.":
      "Figuren behalten ihre Identität, können aber plötzlich auf völlig anderen Feldern stehen.",
    "The four quadrants": "Die vier Quadranten",
    "A covers a5–d8, B covers e5–h8, C covers a1–d4 and D covers e1–h4.":
      "A umfasst a5–d8, B e5–h8, C a1–d4 und D e1–h4.",
    "A shift happens after 4 normal plies":
      "Ein Shift kommt nach 4 normalen Halbzügen",
    "Only ordinary chess moves count toward the four-ply timer. Tectonic Shifts themselves do not count.":
      "Nur normale Schachzüge zählen für den Vier-Halbzüge-Timer. Tectonic Shifts selbst zählen nicht.",
    "The next side gets the Shift instead of a move":
      "Die nächste Seite erhält den Shift statt eines Zuges",
    "After the fourth normal ply, the side that would move next enters Tectonic Shift mode. Rotating or skipping consumes that special turn and play passes to the opponent.":
      "Nach dem vierten normalen Halbzug wechselt die Seite, die als Nächstes ziehen würde, in den Tectonic-Shift-Modus. Drehen oder Überspringen verbraucht diesen Spezialzug und das Spiel geht an den Gegner weiter.",
    "Rotate exactly one quadrant 90° clockwise":
      "Drehe genau einen Quadranten um 90° im Uhrzeigersinn",
    "Every piece inside the chosen 4×4 quadrant moves with the rotation. No piece is captured by the rotation itself.":
      "Jede Figur im gewählten 4×4-Quadranten bewegt sich mit der Drehung. Durch die Drehung selbst wird keine Figur geschlagen.",
    "Your own King must remain safe": "Der eigene König muss sicher bleiben",
    "A quadrant is illegal if rotating it leaves your own King in check. Illegal quadrants are disabled in the interface.":
      "Ein Quadrant ist illegal, wenn die Drehung den eigenen König im Schach lässt. Illegale Quadranten sind in der Oberfläche deaktiviert.",
    "A shift may create check or checkmate":
      "Ein Shift kann Schach oder Matt erzeugen",
    "After the shift, the opponent is the next side to act. Therefore a rotation may directly give check or even checkmate.":
      "Nach dem Shift ist der Gegner als Nächstes am Zug. Eine Drehung kann daher direkt Schach oder sogar Schachmatt geben.",
    "The previous quadrant is locked once":
      "Der vorherige Quadrant ist einmal gesperrt",
    "The quadrant used by the previous rotation cannot be used on the immediately following Tectonic Shift. A skipped Shift clears that lock.":
      "Der beim vorherigen Shift gedrehte Quadrant kann beim unmittelbar folgenden Tectonic Shift nicht erneut benutzt werden. Ein übersprungener Shift löscht die Sperre.",
    "Skip is normally allowed": "Überspringen ist normalerweise erlaubt",
    "If your King is not in check, you may Skip instead of rotating. Skip still consumes the Tectonic Shift turn.":
      "Wenn dein König nicht im Schach steht, darfst du statt einer Drehung überspringen. Das verbraucht trotzdem den Tectonic-Shift-Zug.",
    "Check changes the Shift": "Schach verändert den Shift",
    "If your King is already in check when Tectonic Shift mode begins, Skip is disabled. You must find a legal quadrant rotation that makes your King safe. If none exists, you lose by Tectonic Lock.":
      "Steht dein König zu Beginn des Tectonic-Shift-Modus bereits im Schach, ist Überspringen deaktiviert. Du musst einen legalen Quadranten drehen, der deinen König rettet. Gibt es keinen, verlierst du durch Tectonic Lock.",
    "Pawns keep their original direction":
      "Bauern behalten ihre ursprüngliche Richtung",
    "A rotation may move a Pawn sideways or even onto a very unusual rank, but White Pawns still move toward rank 8 and Black Pawns toward rank 1.":
      "Eine Drehung kann einen Bauern seitlich oder auf eine ungewöhnliche Reihe versetzen, aber weiße Bauern ziehen weiterhin Richtung Reihe 8 und schwarze Richtung Reihe 1.",
    "Rotation alone does not promote a Pawn":
      "Eine Drehung allein befördert keinen Bauern",
    "Promotion happens only when a Pawn completes a normal chess move onto its promotion rank.":
      "Eine Umwandlung geschieht nur, wenn ein Bauer einen normalen Schachzug auf seine Umwandlungsreihe beendet.",
    "Castling rights can be destroyed by the board":
      "Rochaderechte können durch das Brett verloren gehen",
    "If a King or an eligible Rook is physically relocated by a Tectonic rotation, the corresponding castling right is permanently removed.":
      "Wird ein König oder ein rochadeberechtigter Turm durch eine tektonische Drehung versetzt, geht das entsprechende Rochaderecht dauerhaft verloren.",
    "Normal chess endings remain active": "Normale Schachenden bleiben aktiv",
    "Checkmate, stalemate, insufficient material, the 50-move rule and repetition can still end the game. Tectonic repetition also includes the current quadrant lock and Shift timer.":
      "Schachmatt, Patt, unzureichendes Material, 50-Züge-Regel und Wiederholung können das Spiel weiterhin beenden. Bei Tectonic-Wiederholung zählen auch aktuelle Quadrantensperre und Shift-Timer.",
    "How one cycle works": "So funktioniert ein Zyklus",
    "White move": "Weißer Zug",
    "Black move": "Schwarzer Zug",
    "Four normal plies": "Vier normale Halbzüge",
    "Next side shifts": "Nächste Seite shiftet",
    "Rotate or Skip, then turn passes.":
      "Drehen oder überspringen, dann wechselt der Zug.",
    "What a rotation can do": "Was eine Drehung bewirken kann",
    "Open a rook file": "Eine Turmlinie öffnen",
    "A blocker can rotate away and reveal a long-range attack.":
      "Ein Blockierer kann weggedreht werden und eine Fernangriffslinie öffnen.",
    "Move a King": "Einen König versetzen",
    "A King inside the quadrant moves with the board, as long as the resulting square is safe.":
      "Ein König im Quadranten bewegt sich mit dem Brett, solange das Zielfeld sicher ist.",
    "Rebuild pawn structure": "Bauernstruktur neu bauen",
    "Pawns may be rotated onto files and ranks they could never reach through normal Pawn movement alone.":
      "Bauern können auf Linien und Reihen gedreht werden, die sie durch normale Bauernzüge nie erreichen könnten.",
    "Create a direct check": "Direktes Schach erzeugen",
    "Because the opponent moves next after the Shift, a newly opened attack is immediately real.":
      "Da der Gegner nach dem Shift als Nächstes zieht, ist ein neu geöffneter Angriff sofort wirksam.",
  },
  bar: {
    "Tectonic Chess": "Tectonic Chess",
    "Rules & Examples": "Regeln & Beispui",
    "Back to Tectonic Chess": "Zruck zu Tectonic Chess",
    "Play Tectonic Chess": "Tectonic Chess spuin",
    "Move pieces. Then move the board.": "Figurn ziagn. Dann s Brett bewegn.",
    "4×4 quadrants": "4×4-Quadrantn",
    "Special turn": "Spezialzug",
    "Strategic geometry": "Strategische Geometrie",
  },
  ko: {
    "Tectonic Chess": "텍토닉 체스",
    "Rules & Examples": "규칙 및 예시",
    "Back to Tectonic Chess": "텍토닉 체스로 돌아가기",
    "Play Tectonic Chess": "텍토닉 체스 플레이",
    "Move pieces. Then move the board.":
      "기물을 움직인 뒤, 체스판 자체를 움직입니다.",
    "Every four normal plies, the next player does not make a normal chess move. Instead, that player receives a Tectonic Shift and may rotate one legal 4×4 quadrant 90° clockwise or skip.":
      "일반 하프무브 4회마다 다음 플레이어는 일반 체스 수를 두지 않고 텍토닉 시프트를 수행합니다. 합법적인 4×4 사분면 하나를 시계 방향으로 90° 회전하거나 건너뛸 수 있습니다.",
    "4×4 quadrants": "4×4 사분면",
    "The 8×8 board is divided into A, B, C and D.":
      "8×8 보드는 A, B, C, D 네 사분면으로 나뉩니다.",
    "Special turn": "특수 턴",
    "A Tectonic Shift replaces that player's normal move.":
      "텍토닉 시프트는 그 플레이어의 일반 수를 대신합니다.",
    "Strategic geometry": "전략적 기하",
    "Pieces keep their identity but may suddenly occupy completely different squares.":
      "기물의 종류는 그대로지만 갑자기 전혀 다른 칸으로 이동할 수 있습니다.",
    "The four quadrants": "네 개의 사분면",
    "A covers a5–d8, B covers e5–h8, C covers a1–d4 and D covers e1–h4.":
      "A는 a5–d8, B는 e5–h8, C는 a1–d4, D는 e1–h4를 포함합니다.",
    "A shift happens after 4 normal plies": "일반 하프무브 4회 후 시프트 발생",
    "Only ordinary chess moves count toward the four-ply timer. Tectonic Shifts themselves do not count.":
      "일반 체스 수만 4하프무브 타이머에 포함되며 텍토닉 시프트 자체는 포함되지 않습니다.",
    "The next side gets the Shift instead of a move":
      "다음 플레이어는 일반 수 대신 시프트 수행",
    "After the fourth normal ply, the side that would move next enters Tectonic Shift mode. Rotating or skipping consumes that special turn and play passes to the opponent.":
      "네 번째 일반 하프무브 뒤 다음 차례의 플레이어가 텍토닉 시프트 모드에 들어갑니다. 회전 또는 건너뛰기를 하면 특수 턴이 소비되고 상대 차례로 넘어갑니다.",
    "Rotate exactly one quadrant 90° clockwise":
      "사분면 하나를 시계 방향 90° 회전",
    "Every piece inside the chosen 4×4 quadrant moves with the rotation. No piece is captured by the rotation itself.":
      "선택한 4×4 사분면 안의 모든 기물이 함께 회전합니다. 회전 자체로 기물이 잡히지는 않습니다.",
    "Your own King must remain safe": "자신의 킹은 반드시 안전해야 함",
    "A quadrant is illegal if rotating it leaves your own King in check. Illegal quadrants are disabled in the interface.":
      "회전 후 자신의 킹이 체크 상태가 되면 그 사분면은 불법이며 UI에서 비활성화됩니다.",
    "A shift may create check or checkmate":
      "시프트로 체크 또는 체크메이트 가능",
    "After the shift, the opponent is the next side to act. Therefore a rotation may directly give check or even checkmate.":
      "시프트 뒤에는 상대가 다음 차례이므로 회전으로 직접 체크 또는 체크메이트를 만들 수 있습니다.",
    "The previous quadrant is locked once": "직전 사분면은 한 번 잠김",
    "The quadrant used by the previous rotation cannot be used on the immediately following Tectonic Shift. A skipped Shift clears that lock.":
      "직전 회전에서 사용한 사분면은 바로 다음 텍토닉 시프트에서 사용할 수 없습니다. 시프트를 건너뛰면 잠금이 해제됩니다.",
    "Skip is normally allowed": "보통은 건너뛰기 가능",
    "If your King is not in check, you may Skip instead of rotating. Skip still consumes the Tectonic Shift turn.":
      "킹이 체크 상태가 아니면 회전 대신 건너뛸 수 있습니다. 그래도 텍토닉 시프트 턴은 소비됩니다.",
    "Check changes the Shift": "체크 상태에서는 시프트 규칙 변경",
    "If your King is already in check when Tectonic Shift mode begins, Skip is disabled. You must find a legal quadrant rotation that makes your King safe. If none exists, you lose by Tectonic Lock.":
      "텍토닉 시프트 시작 시 킹이 이미 체크 상태이면 건너뛰기를 할 수 없습니다. 킹을 안전하게 만드는 합법적인 사분면 회전을 찾아야 하며, 없으면 텍토닉 락으로 패배합니다.",
    "Pawns keep their original direction": "폰은 원래 진행 방향 유지",
    "A rotation may move a Pawn sideways or even onto a very unusual rank, but White Pawns still move toward rank 8 and Black Pawns toward rank 1.":
      "회전으로 폰이 옆 파일이나 특이한 랭크로 이동해도 백 폰은 계속 8랭크 방향, 흑 폰은 1랭크 방향으로 움직입니다.",
    "Rotation alone does not promote a Pawn": "회전만으로는 폰 승격 없음",
    "Promotion happens only when a Pawn completes a normal chess move onto its promotion rank.":
      "폰이 일반 체스 수로 승격 랭크에 도착했을 때만 승격합니다.",
    "Castling rights can be destroyed by the board":
      "보드 회전으로 캐슬링 권리 상실 가능",
    "If a King or an eligible Rook is physically relocated by a Tectonic rotation, the corresponding castling right is permanently removed.":
      "킹이나 캐슬링 가능한 룩이 텍토닉 회전으로 위치가 바뀌면 해당 캐슬링 권리는 영구적으로 사라집니다.",
    "Normal chess endings remain active": "일반 체스 종료 규칙 유지",
    "Checkmate, stalemate, insufficient material, the 50-move rule and repetition can still end the game. Tectonic repetition also includes the current quadrant lock and Shift timer.":
      "체크메이트, 스테일메이트, 기물 부족, 50수 규칙, 반복은 그대로 게임을 종료할 수 있습니다. 텍토닉 반복 판정에는 현재 사분면 잠금과 시프트 타이머도 포함됩니다.",
    "How one cycle works": "한 사이클의 흐름",
    "White move": "백 수",
    "Black move": "흑 수",
    "Four normal plies": "일반 하프무브 4회",
    "Next side shifts": "다음 플레이어 시프트",
    "Rotate or Skip, then turn passes.": "회전 또는 건너뛰기 후 상대 차례.",
    "What a rotation can do": "회전으로 가능한 것",
    "Open a rook file": "룩 파일 열기",
    "A blocker can rotate away and reveal a long-range attack.":
      "막고 있던 기물이 회전으로 사라져 장거리 공격이 열릴 수 있습니다.",
    "Move a King": "킹 이동",
    "A King inside the quadrant moves with the board, as long as the resulting square is safe.":
      "사분면 안의 킹도 함께 회전하며 도착 칸이 안전해야 합니다.",
    "Rebuild pawn structure": "폰 구조 재구성",
    "Pawns may be rotated onto files and ranks they could never reach through normal Pawn movement alone.":
      "폰은 일반적인 폰 이동만으로는 갈 수 없는 파일과 랭크로 회전될 수 있습니다.",
    "Create a direct check": "직접 체크 생성",
    "Because the opponent moves next after the Shift, a newly opened attack is immediately real.":
      "시프트 뒤 상대가 바로 차례이므로 새로 열린 공격은 즉시 실제 체크가 됩니다.",
  },
  ru: {
    "Tectonic Chess": "Тектонические шахматы",
    "Rules & Examples": "Правила и примеры",
    "Back to Tectonic Chess": "Назад к тектоническим шахматам",
    "Play Tectonic Chess": "Играть в тектонические шахматы",
    "Move pieces. Then move the board.":
      "Двигайте фигуры. Затем двигайте саму доску.",
    "Every four normal plies, the next player does not make a normal chess move. Instead, that player receives a Tectonic Shift and may rotate one legal 4×4 quadrant 90° clockwise or skip.":
      "После каждых четырёх обычных полуходов следующий игрок вместо обычного хода получает тектонический сдвиг: можно повернуть один легальный квадрант 4×4 на 90° по часовой стрелке или пропустить.",
    "4×4 quadrants": "Квадранты 4×4",
    "The 8×8 board is divided into A, B, C and D.":
      "Доска 8×8 разделена на A, B, C и D.",
    "Special turn": "Особый ход",
    "A Tectonic Shift replaces that player's normal move.":
      "Тектонический сдвиг заменяет обычный ход этого игрока.",
    "Strategic geometry": "Стратегическая геометрия",
    "Pieces keep their identity but may suddenly occupy completely different squares.":
      "Фигуры сохраняют свой тип, но могут внезапно оказаться на совершенно других полях.",
    "The four quadrants": "Четыре квадранта",
    "A covers a5–d8, B covers e5–h8, C covers a1–d4 and D covers e1–h4.":
      "A охватывает a5–d8, B — e5–h8, C — a1–d4, D — e1–h4.",
    "A shift happens after 4 normal plies": "Сдвиг после 4 обычных полуходов",
    "Only ordinary chess moves count toward the four-ply timer. Tectonic Shifts themselves do not count.":
      "В таймер четырёх полуходов входят только обычные шахматные ходы; сами сдвиги не считаются.",
    "The next side gets the Shift instead of a move":
      "Следующая сторона получает сдвиг вместо хода",
    "After the fourth normal ply, the side that would move next enters Tectonic Shift mode. Rotating or skipping consumes that special turn and play passes to the opponent.":
      "После четвёртого обычного полухода сторона, чей ход следующий, входит в режим сдвига. Поворот или пропуск расходует этот особый ход, и очередь переходит сопернику.",
    "Rotate exactly one quadrant 90° clockwise":
      "Поверните один квадрант на 90° по часовой стрелке",
    "Every piece inside the chosen 4×4 quadrant moves with the rotation. No piece is captured by the rotation itself.":
      "Все фигуры внутри выбранного квадранта 4×4 перемещаются вместе с поворотом. Сам поворот ничего не захватывает.",
    "Your own King must remain safe":
      "Свой король должен оставаться в безопасности",
    "A quadrant is illegal if rotating it leaves your own King in check. Illegal quadrants are disabled in the interface.":
      "Квадрант нелегален, если после поворота ваш король остаётся под шахом. Такие варианты отключены в интерфейсе.",
    "A shift may create check or checkmate": "Сдвиг может создать шах или мат",
    "After the shift, the opponent is the next side to act. Therefore a rotation may directly give check or even checkmate.":
      "После сдвига ходит соперник, поэтому поворот может сразу объявить шах или даже мат.",
    "The previous quadrant is locked once":
      "Предыдущий квадрант блокируется на один сдвиг",
    "The quadrant used by the previous rotation cannot be used on the immediately following Tectonic Shift. A skipped Shift clears that lock.":
      "Квадрант предыдущего поворота нельзя использовать в следующем сдвиге. Пропуск снимает эту блокировку.",
    "Skip is normally allowed": "Обычно сдвиг можно пропустить",
    "If your King is not in check, you may Skip instead of rotating. Skip still consumes the Tectonic Shift turn.":
      "Если ваш король не под шахом, можно пропустить вместо поворота. Особый ход всё равно расходуется.",
    "Check changes the Shift": "Шах меняет правила сдвига",
    "If your King is already in check when Tectonic Shift mode begins, Skip is disabled. You must find a legal quadrant rotation that makes your King safe. If none exists, you lose by Tectonic Lock.":
      "Если в начале режима сдвига король уже под шахом, пропуск запрещён. Нужно найти легальный поворот, спасающий короля. Если его нет, вы проигрываете из-за тектонической блокировки.",
    "Pawns keep their original direction": "Пешки сохраняют направление",
    "A rotation may move a Pawn sideways or even onto a very unusual rank, but White Pawns still move toward rank 8 and Black Pawns toward rank 1.":
      "Поворот может перенести пешку вбок или на необычную горизонталь, но белые пешки всё равно идут к 8-й горизонтали, чёрные — к 1-й.",
    "Rotation alone does not promote a Pawn": "Сам поворот не превращает пешку",
    "Promotion happens only when a Pawn completes a normal chess move onto its promotion rank.":
      "Превращение происходит только когда пешка обычным ходом заканчивает движение на последней горизонтали.",
    "Castling rights can be destroyed by the board":
      "Доска может уничтожить право на рокировку",
    "If a King or an eligible Rook is physically relocated by a Tectonic rotation, the corresponding castling right is permanently removed.":
      "Если король или ладья, имеющая право на рокировку, физически перемещены тектоническим поворотом, соответствующее право на рокировку теряется навсегда.",
    "Normal chess endings remain active":
      "Обычные окончания партии сохраняются",
    "Checkmate, stalemate, insufficient material, the 50-move rule and repetition can still end the game. Tectonic repetition also includes the current quadrant lock and Shift timer.":
      "Мат, пат, недостаток материала, правило 50 ходов и повторение всё ещё завершают партию. В тектоническом повторении также учитываются текущая блокировка квадранта и таймер сдвига.",
    "How one cycle works": "Как проходит один цикл",
    "White move": "Ход белых",
    "Black move": "Ход чёрных",
    "Four normal plies": "Четыре обычных полухода",
    "Next side shifts": "Следующая сторона делает сдвиг",
    "Rotate or Skip, then turn passes.":
      "Поворот или пропуск, затем очередь переходит.",
    "What a rotation can do": "Что может сделать поворот",
    "Open a rook file": "Открыть линию ладье",
    "A blocker can rotate away and reveal a long-range attack.":
      "Блокирующая фигура может уйти с поворотом и открыть дальнюю атаку.",
    "Move a King": "Переместить короля",
    "A King inside the quadrant moves with the board, as long as the resulting square is safe.":
      "Король внутри квадранта двигается вместе с доской, если новое поле безопасно.",
    "Rebuild pawn structure": "Перестроить пешечную структуру",
    "Pawns may be rotated onto files and ranks they could never reach through normal Pawn movement alone.":
      "Пешки могут оказаться на линиях и горизонталях, куда обычным ходом пешки не попали бы.",
    "Create a direct check": "Создать прямой шах",
    "Because the opponent moves next after the Shift, a newly opened attack is immediately real.":
      "Поскольку после сдвига ходит соперник, вновь открытая атака сразу становится реальной.",
  },
};

export default function TectonicChessRules() {
  const { language, setLanguage } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);

  return (
    <VariantRulesPage
      variantLabel={t("Chess Variant")}
      title={t("Tectonic Chess")}
      subtitle={t("Move pieces. Then move the board.")}
      icon="↻"
      accent="violet"
      backRoute="/games/chess/variants/tectonic/hotseat"
      backLabel={t("Back to Tectonic Chess")}
      coreIdea={t(
        "Every four normal plies, the next side receives a Tectonic Shift before its normal move. It may rotate one legal 4×4 quadrant 90° clockwise or Skip. A rotation consumes the special action and passes the turn; a Skip keeps the player's normal chess move.",
      )}
      language={language}
      onLanguageChange={setLanguage}
      languageLabel={t("Language")}
      coreIdeaLabel={t("Core idea")}
      ruleLabel={t("Rule")}
      playLabel={t("Play Tectonic Chess")}
      features={[
        {
          icon: "▦",
          title: t("4×4 quadrants"),
          text: t("The 8×8 board is divided into A, B, C and D."),
        },
        {
          icon: "↻",
          title: t("Shift before the normal move"),
          text: t(
            "After four normal plies, the next side must resolve its Tectonic Shift first.",
          ),
        },
        {
          icon: "⏭",
          title: t("Skip keeps your move"),
          text: t("Skipping does not consume the player's normal chess move."),
        },
      ]}
      rules={[
        {
          icon: "▦",
          title: t("The four quadrants"),
          text: t(
            "A covers a5–d8, B covers e5–h8, C covers a1–d4 and D covers e1–h4.",
          ),
        },
        {
          icon: "4",
          title: t("A shift opportunity appears after 4 normal plies"),
          text: t(
            "Only ordinary chess moves count toward the four-ply timer. Tectonic Shift actions themselves do not count as normal plies.",
          ),
        },
        {
          icon: "90°",
          title: t("A rotation turns one quadrant 90° clockwise"),
          text: t(
            "Every piece inside the chosen 4×4 quadrant moves with the board. No piece is captured merely because of the rotation.",
          ),
        },
        {
          icon: "→",
          title: t("A real rotation consumes the special action"),
          text: t(
            "After a legal quadrant rotation, the side to move changes immediately to the opponent and the normal four-ply counter resets.",
          ),
        },
        {
          icon: "⏭",
          title: t("Skip does not consume the normal chess move"),
          text: t(
            "If your King is not in check, you may Skip. The board and side to move remain unchanged, so you then make your normal chess move.",
          ),
        },
        {
          icon: "1→2",
          title: t("After the first Skip, the opponent gets a Shift"),
          text: t(
            "When the first skipping player makes the following normal move, the opponent receives an immediate Tectonic Shift opportunity before their normal move.",
          ),
        },
        {
          icon: "2→0",
          title: t("Two consecutive Skips end the special sequence"),
          text: t(
            "If the opponent also Skips, they still make their normal chess move. After that move the skip chain ends and the normal four-ply counter restarts from zero.",
          ),
        },
        {
          icon: "♔",
          title: t("Your own King must remain safe"),
          text: t(
            "A quadrant is illegal if rotating it leaves your own King in check. Unsafe rotations are disabled.",
          ),
        },
        {
          icon: "!",
          title: t("Skip is forbidden while your King is in check"),
          text: t(
            "If Tectonic Shift mode begins while your King is checked, you must use a legal rotation that makes the King safe. If none exists, you lose by Tectonic Lock.",
          ),
        },
        {
          icon: "🔒",
          title: t("The previous rotated quadrant is locked once"),
          text: t(
            "The quadrant used by the previous real rotation cannot be rotated again on the immediately following Shift. A Skip clears that one-shift lock.",
          ),
        },
        {
          icon: "♙",
          title: t("Pawns keep their original direction"),
          text: t(
            "A rotation may relocate Pawns to unusual files or ranks, but White Pawns still move toward rank 8 and Black Pawns toward rank 1.",
          ),
        },
        {
          icon: "♕",
          title: t("Rotation alone does not promote a Pawn"),
          text: t(
            "Promotion occurs only when a Pawn completes a normal chess move onto its promotion rank.",
          ),
        },
        {
          icon: "♖",
          title: t("Castling rights follow the rotated position"),
          text: t(
            "After a rotation, a castling right survives only if the eligible King and Rook are still physically on the required home squares. Otherwise that right is removed.",
          ),
        },
        {
          icon: "♟",
          title: t("Normal chess endings remain active"),
          text: t(
            "Checkmate, stalemate, insufficient material, the 50-move rule and repetition can still end the game. Tectonic repetition also includes Shift state such as locks and the skip chain.",
          ),
        },
      ]}
    >
      <VisualCard
        accent="violet"
        eyebrow={t("Example")}
        title={t("First Skip sequence")}
      >
        <Flow
          steps={[
            { icon: "×4", label: t("Four normal plies") },
            {
              icon: "⏭",
              label: t("White Skips"),
              detail: t("White still keeps the normal move."),
            },
            {
              icon: "♙",
              label: t("White moves"),
              detail: t("Black now receives a Shift."),
            },
            {
              icon: "↻",
              label: t("Black resolves Shift"),
              detail: t("Rotate, or Skip and still make Black's normal move."),
            },
          ]}
        />
      </VisualCard>

      <VisualCard
        accent="violet"
        eyebrow={t("Example")}
        title={t("If both players Skip")}
      >
        <Flow
          steps={[
            { icon: "⏭", label: t("White Skip") },
            { icon: "♙", label: t("White normal move") },
            { icon: "⏭", label: t("Black Skip") },
            {
              icon: "♟",
              label: t("Black normal move"),
              detail: t("Skip chain ends; counter resets to 0."),
            },
          ]}
        />
      </VisualCard>

      <VisualCard
        accent="violet"
        eyebrow={t("Example")}
        title={t("What a rotation can do")}
      >
        <EffectGrid
          items={[
            {
              icon: "♜",
              title: t("Open a rook file"),
              text: t(
                "A blocker can rotate away and reveal a long-range attack.",
              ),
            },
            {
              icon: "♔",
              title: t("Move a King"),
              text: t(
                "A King inside the quadrant moves with the board if the resulting position is legal.",
              ),
            },
            {
              icon: "♙",
              title: t("Rebuild pawn structure"),
              text: t(
                "Pawns may be rotated onto files and ranks unreachable by ordinary Pawn movement.",
              ),
            },
            {
              icon: "+",
              title: t("Create a direct check"),
              text: t(
                "A real rotation passes play to the opponent, so an opened attack can immediately give check.",
              ),
            },
          ]}
        />
      </VisualCard>
    </VariantRulesPage>
  );
}
