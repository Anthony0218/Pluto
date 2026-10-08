import { useCallback } from "react";
import type { AppLanguage } from "@/i18n/languageStore";
import { useUiLanguage } from "@/i18n/ui";

type Line = Record<AppLanguage, string>;
const t = (en: string, de: string, bar: string, ko: string, ru: string, es: string, pt: string): Line => ({ en, de, bar, ko, ru, es, pt });

// The Activity card's own words, kept next to it so the card stays one self-contained folder. Order: en, de, bar, ko, ru, es, pt.
export const activityCopy = {
  title: t("Activity", "Aktivität", "Aktivität", "활동", "Активность", "Actividad", "Atividade"),
  year: t("Year", "Jahr", "Jahr", "연", "Год", "Año", "Ano"),
  month: t("Month", "Monat", "Monat", "월", "Месяц", "Mes", "Mês"),
  week: t("Week", "Woche", "Woch", "주", "Неделя", "Semana", "Semana"),
  day: t("Day", "Tag", "Dog", "일", "День", "Día", "Dia"),
  zoom: t("Zoom level", "Zeitraum", "Zeitraum", "기간", "Период", "Periodo", "Período"),
  today: t("Today", "Heute", "Heid", "오늘", "Сегодня", "Hoy", "Hoje"),
  previous: t("Previous", "Zurück", "Zruck", "이전", "Назад", "Anterior", "Anterior"),
  next: t("Next", "Weiter", "Weiter", "다음", "Вперёд", "Siguiente", "Seguinte"),
  total: t("Activities", "Aktivitäten", "Aktivitäten", "활동", "Действия", "Actividades", "Atividades"),
  activeDays: t("Active days", "Aktive Tage", "Aktive Dog", "활동한 날", "Активные дни", "Días activos", "Dias ativos"),
  bestDay: t("Best day", "Bester Tag", "Bester Dog", "최고의 날", "Лучший день", "Mejor día", "Melhor dia"),
  game: t("Games", "Spiele", "Spiel", "게임", "Игры", "Juegos", "Jogos"),
  puzzle: t("Puzzles", "Rätsel", "Rätsl", "퍼즐", "Задачи", "Problemas", "Problemas"),
  explore: t("Explored", "Entdeckt", "Entdeckt", "둘러봄", "Изучено", "Explorado", "Explorado"),
  // "{n} activities": a finished game, a solved puzzle, or a game or lesson page opened on a day (once per page per day).
  unitOne: t("{n} activity", "{n} Aktivität", "{n} Aktivität", "활동 {n}회", "{n} действие", "{n} actividad", "{n} atividade"),
  unitFew: t("{n} activities", "{n} Aktivitäten", "{n} Aktivitäten", "활동 {n}회", "{n} действия", "{n} actividades", "{n} atividades"),
  unitMany: t("{n} activities", "{n} Aktivitäten", "{n} Aktivitäten", "활동 {n}회", "{n} действий", "{n} actividades", "{n} atividades"),
  topTitle: t("Most active in", "Am aktivsten in", "Am aktivstn in", "가장 활발한 곳", "Больше всего в", "Más actividad en", "Mais atividade em"),
  learning: t("Learning", "Lernen", "Lernan", "학습", "Обучение", "Aprendizaje", "Aprendizagem"),
  empty: t("Nothing here yet. Play a game, solve a puzzle or open a lesson and it shows up.", "Hier ist noch nichts. Spiel etwas, löse ein Rätsel oder öffne eine Lektion, dann erscheint es hier.", "Do is no nix. Spui wos, lös a Rätsl oder mach a Lektion auf, nacha steht's do.", "아직 아무것도 없어요. 게임을 하거나 퍼즐을 풀거나 레슨을 열면 여기에 표시돼요.", "Пока пусто. Сыграйте, решите задачу или откройте урок, и это появится здесь.", "Aún no hay nada. Juega, resuelve un problema o abre una lección y aparecerá aquí.", "Ainda não há nada. Joga, resolve um problema ou abre uma lição e aparece aqui."),
  loginPrompt: t("Log in to see your activity.", "Melde dich an, um deine Aktivität zu sehen.", "Meld di o, dass du dei Aktivität siehgst.", "로그인하면 활동을 볼 수 있어요.", "Войдите, чтобы увидеть свою активность.", "Inicia sesión para ver tu actividad.", "Inicia sessão para ver a tua atividade."),
  unavailable: t("Your activity is unavailable right now.", "Deine Aktivität ist gerade nicht verfügbar.", "Dei Aktivität is grod ned verfügbar.", "지금은 활동을 불러올 수 없어요.", "Сейчас активность недоступна.", "Tu actividad no está disponible ahora.", "A tua atividade não está disponível agora."),
  loading: t("Loading your activity…", "Aktivität wird geladen …", "Aktivität werd gladn …", "활동을 불러오는 중…", "Загрузка активности…", "Cargando tu actividad…", "A carregar a tua atividade…"),
  retry: t("Try again", "Erneut versuchen", "Nomoi probiern", "다시 시도", "Повторить", "Reintentar", "Tentar de novo"),
  note: t("Counts completed games, solved puzzles and the games or lessons you opened. Time zone: {tz}.", "Zählt beendete Spiele, gelöste Rätsel und geöffnete Spiele oder Lektionen. Zeitzone: {tz}.", "Zöhlt gspuite Spiel, glöste Rätsl und aufgmachte Spiel oder Lektionen. Zeitzone: {tz}.", "끝낸 게임, 푼 퍼즐, 연 게임이나 레슨을 집계해요. 시간대: {tz}.", "Считаются завершённые игры, решённые задачи и открытые игры или уроки. Часовой пояс: {tz}.", "Cuenta partidas terminadas, problemas resueltos y juegos o lecciones abiertos. Zona horaria: {tz}.", "Conta jogos terminados, problemas resolvidos e jogos ou lições abertos. Fuso horário: {tz}."),
  less: t("Less", "Weniger", "Weniga", "적음", "Меньше", "Menos", "Menos"),
  more: t("More", "Mehr", "Mehra", "많음", "Больше", "Más", "Mais"),
  noEvents: t("No activity on this day.", "An diesem Tag war nichts los.", "An dem Dog war nix los.", "이 날은 활동이 없어요.", "В этот день активности не было.", "No hubo actividad este día.", "Não houve atividade neste dia."),
  opened: t("Opened {name}", "{name} geöffnet", "{name} aufgmacht", "{name} 열기", "Открыто: {name}", "Abriste {name}", "Abriste {name}"),
  puzzleOf: t("{name} puzzle", "{name}-Rätsel", "{name}-Rätsl", "{name} 퍼즐", "Задача: {name}", "Problema de {name}", "Problema de {name}"),
  win: t("Win", "Sieg", "Sieg", "승", "Победа", "Victoria", "Vitória"),
  loss: t("Loss", "Niederlage", "Niedalag", "패", "Поражение", "Derrota", "Derrota"),
  draw: t("Draw", "Remis", "Remis", "무", "Ничья", "Tablas", "Empate"),
  noMistakes: t("No mistakes", "Fehlerfrei", "Fehlerfrei", "실수 없음", "Без ошибок", "Sin errores", "Sem erros"),
  mistakes: t("Mistakes: {n}", "Fehler: {n}", "Fehler: {n}", "실수: {n}", "Ошибок: {n}", "Errores: {n}", "Erros: {n}"),
  untimed: t("Time not recorded", "Uhrzeit nicht erfasst", "Uhrzeit ned erfasst", "시간 기록 없음", "Время не записано", "Hora no registrada", "Hora não registada"),
} as const satisfies Record<string, Line>;

export type ActivityCopyKey = keyof typeof activityCopy;

export function useActivityCopy() {
  const { language } = useUiLanguage();
  return useCallback((key: ActivityCopyKey, values?: Record<string, string | number>) => {
    let text: string = activityCopy[key][language];
    for (const [name, value] of Object.entries(values ?? {})) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }, [language]);
}

/** "1 activity", "2 activities": the unit that goes with every count in the card, in the right plural form. */
export function useActivityCount() {
  const { language } = useUiLanguage();
  const t = useActivityCopy();
  return useCallback((n: number) => {
    const form = new Intl.PluralRules(language === "bar" ? "de" : language).select(n);
    return t(form === "one" ? "unitOne" : form === "few" ? "unitFew" : "unitMany", { n });
  }, [language, t]);
}
