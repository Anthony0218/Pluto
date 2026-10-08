import { useCallback } from "react";
import type { AppLanguage } from "@/i18n/languageStore";
import { useUiLanguage } from "@/i18n/ui";

type Line = Record<AppLanguage, string>;
const t = (en: string, de: string, bar: string, ko: string, ru: string, es: string, pt: string): Line => ({ en, de, bar, ko, ru, es, pt });

// Landing-page copy that is not part of the shared UI dictionary. Order: en, de, bar, ko, ru, es, pt.
export const copy = {
  // Flyby
  pickWorld: t("Pick a world.", "Wähle eine Welt.", "Such da a Wejd aus.", "세계를 골라보세요.", "Выберите мир.", "Elige un mundo.", "Escolhe um mundo."),
  pickTool: t("Pick a tool.", "Wähle ein Werkzeug.", "Such da a Werkzeig aus.", "도구를 골라보세요.", "Выберите инструмент.", "Elige una herramienta.", "Escolhe uma ferramenta."),
  pickBook: t("Open a book.", "Öffne ein Buch.", "Mach a Buach auf.", "책을 펼쳐보세요.", "Откройте книгу.", "Abre un libro.", "Abre um livro."),
  scrollToTravel: t("Scroll to travel", "Scrollen zum Reisen", "Scrolln zum Reisn", "스크롤하여 여행하기", "Прокрутите, чтобы отправиться", "Desplázate para viajar", "Desloca para viajar"),
  skipFlight: t("Skip the flight", "Flug überspringen", "Flug überspringa", "비행 건너뛰기", "Пропустить полёт", "Saltar el viaje", "Saltar a viagem"),
  chessLine: t("Strategy, puzzles and engine-backed review.", "Strategie, Rätsel und Analyse mit Engine.", "Strategie, Rätsl und Analys mit Engine.", "전략, 퍼즐, 엔진 기반 분석.", "Стратегия, задачи и анализ с движком.", "Estrategia, problemas y análisis con motor.", "Estratégia, problemas e análise com motor."),
  playChess: t("Play Chess", "Schach spielen", "Schach spuin", "체스 플레이", "Играть в шахматы", "Jugar al ajedrez", "Jogar xadrez"),
  openTool: t("Open tool", "Werkzeug öffnen", "Werkzeig aufmacha", "도구 열기", "Открыть инструмент", "Abrir herramienta", "Abrir ferramenta"),
  openBook: t("Start reading", "Jetzt lesen", "Jetz lesn", "읽기 시작", "Начать читать", "Empezar a leer", "Começar a ler"),
  yourPath: t("Your learning path", "Dein Lernpfad", "Dei Lernpfad", "나의 학습 경로", "Ваш путь обучения", "Tu ruta de aprendizaje", "O teu percurso de aprendizagem"),
  pathLabel: t("Learning path", "Lernpfad", "Lernpfad", "학습 경로", "Путь обучения", "Ruta de aprendizaje", "Percurso de aprendizagem"),
  friendsOrbit: t("Friends in orbit", "Freunde im Orbit", "Freind im Orbit", "궤도를 도는 친구들", "Друзья на орбите", "Amigos en órbita", "Amigos em órbita"),

  // One-line blurbs shown on hover cards
  blurbChess: t("Classic chess, variants, puzzles and Stockfish review.", "Klassisches Schach, Varianten, Rätsel und Stockfish-Analyse.", "Klassisches Schach, Variantn, Rätsl und Stockfish-Analys.", "클래식 체스, 변형 룰, 퍼즐, 스톡피시 분석.", "Классические шахматы, варианты, задачи и анализ Stockfish.", "Ajedrez clásico, variantes, problemas y análisis con Stockfish.", "Xadrez clássico, variantes, problemas e análise com Stockfish."),
  blurbGo: t("Claim territory on 9×9 to 19×19 boards.", "Erobere Gebiet auf Brettern von 9×9 bis 19×19.", "Erober Gebiet auf Brettln vo 9×9 bis 19×19.", "9×9부터 19×19 바둑판에서 집을 차지하세요.", "Захватывайте территорию на досках от 9×9 до 19×19.", "Conquista territorio en tableros de 9×9 a 19×19.", "Conquista território em tabuleiros de 9×9 a 19×19."),
  blurbWatten: t("The Tyrolean-Bavarian trick-taking card game.", "Das tirolerisch-bayerische Stichspiel.", "Des tirolerisch-boarische Stichspui.", "티롤과 바이에른의 트릭테이킹 카드 게임.", "Тирольско-баварская карточная игра на взятки.", "El juego de cartas de bazas tirolés-bávaro.", "O jogo de vazas tirolês-bávaro."),
  blurbSchafkopf: t("Bavarian card game for four: Rufspiel, Wenz and Solo.", "Bayerisches Kartenspiel zu viert: Rufspiel, Wenz und Solo.", "Boarisches Kartnspui für vier: Rufspui, Wenz und Solo.", "4인용 바이에른 카드 게임: 루프슈필, 벤츠, 졸로.", "Баварская карточная игра на четверых: Rufspiel, Wenz и Solo.", "Juego de cartas bávaro para cuatro: Rufspiel, Wenz y Solo.", "Jogo de cartas bávaro para quatro: Rufspiel, Wenz e Solo."),
  blurbAtlas: t("Test your world knowledge on an interactive map.", "Teste dein Weltwissen auf einer interaktiven Karte.", "Teste dei Weltwissn auf ana interaktivn Karten.", "인터랙티브 지도로 세계 지식을 시험해 보세요.", "Проверьте знания о мире на интерактивной карте.", "Pon a prueba tu conocimiento del mundo en un mapa interactivo.", "Testa o teu conhecimento do mundo num mapa interativo."),
  blurbNatura: t("Discover animals and their remarkable abilities.", "Entdecke Tiere und ihre erstaunlichen Fähigkeiten.", "Entdeck Viecher und ihre erstaunlichen Fähigkeiten.", "동물과 놀라운 능력을 알아보세요.", "Узнайте о животных и их удивительных способностях.", "Descubre los animales y sus asombrosas habilidades.", "Descobre os animais e as suas capacidades notáveis."),
  blurbEatIt: t("Small circle. Big appetite.", "Kleiner Kreis. Großer Hunger.", "Kloaner Kreis. Großer Hunger.", "작은 원, 큰 식욕.", "Маленький круг. Большой аппетит.", "Círculo pequeño. Gran apetito.", "Círculo pequeno. Grande apetite."),

  // Section copy
  exploreGame: t("Explore {name}", "{name} entdecken", "{name} entdecka", "{name} 둘러보기", "Открыть {name}", "Explorar {name}", "Explorar {name}"),
  chessL1: t("Every way to", "Jede Art,", "Jede Art,", "체스를 즐기는", "Все способы", "Todas las formas", "Todas as formas"),
  chessL2: t("play chess.", "Schach zu spielen.", "Schach zu spuin.", "모든 방법.", "играть в шахматы.", "de jugar al ajedrez.", "de jogar xadrez."),
  chessDesc: t("Classic games, wild variants, puzzles and Stockfish-powered review, all in one place.", "Klassische Partien, wilde Varianten, Rätsel und Stockfish-Analyse – alles an einem Ort.", "Klassische Partien, wuide Variantn, Rätsl und Stockfish-Analys – alles an am Platz.", "클래식 대국, 독특한 변형 룰, 퍼즐, 스톡피시 기반 분석까지 한곳에서.", "Классические партии, необычные варианты, задачи и анализ на Stockfish — всё в одном месте.", "Partidas clásicas, variantes salvajes, problemas y revisión con Stockfish, todo en un solo lugar.", "Partidas clássicas, variantes malucas, problemas e revisão com Stockfish, tudo num só lugar."),
  goL1: t("Claim the", "Erobere das", "Erober des", "바둑판을", "Захватите", "Conquista el", "Conquista o"),
  goL2: t("board.", "Brett.", "Brettl.", "차지하세요.", "доску.", "tablero.", "tabuleiro."),
  goDesc: t("Play 9×9 to 19×19 against a bot, a friend or the world, then review your game with an engine.", "Spiele 9×9 bis 19×19 gegen einen Bot, einen Freund oder die Welt – und analysiere deine Partie mit einer Engine.", "Spui 9×9 bis 19×19 gegn an Bot, an Freind oder d' Welt – und analysier dei Partie mit ana Engine.", "9×9부터 19×19까지, 봇·친구·전 세계 플레이어와 대국하고 엔진으로 복기하세요.", "Играйте на досках от 9×9 до 19×19 против бота, друга или всего мира и разбирайте партию с движком.", "Juega de 9×9 a 19×19 contra un bot, un amigo o el mundo, y revisa tu partida con un motor.", "Joga de 9×9 a 19×19 contra um bot, um amigo ou o mundo, e revê o teu jogo com um motor."),
  wattenL1: t("Bluff. Raise.", "Bluffen. Erhöhen.", "Bluffa. Erhöhn.", "블러프. 레이즈.", "Блефуйте. Повышайте.", "Farolea. Sube.", "Faz bluff. Aumenta."),
  wattenL2: t("Win the trick.", "Stich holen.", "Stich hoin.", "트릭을 따내세요.", "Берите взятки.", "Gana la baza.", "Ganha a vaza."),
  wattenDesc: t("Tyrolean-Bavarian trick-taking with critical cards, raises and a friendly help mode for beginners.", "Tirolerisch-bayerisches Stichspiel mit kritischen Karten, Erhöhungen und einem freundlichen Hilfemodus für Einsteiger.", "Tirolerisch-boarisches Stichspui mit kritischn Kartn, Erhöhungan und am freindlichn Hilfemodus für Anfänger.", "티롤·바이에른식 트릭테이킹. 크리티컬 카드와 레이즈, 초보자를 위한 도움말 모드가 있습니다.", "Тирольско-баварская игра на взятки с критическими картами, повышениями ставки и режимом подсказок для новичков.", "Juego de bazas tirolés-bávaro con cartas críticas, subidas y un modo de ayuda para principiantes.", "Jogo de vazas tirolês-bávaro com cartas críticas, aumentos e um modo de ajuda para iniciantes."),
  schafkopfL1: t("Rufspiel,", "Rufspiel,", "Rufspui,", "루프슈필,", "Rufspiel,", "Rufspiel,", "Rufspiel,"),
  schafkopfL2: t("Wenz & Solo.", "Wenz & Solo.", "Wenz & Solo.", "벤츠와 졸로.", "Wenz и Solo.", "Wenz y Solo.", "Wenz e Solo."),
  schafkopfDesc: t("The Bavarian card game for four, with proper follow-suit rules: hotseat, against bots or online.", "Das bayerische Kartenspiel für vier, mit echten Bedienregeln: Hotseat, gegen Bots oder online.", "Des boarische Kartnspui für vier, mit echtn Bedienregln: Hotseat, gegn Bots oder online.", "정식 무늬 따르기 규칙을 갖춘 4인용 바이에른 카드 게임. 핫시트, 봇 대전, 온라인 모두 가능합니다.", "Баварская карточная игра на четверых с настоящими правилами хода в масть: за одним экраном, против ботов или онлайн.", "El juego de cartas bávaro para cuatro, con las reglas de asistir al palo: hotseat, contra bots u online.", "O jogo de cartas bávaro para quatro, com as regras de assistir ao naipe: hotseat, contra bots ou online."),
  atlasL1: t("The world is", "Die Welt ist", "De Welt is", "세계가", "Мир —", "El mundo es", "O mundo é"),
  atlasL2: t("your board.", "dein Spielbrett.", "dei Spuibrettl.", "당신의 보드입니다.", "ваша доска.", "tu tablero.", "o teu tabuleiro."),
  atlasDesc: t("Master countries, capitals, flags and geographic facts on an interactive world map.", "Meistere Länder, Hauptstädte, Flaggen und geografische Fakten auf einer interaktiven Weltkarte.", "Meister Länder, Hauptstädt, Fahnan und geografische Fakten auf ana interaktivn Weltkartn.", "인터랙티브 세계 지도에서 국가, 수도, 국기, 지리 상식을 마스터하세요.", "Осваивайте страны, столицы, флаги и географические факты на интерактивной карте мира.", "Domina países, capitales, banderas y datos geográficos en un mapa del mundo interactivo.", "Domina países, capitais, bandeiras e factos geográficos num mapa-múndi interativo."),
  naturaL1: t("Discover the", "Entdecke die", "Entdeck de", "자연을", "Откройте", "Descubre el", "Descobre o"),
  naturaL2: t("natural world.", "Natur.", "Natur.", "발견하세요.", "мир природы.", "mundo natural.", "mundo natural."),
  naturaDesc: t("Explore animals and their remarkable abilities through interactive games.", "Erkunde Tiere und ihre erstaunlichen Fähigkeiten durch interaktive Spiele.", "Erkunde Viecher und ihre erstaunlichen Fähigkeiten durch interaktive Spui.", "인터랙티브 게임으로 동물과 그들의 놀라운 능력을 탐구하세요.", "Изучайте животных и их удивительные способности в интерактивных играх.", "Explora los animales y sus asombrosas habilidades con juegos interactivos.", "Explora os animais e as suas capacidades notáveis em jogos interativos."),
  eatitL1: t("Small circle.", "Kleiner Kreis.", "Kloaner Kreis.", "작은 원.", "Маленький круг.", "Círculo pequeño.", "Círculo pequeno."),
  eatitL2: t("Big appetite.", "Großer Hunger.", "Großer Hunger.", "큰 식욕.", "Большой аппетит.", "Gran apetito.", "Grande apetite."),
  eatitDesc: t("Eat, grow and be the last circle standing in colorful City and Nature arenas.", "Friss, wachse und sei der letzte Kreis in bunten Stadt- und Natur-Arenen.", "Friss, wachs und sei da letzte Kreis in buntn Stodt- und Natur-Arenan.", "먹고, 성장하고, 다채로운 도시와 자연 경기장에서 마지막까지 살아남으세요.", "Ешьте, растите и останьтесь последним кругом на красочных городских и природных аренах.", "Come, crece y sé el último círculo en pie en coloridas arenas de ciudad y naturaleza.", "Come, cresce e sê o último círculo de pé em coloridas arenas de cidade e natureza."),
  toolsL1: t("A little help for", "Kleine Hilfe für", "Kloane Hilf für", "일상에 도움이 되는", "Небольшая помощь", "Una pequeña ayuda para", "Uma pequena ajuda para"),
  toolsL2: t("everyday life.", "den Alltag.", "den Alltag.", "작은 도구들.", "в повседневных делах.", "el día a día.", "o dia a dia."),
  toolsDesc: t("Percentages, conversions and budgets: small tools that do one thing well, right in your browser.", "Prozente, Umrechnungen und Budgets: kleine Werkzeuge, die eine Sache richtig gut machen – direkt im Browser.", "Prozent, Umrechnungan und Budgets: kloane Werkzeig, de oa Sach richtig guat macha – glei im Browser.", "퍼센트, 단위 변환, 예산까지. 한 가지를 잘 해내는 작은 도구를 브라우저에서 바로 쓰세요.", "Проценты, конвертеры и бюджеты: небольшие инструменты, которые хорошо делают своё дело, прямо в браузере.", "Porcentajes, conversiones y presupuestos: pequeñas herramientas que hacen una cosa bien, directamente en tu navegador.", "Percentagens, conversões e orçamentos: pequenas ferramentas que fazem uma coisa bem, diretamente no teu navegador."),
  learnDesc: t("Follow a path from the basics to confident play: rules, strategy and the maths behind everyday decisions.", "Folge einem Pfad von den Grundlagen zum sicheren Spiel: Regeln, Strategie und die Mathematik hinter Alltagsentscheidungen.", "Folg am Pfad vo de Grundlagn zum sichern Spui: Regln, Strategie und d' Mathematik hinter Alltagsentscheidungan.", "기초부터 자신 있는 플레이까지 학습 경로를 따라가세요. 규칙, 전략, 일상 결정 속 수학까지.", "Следуйте по пути от основ к уверенной игре: правила, стратегия и математика повседневных решений.", "Sigue una ruta desde lo básico hasta jugar con confianza: reglas, estrategia y las matemáticas de las decisiones cotidianas.", "Segue um percurso dos fundamentos até jogar com confiança: regras, estratégia e a matemática das decisões do dia a dia."),
  demoTabsLabel: t("Demos", "Demos", "Demos", "데모", "Демо", "Demos", "Demos"),
  chessAnalysisTab: t("Chess Analysis", "Schachanalyse", "Schachanalys", "체스 분석", "Анализ партии", "Análisis de ajedrez", "Análise de xadrez"),
  chessPuzzleTab: t("Chess Puzzle", "Schachrätsel", "Schachrätsl", "체스 퍼즐", "Шахматная задача", "Problema de ajedrez", "Problema de xadrez"),
  analysisTab: t("Analysis", "Analyse", "Analys", "분석", "Анализ", "Análisis", "Análise"),

  // Demos
  demoBadge: t("Interactive demo", "Interaktive Demo", "Interaktive Demo", "인터랙티브 데모", "Интерактивное демо", "Demo interactiva", "Demo interativa"),
  goThinking: t("White is thinking…", "Weiß denkt nach …", "Weiß überlegt …", "백이 생각 중…", "Белые думают…", "Las blancas piensan…", "As brancas estão a pensar…"),
  goYourMove: t("Your move — you play Black.", "Du bist am Zug – du spielst Schwarz.", "Du bist dran – du spuist Schwarz.", "당신 차례입니다 — 흑을 두세요.", "Ваш ход — вы играете чёрными.", "Tu turno: juegas con negras.", "A tua vez: jogas com as pretas."),
  playGo: t("Play Go", "Go spielen", "Go spuin", "바둑 두기", "Играть в го", "Jugar al Go", "Jogar Go"),
  goHint: t("Tap an empty point to place a stone. Surround stones to capture them.", "Tippe auf einen freien Punkt, um einen Stein zu setzen. Umzingle Steine, um sie zu schlagen.", "Tipp auf an freien Punkt, um an Stoa hinzusetzn. Umzingl Stoana, um s zu schlogn.", "빈 교차점을 눌러 돌을 놓으세요. 돌을 둘러싸 따내세요.", "Нажмите на пустой пункт, чтобы поставить камень. Окружите камни, чтобы захватить их.", "Toca un punto vacío para colocar una piedra. Rodea piedras para capturarlas.", "Toca num ponto vazio para colocar uma pedra. Rodeia pedras para as capturar."),
  analyzeGo: t("Analyze Go", "Go analysieren", "Go analysiern", "바둑 분석", "Анализ го", "Analizar Go", "Analisar Go"),
  sampleAnalysis: t("Sample analysis", "Beispielanalyse", "Beispielanalys", "분석 예시", "Пример анализа", "Análisis de ejemplo", "Análise de exemplo"),
  winrate: t("Win rate", "Gewinnchance", "Gwinnchance", "승률", "Шансы на победу", "Probabilidad de ganar", "Probabilidade de vitória"),
  candidates: t("Candidate moves", "Kandidatenzüge", "Kandidatenzüg", "후보 수", "Возможные ходы", "Jugadas candidatas", "Jogadas candidatas"),
  playWatten: t("Play Watten", "Watten spielen", "Watten spuin", "바텐 플레이", "Играть в ваттен", "Jugar Watten", "Jogar Watten"),
  playSchafkopf: t("Play Schafkopf", "Schafkopf spielen", "Schafkopf spuin", "샤프코프 플레이", "Играть в Schafkopf", "Jugar Schafkopf", "Jogar Schafkopf"),
  playAtlas: t("Play Atlas Arena", "Atlas Arena spielen", "Atlas Arena spuin", "Atlas Arena 플레이", "Играть в Atlas Arena", "Jugar Atlas Arena", "Jogar Atlas Arena"),
  playNatura: t("Play Natura", "Natura spielen", "Natura spuin", "Natura 플레이", "Играть в Natura", "Jugar Natura", "Jogar Natura"),
  playEatIt: t("Play Eat It", "Eat It spielen", "Eat It spuin", "Eat It 플레이", "Играть в Eat It", "Jugar Eat It", "Jogar Eat It"),
  seatYou: t("You", "Du", "Du", "나", "Вы", "Tú", "Tu"),
  seatLeft: t("Left", "Links", "Links", "왼쪽", "Слева", "Izquierda", "Esquerda"),
  seatAcross: t("Partner", "Partner", "Partner", "파트너", "Партнёр", "Compañero", "Parceiro"),
  seatRight: t("Right", "Rechts", "Rechts", "오른쪽", "Справа", "Derecha", "Direita"),
  cardYourTurn: t("Your turn — play a card.", "Du bist dran – spiel eine Karte.", "Du bist dran – spui a Kartn.", "당신 차례 — 카드를 내세요.", "Ваш ход — сыграйте карту.", "Tu turno: juega una carta.", "A tua vez: joga uma carta."),
  cardWaiting: t("Waiting for the others…", "Warten auf die anderen …", "Warten auf d' andern …", "다른 플레이어를 기다리는 중…", "Ждём остальных…", "Esperando a los demás…", "À espera dos outros…"),
  cardTrickYou: t("You take the trick!", "Du holst den Stich!", "Du hoist den Stich!", "당신이 트릭을 가져갑니다!", "Вы берёте взятку!", "¡Te llevas la baza!", "Ganhas a vaza!"),
  cardTrickOther: t("{name} takes the trick.", "{name} holt den Stich.", "{name} hoit den Stich.", "{name}이(가) 트릭을 가져갑니다.", "{name} забирает взятку.", "{name} se lleva la baza.", "{name} ganha a vaza."),
  cardDonePoints: t("Round over — your team scored {points} points.", "Runde vorbei – dein Team hat {points} Punkte.", "Runde aus – dei Team hod {points} Punkt.", "라운드 종료 — 우리 팀 {points}점.", "Раунд окончен — ваша команда набрала {points} очков.", "Ronda terminada: tu equipo suma {points} puntos.", "Ronda terminada: a tua equipa fez {points} pontos."),
  cardDoneTricks: t("Round over — you won {tricks} tricks.", "Runde vorbei – du hast {tricks} Stiche gewonnen.", "Runde aus – du hosd {tricks} Stich gwunna.", "라운드 종료 — 트릭 {tricks}개를 이겼습니다.", "Раунд окончен — вы взяли взяток: {tricks}.", "Ronda terminada: ganaste {tricks} bazas.", "Ronda terminada: ganhaste {tricks} vazas."),
  cardAgain: t("Play again", "Nochmal spielen", "Nomoi spuin", "다시 하기", "Сыграть ещё", "Jugar de nuevo", "Jogar de novo"),
  pointsLabel: t("Team points: {points}", "Teampunkte: {points}", "Teampunkt: {points}", "팀 점수: {points}", "Очки команды: {points}", "Puntos del equipo: {points}", "Pontos da equipa: {points}"),
  tricksLabel: t("Tricks: {tricks} of {total}", "Stiche: {tricks} von {total}", "Stich: {tricks} von {total}", "트릭: {total}개 중 {tricks}개", "Взятки: {tricks} из {total}", "Bazas: {tricks} de {total}", "Vazas: {tricks} de {total}"),
  wattenRules: t("Critical cards beat everything, then the Schlag, then Trumpf, then the suit led. Three tricks win the round.", "Kritische stechen alles, dann der Schlag, dann Trumpf, dann die angespielte Farbe. Drei Stiche gewinnen die Runde.", "Kritische stechan ois, dann da Schlag, dann Trumpf, dann de ogspuite Farb. Drei Stich gwinnan de Rundn.", "크리티컬 카드가 가장 강하고, 그다음 슐라크, 트럼프, 선 무늬 순입니다. 세 트릭을 따면 라운드 승리.", "Критические карты бьют всё, затем Schlag, затем Trumpf, затем масть хода. Три взятки выигрывают раунд.", "Las cartas críticas ganan a todo, luego el Schlag, luego el Trumpf y después el palo de salida. Tres bazas ganan la ronda.", "As cartas críticas ganham a tudo, depois o Schlag, depois o Trumpf e por fim o naipe jogado. Três vazas ganham a ronda."),
  schafkopfRules: t("Sauspiel on the Eichel-Sau: Ober, Unter and Herz are trump. Follow suit.", "Sauspiel auf die Eichel-Sau: Ober, Unter und Herz sind Trumpf. Farbe bedienen.", "Sauspui auf de Oachl-Sau: Ober, Unter und Herz san Trumpf. Farb bedienan.", "아이헬 에이스를 부르는 자우슈필: 오버·운터·하트가 으뜸패. 무늬를 따라야 합니다.", "Sauspiel на Eichel-Sau: Ober, Unter и Herz — козыри. Нужно ходить в масть.", "Sauspiel a la Eichel-Sau: Ober, Unter y Herz son triunfo. Hay que asistir al palo.", "Sauspiel à Eichel-Sau: Ober, Unter e Herz são trunfo. É preciso assistir ao naipe."),
  cardRoundWon: t("Three tricks — the round is yours!", "Drei Stiche – die Runde gehört dir!", "Drei Stich – de Rundn ghört dir!", "세 트릭 — 라운드 승리!", "Три взятки — раунд ваш!", "Tres bazas: ¡la ronda es tuya!", "Três vazas: a ronda é tua!"),
  cardRoundLost: t("The opponents took three tricks — their round.", "Die Gegner haben drei Stiche – ihre Runde.", "De Gegner ham drei Stich – eahna Rundn.", "상대가 세 트릭을 가져갔습니다 — 상대의 라운드.", "Соперники взяли три взятки — раунд за ними.", "Los rivales ganaron tres bazas: la ronda es suya.", "Os adversários ganharam três vazas: a ronda é deles."),
  scoreLabel: t("Score", "Punkte", "Punkt", "점수", "Счёт", "Puntos", "Pontos"),
  streakLabel: t("Streak", "Serie", "Serie", "연속", "Серия", "Racha", "Sequência"),
  bestLabel: t("Best", "Rekord", "Rekord", "최고", "Рекорд", "Mejor", "Melhor"),
  whichCountry: t("Which country does this flag belong to?", "Zu welchem Land gehört diese Flagge?", "Zu wöichm Land ghört de Fahna?", "이 국기는 어느 나라의 것일까요?", "Какой стране принадлежит этот флаг?", "¿A qué país pertenece esta bandera?", "A que país pertence esta bandeira?"),
  shootInsect: t("Shoot the insect with a jet of water", "Insekt mit einem Wasserstrahl treffen", "Insekt mit am Wasserstrahl treffa", "물줄기로 곤충 맞히기", "Сбить насекомое струёй воды", "Derribar el insecto con un chorro de agua", "Acertar no inseto com um jato de água"),
  hitsLabel: t("Hits", "Treffer", "Treffer", "명중", "Попадания", "Aciertos", "Acertos"),
  eatAria: t("Eat It arena. Drag or use WASD and the arrow keys to move your mouth.", "Eat-It-Arena. Ziehe oder nutze WASD und die Pfeiltasten, um deinen Mund zu bewegen.", "Eat-It-Arena. Zieh oder nimm WASD und d' Pfeiltastn, um dein Mund zum bewegn.", "Eat It 경기장. 드래그하거나 WASD와 방향키로 입을 움직이세요.", "Арена Eat It. Перетаскивайте или используйте WASD и стрелки, чтобы двигать пасть.", "Arena de Eat It. Arrastra o usa WASD y las flechas para mover tu boca.", "Arena de Eat It. Arrasta ou usa WASD e as setas para mover a tua boca."),
  eatReady: t("Ready?", "Bereit?", "Bereit?", "준비됐나요?", "Готовы?", "¿Listo?", "Pronto?"),
  eatEaten: t("You were eaten!", "Du wurdest gefressen!", "Du wurdst gfressn!", "먹혔습니다!", "Вас съели!", "¡Te han comido!", "Foste comido!"),
  eatHint: t("Drag or use WASD to move. Eat what fits your mouth to grow, and stay away from bigger mouths.", "Ziehen oder WASD zum Bewegen. Friss, was in deinen Mund passt, um zu wachsen, und meide größere Münder.", "Ziang oder WASD zum Bewegn. Friss, wos in dei Mund passt, um zum wachsn, und moid größere Mäuler.", "드래그하거나 WASD로 움직이세요. 입에 들어가는 것을 먹고 성장하되, 더 큰 입은 피하세요.", "Перетаскивайте или используйте WASD. Ешьте то, что помещается в пасть, чтобы расти, и держитесь подальше от больших.", "Arrastra o usa WASD para moverte. Come lo que quepa en tu boca para crecer y evita las bocas más grandes.", "Arrasta ou usa WASD para te moveres. Come o que couber na tua boca para crescer e foge das bocas maiores."),
  eatStart: t("Start", "Start", "Start", "시작", "Старт", "Empezar", "Começar"),

  // Returning visitors, closing call to action, progress rail
  welcomeBack: t("Welcome back, {name}", "Willkommen zurück, {name}", "Servus, {name}", "다시 오신 것을 환영합니다, {name}", "С возвращением, {name}", "Te damos la bienvenida de nuevo, {name}", "Bem-vindo de volta, {name}"),
  streakDays: t("{days}-day streak", "{days} Tage in Folge", "{days} Tag in Folge", "{days}일 연속", "Серия: {days} дн.", "Racha de {days} días", "{days} dias seguidos"),
  continueLabel: t("Continue:", "Weiter mit:", "Weiter mit:", "이어서:", "Продолжить:", "Continuar:", "Continuar:"),
  ctaTitle: t("Your move.", "Du bist dran.", "Du bist dran.", "당신 차례입니다.", "Ваш ход.", "Tu turno.", "A tua vez."),
  ctaText: t("Pick a game, learn something new, or challenge a friend.", "Such dir ein Spiel aus, lerne etwas Neues oder fordere einen Freund heraus.", "Such da a Spui aus, lern was Neis oder fordre an Freind raus.", "게임을 고르고, 새로운 것을 배우고, 친구에게 도전해 보세요.", "Выберите игру, узнайте что-то новое или бросьте вызов другу.", "Elige un juego, aprende algo nuevo o reta a un amigo.", "Escolhe um jogo, aprende algo novo ou desafia um amigo."),
  startPlaying: t("Start playing", "Jetzt spielen", "Jetz spuin", "플레이 시작", "Начать играть", "Empezar a jugar", "Começar a jogar"),
  heroSub: t("Real games, sharp tools and lessons that show you how to get better.", "Echte Spiele, starke Werkzeuge und Lektionen, die zeigen, wie du besser wirst.", "Echte Spiel, staake Werkzeig und Lektionen, de dir zeign, wia du bessa werst.", "진짜 게임, 똑똑한 도구, 그리고 더 나아지는 방법을 알려주는 학습까지.", "Настоящие игры, удобные инструменты и уроки, которые помогут стать лучше.", "Juegos de verdad, herramientas útiles y lecciones que te enseñan a mejorar.", "Jogos a sério, ferramentas úteis e lições que te mostram como melhorar."),
  heroStats: t("{games} games · {tools} tools · {paths} learning paths", "{games} Spiele · {tools} Werkzeuge · {paths} Lernpfade", "{games} Spiel · {tools} Werkzeig · {paths} Lernpfade", "게임 {games}개 · 도구 {tools}개 · 학습 경로 {paths}개", "Игр: {games} · инструментов: {tools} · путей обучения: {paths}", "{games} juegos · {tools} herramientas · {paths} rutas de aprendizaje", "{games} jogos · {tools} ferramentas · {paths} percursos de aprendizagem"),

  // Genre under each planet in the hero
  genreStrategy: t("Strategy", "Strategie", "Strategie", "전략", "Стратегия", "Estrategia", "Estratégia"),
  genreCards: t("Card game", "Kartenspiel", "Kartnspui", "카드 게임", "Карточная игра", "Juego de cartas", "Jogo de cartas"),
  genreGeography: t("Geography", "Geografie", "Geografie", "지리", "География", "Geografía", "Geografia"),
  genreNature: t("Nature", "Natur", "Natur", "자연", "Природа", "Naturaleza", "Natureza"),
  genreArcade: t("Arcade", "Arcade", "Arcade", "아케이드", "Аркада", "Arcade", "Arcade"),
  openDashboard: t("Open dashboard", "Dashboard öffnen", "Dashboard aufmacha", "대시보드 열기", "Открыть панель", "Abrir panel", "Abrir painel"),
} as const satisfies Record<string, Line>;

export type CopyKey = keyof typeof copy;

export const lc = (language: AppLanguage, key: CopyKey) => copy[key][language];

/** `const text = useCopy(); text("pickWorld")` — re-renders when the language changes. */
export function useCopy() {
  const { language } = useUiLanguage();
  return useCallback((key: CopyKey) => copy[key][language], [language]);
}
