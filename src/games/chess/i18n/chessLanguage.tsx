import { translateUi } from "@/i18n/ui";
import { isGameTerm } from "../../../i18n/gameTerms.ts";

export type ChessLanguage = "en" | "de" | "bar" | "ko" | "ru" | "es" | "pt";

export const CHESS_LANGUAGE_STORAGE_KEY = "chess-language";

export const chessLanguageOptions: Array<{
  value: ChessLanguage;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "bar", label: "Boarisch" },
  { value: "ko", label: "한국어" },
  { value: "ru", label: "Русский" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
];

export type TranslationTable = Record<"de" | "bar" | "ko" | "ru", Record<string, string>> & Partial<Record<"es" | "pt", Record<string, string>>>;

const commonTranslations: TranslationTable = {
  de: {
    Language: "Sprache",
    "Chess Variant": "Schachvariante",
    "Game Controls": "Spielsteuerung",
    "Players, game and actions": "Spieler, Partie und Aktionen",
    "Players and actions": "Spieler und Aktionen",
    Undo: "Rückgängig",
    Restart: "Neustart",
    "New Game": "Neues Spiel",
    "New setup": "Neue Aufstellung",
    "White player": "Weißer Spieler",
    "Black player": "Schwarzer Spieler",
    White: "Weiß",
    Black: "Schwarz",
    Red: "Rot",
    Blue: "Blau",
    Yellow: "Gelb",
    Green: "Grün",
    "White to move": "Weiß am Zug",
    "Black to move": "Schwarz am Zug",
    "Captured Pieces": "Geschlagene Figuren",
    "Current board material": "Aktuelles Brettmaterial",
    "Normal captures only": "Nur normale Schlagzüge",
    Equal: "Gleich",
    "Move History": "Zugverlauf",
    "Game history": "Partieverlauf",
    "No moves yet": "Noch keine Züge",
    Move: "Zug",
    Side: "Seite",
    Played: "Gespielt",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zurück zum Live-Brett",
    "Back to live": "Zurück zur Partie",
    "Game Over": "Spielende",
    "White wins": "Weiß gewinnt",
    "Black wins": "Schwarz gewinnt",
    Draw: "Remis",
    Checkmate: "Schachmatt",
    Stalemate: "Patt",
    "Insufficient material": "Unzureichendes Material",
    "50-move rule": "50-Züge-Regel",
    "Threefold repetition": "Dreifache Stellungswiederholung",
    Rules: "Regeln",
    Board: "Brett",
    Players: "Spieler",
    Active: "Aktiv",
    Turn: "Am Zug",
    Eliminated: "Ausgeschieden",
    "Play again": "Nochmal spielen",
    "Last Player Standing": "Letzter verbleibender Spieler",
    "Core idea": "Grundidee",
    Rule: "Regel",
    Example: "Beispiel",
    "Setup flow": "Aufbauablauf",
    "Boss powers": "Boss-Kräfte",
    "Damage loop": "Schadensablauf",
    "Lucky Square outcomes": "Glücksfeld-Effekte",
    "Bomb lifecycle": "Bombenzyklus",
    "Collapse cycle": "Einsturzzyklus",
  },
  bar: {
    Language: "Sproch",
    "Chess Variant": "Schachvariantn",
    "Game Controls": "Spielsteuerung",
    "Players, game and actions": "Spiela, Partie und Aktionen",
    "Players and actions": "Spiela und Aktionen",
    Undo: "Zruck",
    Restart: "Neu startn",
    "New Game": "Neis Spiel",
    "New setup": "Neue Aufstellung",
    "White player": "Weißer Spieler",
    "Black player": "Schwarzer Spieler",
    White: "Weiß",
    Black: "Schwarz",
    Red: "Rot",
    Blue: "Blau",
    Yellow: "Gelb",
    Green: "Grün",
    "White to move": "Weiß is dro",
    "Black to move": "Schwarz is dro",
    "Captured Pieces": "G'schlagene Figuren",
    "Current board material": "Aktuells Material",
    "Normal captures only": "Bloß normale Schlagzüg",
    Equal: "Gleich",
    "Move History": "Zugverlauf",
    "Game history": "Partieverlauf",
    "No moves yet": "No koa Zug",
    Move: "Zug",
    Side: "Seitn",
    Played: "Gspuit",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zruck zum Live-Brett",
    "Back to live": "Zruck zur Partie",
    "Game Over": "Spiel aus",
    "White wins": "Weiß gwinnt",
    "Black wins": "Schwarz gwinnt",
    Draw: "Remis",
    Checkmate: "Schachmatt",
    Stalemate: "Patt",
    "Insufficient material": "Zu wenig Material",
    "50-move rule": "50-Züg-Regel",
    "Threefold repetition": "Dreifache Wiederholung",
    Rules: "Regeln",
    Board: "Brett",
    Players: "Spiela",
    Active: "Aktiv",
    Turn: "Dro",
    Eliminated: "Ausgschiedn",
    "Play again": "No amoi spuin",
    "Last Player Standing": "Letzter Spieler",
    "Core idea": "Grundidee",
    Rule: "Regel",
    Example: "Beispui",
    "Setup flow": "Aufbauablauf",
    "Boss powers": "Boss-Kräfte",
    "Damage loop": "Schodn-Ablauf",
    "Lucky Square outcomes": "Glücksfeld-Effekte",
    "Bomb lifecycle": "Bombnzyklus",
    "Collapse cycle": "Einsturzzyklus",
  },
  ko: {
    Language: "언어",
    "Chess Variant": "체스 변형",
    "Game Controls": "게임 컨트롤",
    "Players, game and actions": "플레이어, 게임 및 조작",
    "Players and actions": "플레이어 및 조작",
    Undo: "되돌리기",
    Restart: "재시작",
    "New Game": "새 게임",
    "New setup": "새 배치",
    "White player": "백 플레이어",
    "Black player": "흑 플레이어",
    White: "백",
    Black: "흑",
    Red: "빨강",
    Blue: "파랑",
    Yellow: "노랑",
    Green: "초록",
    "White to move": "백 차례",
    "Black to move": "흑 차례",
    "Captured Pieces": "잡힌 기물",
    "Current board material": "현재 기물 현황",
    "Normal captures only": "일반 잡기만 표시",
    Equal: "동일",
    "Move History": "수 기록",
    "Game history": "게임 기록",
    "No moves yet": "아직 수가 없습니다",
    Move: "수",
    Side: "진영",
    Played: "착수",
    "History Preview": "기록 미리보기",
    "Back to Live Board": "현재 보드로 돌아가기",
    "Back to live": "현재 게임으로 돌아가기",
    "Game Over": "게임 종료",
    "White wins": "백 승리",
    "Black wins": "흑 승리",
    Draw: "무승부",
    Checkmate: "체크메이트",
    Stalemate: "스테일메이트",
    "Insufficient material": "기물 부족",
    "50-move rule": "50수 규칙",
    "Threefold repetition": "3회 동형 반복",
    Rules: "규칙",
    Board: "보드",
    Players: "플레이어",
    Active: "활성",
    Turn: "차례",
    Eliminated: "탈락",
    "Play again": "다시 플레이",
    "Last Player Standing": "최후의 생존자",
    "Core idea": "핵심 아이디어",
    Rule: "규칙",
    Example: "예시",
    "Setup flow": "배치 흐름",
    "Boss powers": "보스 능력",
    "Damage loop": "피해 흐름",
    "Lucky Square outcomes": "행운 칸 효과",
    "Bomb lifecycle": "폭탄 주기",
    "Collapse cycle": "붕괴 주기",
  },
  ru: {
    Language: "Язык",
    "Chess Variant": "Шахматный вариант",
    "Game Controls": "Управление",
    "Players, game and actions": "Игроки, партия и действия",
    "Players and actions": "Игроки и действия",
    Undo: "Отменить",
    Restart: "Перезапуск",
    "New Game": "Новая игра",
    "New setup": "Новая расстановка",
    "White player": "Игрок белыми",
    "Black player": "Игрок чёрными",
    White: "Белые",
    Black: "Чёрные",
    Red: "Красный",
    Blue: "Синий",
    Yellow: "Жёлтый",
    Green: "Зелёный",
    "White to move": "Ход белых",
    "Black to move": "Ход чёрных",
    "Captured Pieces": "Взятые фигуры",
    "Current board material": "Текущий материал",
    "Normal captures only": "Только обычные взятия",
    Equal: "Равно",
    "Move History": "История ходов",
    "Game history": "История партии",
    "No moves yet": "Ходов пока нет",
    Move: "Ход",
    Side: "Сторона",
    Played: "Сыграно",
    "History Preview": "Просмотр истории",
    "Back to Live Board": "Вернуться к партии",
    "Back to live": "Вернуться к партии",
    "Game Over": "Игра окончена",
    "White wins": "Белые победили",
    "Black wins": "Чёрные победили",
    Draw: "Ничья",
    Checkmate: "Мат",
    Stalemate: "Пат",
    "Insufficient material": "Недостаточно материала",
    "50-move rule": "Правило 50 ходов",
    "Threefold repetition": "Троекратное повторение",
    Rules: "Правила",
    Board: "Доска",
    Players: "Игроки",
    Active: "Активен",
    Turn: "Ход",
    Eliminated: "Выбыл",
    "Play again": "Играть снова",
    "Last Player Standing": "Последний игрок",
    "Core idea": "Основная идея",
    Rule: "Правило",
    Example: "Пример",
    "Setup flow": "Ход расстановки",
    "Boss powers": "Силы босса",
    "Damage loop": "Цикл урона",
    "Lucky Square outcomes": "Эффекты счастливых полей",
    "Bomb lifecycle": "Цикл бомбы",
    "Collapse cycle": "Цикл обрушения",
  },
};

export { useAppLanguage as useChessLanguage } from "@/i18n/languageStore";

export function translateChess(
  language: ChessLanguage,
  key: string,
  local?: Partial<TranslationTable>,
): string {
  if (isGameTerm(key)) return key;
  if (language === "en") return key;

  const localLanguage = local?.[language];
  const commonLanguage = commonTranslations[language] ?? {};

  if (language === "bar") {
    const shared = translateUi(language, key);
    return (
      localLanguage?.[key] ??
      commonLanguage[key] ??
      (shared !== key ? shared : local?.de?.[key] ?? commonTranslations.de[key] ?? key)
    );
  }

  return localLanguage?.[key] ?? commonLanguage[key] ?? translateUi(language, key);
}

export function LanguageSelector({
  language,
  onChange,
  label,
}: {
  language: ChessLanguage;
  onChange: (language: ChessLanguage) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
        {label ?? translateChess(language, "Language")}
      </span>

      <select
        value={language}
        onChange={(event) => onChange(event.target.value as ChessLanguage)}
        className="bg-transparent text-xs font-bold text-zinc-300 outline-none"
      >
        {chessLanguageOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-zinc-900"
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
