import type { AppLanguage } from "@/i18n/languageStore";
import type { BookDesign, UniverseCategory } from "./universeCatalog";

type Copy = Record<UniverseCategory | "exploreTools", string>;
const copy: Record<AppLanguage, Copy> = {
  en: { games: "Find your next game.", tools: "A little help for everyday life.", learn: "Open a book. Explore an idea.", exploreTools: "Explore tools" },
  de: { games: "Entdecke dein nächstes Spiel.", tools: "Kleine Helfer für deinen Alltag.", learn: "Öffne ein Buch. Entdecke eine Idee.", exploreTools: "Tools entdecken" },
  bar: { games: "Entdeck dei nächsts Spui.", tools: "Kloane Helfer für dein Alltag.", learn: "Mach a Buach auf. Entdeck a Idee.", exploreTools: "Tools entdecken" },
  ko: { games: "다음에 즐길 게임을 찾아보세요.", tools: "일상에 도움이 되는 작은 도구들.", learn: "책을 펼치고 아이디어를 탐구해 보세요.", exploreTools: "도구 둘러보기" },
  ru: { games: "Найдите свою следующую игру.", tools: "Небольшая помощь в повседневных делах.", learn: "Откройте книгу. Исследуйте новую идею.", exploreTools: "Открыть инструменты" },
  es: { games: "Descubre tu próximo juego.", tools: "Una pequeña ayuda para el día a día.", learn: "Abre un libro. Explora una idea.", exploreTools: "Explorar herramientas" },
  pt: { games: "Descobre o teu próximo jogo.", tools: "Uma pequena ajuda para o dia a dia.", learn: "Abre um livro. Explora uma ideia.", exploreTools: "Explorar ferramentas" },
};

export function landingCopy(language: AppLanguage, key: keyof Copy) {
  return copy[language][key];
}

// Short printed cover titles keep the artwork legible in every language.
// The full course/subject title is always shown below the book and on its link.
const bookTitles: Record<AppLanguage, Record<BookDesign, string>> = {
  en: { math: "Math", foundations: "Foundations", music: "Music", percentages: "Percentages", guides: "Game guides", analysis: "Analysis", algebra: "Algebra", calculus: "Calculus", linear: "Linear algebra", depth: "Analysis", chance: "Statistics", pitch: "Pitches", rhythm: "Rhythm", rules: "Rules", tactics: "Tactics", football: "Football", signal: "Signals" },
  de: { math: "Mathematik", foundations: "Grundlagen", music: "Musik", percentages: "Prozente", guides: "Spielregeln", analysis: "Analyse", algebra: "Algebra", calculus: "Differenzial", linear: "Lineare Algebra", depth: "Analysis", chance: "Statistik", pitch: "Tonhöhen", rhythm: "Rhythmus", rules: "Regeln", tactics: "Taktik", football: "Fußball", signal: "Signale" },
  bar: { math: "Mathematik", foundations: "Grundlagn", music: "Musik", percentages: "Prozente", guides: "Spuiregeln", analysis: "Analyse", algebra: "Algebra", calculus: "Differenzial", linear: "Lineare Algebra", depth: "Analysis", chance: "Statistik", pitch: "Tonhöhn", rhythm: "Rhythmus", rules: "Regln", tactics: "Taktik", football: "Fuaßboi", signal: "Signale" },
  ko: { math: "수학", foundations: "기초", music: "음악", percentages: "백분율", guides: "게임 가이드", analysis: "분석", algebra: "대수", calculus: "미적분", linear: "선형대수", depth: "해석학", chance: "통계", pitch: "음높이", rhythm: "리듬", rules: "규칙", tactics: "전술", football: "축구", signal: "신호" },
  ru: { math: "Математика", foundations: "Основы", music: "Музыка", percentages: "Проценты", guides: "Правила игр", analysis: "Анализ", algebra: "Алгебра", calculus: "Анализ", linear: "Линейная алгебра", depth: "Основы анализа", chance: "Статистика", pitch: "Высота звука", rhythm: "Ритм", rules: "Правила", tactics: "Тактика", football: "Футбол", signal: "Сигналы" },
  es: { math: "Matemáticas", foundations: "Fundamentos", music: "Música", percentages: "Porcentajes", guides: "Guías de juego", analysis: "Análisis", algebra: "Álgebra", calculus: "Cálculo", linear: "Álgebra lineal", depth: "Análisis", chance: "Estadística", pitch: "Notas", rhythm: "Ritmo", rules: "Reglas", tactics: "Tácticas", football: "Fútbol", signal: "Señales" },
  pt: { math: "Matemática", foundations: "Fundamentos", music: "Música", percentages: "Percentagens", guides: "Guias de jogo", analysis: "Análise", algebra: "Álgebra", calculus: "Cálculo", linear: "Álgebra linear", depth: "Análise", chance: "Estatística", pitch: "Notas", rhythm: "Ritmo", rules: "Regras", tactics: "Táticas", football: "Futebol", signal: "Sinais" },
};

export function landingBookTitle(language: AppLanguage, design: BookDesign) {
  return bookTitles[language][design];
}
