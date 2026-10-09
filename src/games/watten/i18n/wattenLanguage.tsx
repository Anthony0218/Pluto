import type { ReactNode } from "react";
import { translateGameUi } from "../../../i18n/gameUi.ts";
import { isGameTerm } from "../../../i18n/gameTerms.ts";

export type WattenLanguage = "en" | "de" | "bar" | "ko" | "ru" | "es" | "pt";

export const wattenLanguageOptions: Array<{
  value: WattenLanguage;
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

const de: Record<string, string> = {
  "Bavarian Watten": "Bayerisches Watten",
  "3 Player Multiplayer": "3 Spieler · Multiplayer",
  "Create room": "Raum erstellen",
  "Join room": "Raum beitreten",
  "Create 3-player room": "3-Spieler-Raum erstellen",
  "Join 3-player room": "3-Spieler-Raum beitreten",
  "Room code": "Raumcode",
  "Target score": "Zielpunktzahl",
  "Sign in required": "Anmeldung erforderlich",
  "Multiplayer uses your Supabase account.":
    "Multiplayer verwendet dein Supabase-Konto.",
  "Waiting for players": "Warte auf Spieler",
  "players connected": "Spieler verbunden",
  "Share this room code. The game starts automatically when all three players have joined.":
    "Teile diesen Raumcode. Das Spiel startet automatisch, sobald alle drei Spieler beigetreten sind.",
  "Click this box to copy the code":
    "Klicke auf dieses Feld, um den Code zu kopieren",
  "Copied to clipboard": "In die Zwischenablage kopiert",
  Players: "Spieler",
  Round: "Runde",
  "Solo player": "Alleinspieler",
  Opponents: "Gegenspieler",
  Dealer: "Geber",
  Cutter: "Abheber",
  "Your turn": "Du bist am Zug",
  Waiting: "Warten",
  Cards: "Karten",
  Tricks: "Stiche",
  Points: "Punkte",
  "Round value": "Rundenwert",
  "Raise to": "Gehen auf",
  Hold: "Halten",
  Decline: "Nicht halten",
  "Choose trump": "Trumpf bestimmen",
  "Choose rank": "Schlag bestimmen",
  "Choose the trump suit.": "Wähle die Trumpffarbe.",
  "Choose the Schlag rank.": "Wähle den Schlag.",
  Abheben: "Abheben",
  "Choose a cut position": "Wähle eine Stelle zum Abheben",
  "You are cutting the deck.": "Du hebst ab.",
  "Waiting for the cutter.": "Warte auf den Abheber.",
  "Game table": "Spielfeld",
  "Current player": "Aktueller Spieler",
  "Card ranking": "Kartenrangfolge",
  "Show card ranking": "Kartenrangfolge einblenden",
  "Hide card ranking": "Kartenrangfolge ausblenden",
  Help: "Hilfe",
  "Help On": "Hilfe an",
  Leave: "Verlassen",
  Language: "Sprache",
  Trump: "Farbe",
  Schlag: "Schlag",
  "No trump yet": "Noch kein Trumpf",
  "No Schlag yet": "Noch kein Schlag",
  "Round winner": "Rundensieger",
  "Match winner": "Gesamtsieger",
  "Next round": "Nächste Runde",
  "3 tricks to win": "3 Stiche zum Sieg",
  Solo: "Solo",
  Team: "Team",
  "Game is loading...": "Spiel wird geladen...",
  Back: "Zurück",
  "You must play trump or a critical card.":
    "Du musst Trumpf oder einen Kritischen spielen.",
  "Trumpf oder Kritisch": "Trumpf oder Kritisch",
  "Your cards": "Deine Karten",
  "Opponent cards": "Gegnerische Karten",
  "Current trick": "Aktueller Stich",
  Continue: "Weiter",
  "Game starts automatically.": "Das Spiel startet automatisch.",
  Beginner: "Anfängerhilfe",
  "Highest priority first.": "Höchste Priorität zuerst.",
  "Critical cards": "Kritische",
  "Main Schlag": "Hauptschlag",
  "Other Schlag cards": "Schläge",
  "Trump cards": "Trumpfkarten",
  "Normal cards": "Normale Karten",
  "Connection error": "Verbindungsfehler",
  "Could not copy room code.": "Raumcode konnte nicht kopiert werden.",
  "Room not found.": "Raum nicht gefunden.",
  "You are not a player in this room.": "Du bist kein Spieler dieses Raumes.",
  "Three players. One plays solo, the other two form a team.":
    "Drei Spieler. Einer spielt allein, die beiden anderen bilden ein Team.",
  Multiplayer: "Multiplayer",
  "Choose a game variant first, then create a private room or join an existing one.":
    "Wähle zuerst die Spielvariante und erstelle danach einen privaten Raum oder tritt einem bestehenden Raum bei.",
  "Number of players": "Spieleranzahl",
  "3 Players": "3 Spieler",
  "4 Players": "4 Spieler",
  "One solo player against a team of two.":
    "Ein Alleinspieler gegen zwei Gegenspieler.",
  "Two fixed teams with partners sitting opposite each other.":
    "Zwei feste Teams mit gegenüberliegenden Partnern.",
  "Team of 2": "2er-Team",
  "Signed in as": "Eingeloggt als",
  "You must be signed in to play multiplayer.":
    "Für Multiplayer musst du eingeloggt sein.",
  "3-player Watten": "3-Spieler-Watten",
  "4-player Watten": "4-Spieler-Watten",
  "Create a new room": "Neuen Raum erstellen",
  "Create a private room and share the six-character room code with the other players.":
    "Erstelle einen privaten Raum und teile den sechsstelligen Raumcode mit deinen Mitspielern.",
  Mode: "Modus",
  Room: "Raum",
  Private: "Privat",
  "1 vs 2": "1 gegen 2",
  "2 vs 2": "2 gegen 2",
  "Creating room...": "Raum wird erstellt...",
  "Create 4-player room": "4-Spieler-Raum erstellen",
  "Join an existing game": "Bestehendem Spiel beitreten",
  "Choose the same game mode as the host above, then enter the room code.":
    "Wähle oben denselben Spielmodus wie der Host und gib danach seinen Raumcode ein.",
  Selected: "Gewählt",
  "Opening room...": "Raum wird geöffnet...",
  "Join 4-player room": "4-Spieler-Raum beitreten",
  "You must be signed in.": "Du musst angemeldet sein.",
  "Please enter a room code.": "Bitte gib einen Raumcode ein.",
  "The room code must contain 6 characters.":
    "Der Raumcode muss 6 Zeichen haben.",
  "The server did not return a room code.":
    "Der Server hat keinen Raumcode zurückgegeben.",
  "The room could not be created.": "Der Raum konnte nicht erstellt werden.",
  "This room is already full.": "Dieser Raum ist bereits voll.",
  "This room could not be found.": "Dieser Raum wurde nicht gefunden.",
  "This game has already started.": "Dieses Spiel wurde bereits gestartet.",
  "You have already joined this room.":
    "Du bist diesem Raum bereits beigetreten.",
  "Could not join room.": "Beitritt fehlgeschlagen.",
};

const bar: Record<string, string> = {
  "Bavarian Watten": "Boarisches Watten",
  "3 Player Multiplayer": "3 Spieler · Online",
  "Create room": "Raum aufmocha",
  "Join room": "In Raum einegeh",
  "Create 3-player room": "3-Spieler-Raum aufmocha",
  "Join 3-player room": "Bei am 3-Spieler-Raum mitspuin",
  "Room code": "Raumcode",
  "Target score": "Zielpunkt",
  "Waiting for players": "Wart auf d'Spieler",
  "players connected": "Spieler drin",
  Players: "Spieler",
  Round: "Rundn",
  "Solo player": "Alleinspieler",
  Opponents: "Gegenspieler",
  Dealer: "Geber",
  Cutter: "Abheber",
  "Your turn": "Du bist dro",
  Waiting: "Wartn",
  Cards: "Kartn",
  Tricks: "Stich",
  Points: "Punkt",
  "Round value": "Rundnwert",
  "Raise to": "Geh auf",
  Hold: "Haltn",
  Decline: "Ned haltn",
  "Choose trump": "Trumpf aussuacha",
  "Choose rank": "Schlag aussuacha",
  "Choose the trump suit.": "Such da d'Trumpffarb aus.",
  "Choose the Schlag rank.": "Such da an Schlag aus.",
  "Choose a cut position": "Such da a Stell zum Abhebn aus",
  "You are cutting the deck.": "Du hebst grod ab.",
  "Waiting for the cutter.": "Wart auf'n Abheber.",
  "Game table": "Spuitisch",
  "Current player": "Aktueller Spieler",
  "Card ranking": "Kartn-Rangfolg",
  "Show card ranking": "Kartn-Rangfolg zoagn",
  "Hide card ranking": "Kartn-Rangfolg ausblendn",
  Help: "Hilfe",
  "Help On": "Hilfe o",
  Leave: "Rausgeh",
  Language: "Sproch",
  "Round winner": "Rundnsieger",
  "Match winner": "Gesamtsieger",
  "Next round": "Nächste Rundn",
  "3 tricks to win": "3 Stich zum Gwinna",
  "Game is loading...": "Spui werd glodn...",
  Back: "Zruck",
  "Your cards": "Deine Kartn",
  "Current trick": "Aktueller Stich",
  Continue: "Weida",
  "Three players. One plays solo, the other two form a team.":
    "Drei Spieler. Oana spuit allan, de andern zwoa san a Team.",
  Multiplayer: "Online-Spui",
  "Choose a game variant first, then create a private room or join an existing one.":
    "Such da erst d’Spuivariant aus und moch dann an privaten Raum auf oder geh in an bestehenden Raum eine.",
  "Number of players": "Spieleranzahl",
  "3 Players": "3 Spieler",
  "4 Players": "4 Spieler",
  "One solo player against a team of two.":
    "Oana spuit allan gegen zwoa im Team.",
  "Two fixed teams with partners sitting opposite each other.":
    "Zwoa feste Teams, de Partner sitzn se gegenüber.",
  "Team of 2": "2er-Team",
  "Signed in as": "Eigloggt ois",
  "You must be signed in to play multiplayer.":
    "Fürs Online-Spui muaßt eigloggt sei.",
  "3-player Watten": "3-Spieler-Watten",
  "4-player Watten": "4-Spieler-Watten",
  "Create a new room": "Neien Raum aufmocha",
  "Create a private room and share the six-character room code with the other players.":
    "Moch an privaten Raum auf und schick den sechsstelligen Raumcode an de andern Spieler.",
  Mode: "Modus",
  Room: "Raum",
  Private: "Privat",
  "1 vs 2": "1 gegen 2",
  "2 vs 2": "2 gegen 2",
  "Creating room...": "Raum werd aufgmocht...",
  "Create 4-player room": "4-Spieler-Raum aufmocha",
  "Join an existing game": "Bei am bestehenden Spui mitspuin",
  "Choose the same game mode as the host above, then enter the room code.":
    "Such oben denselben Modus wia da Host aus und gib dann sein Raumcode ei.",
  Selected: "Ausgwählt",
  "Opening room...": "Raum werd göffnet...",
  "Join 4-player room": "Bei am 4-Spieler-Raum mitspuin",
  "You must be signed in.": "Du muaßt eigloggt sei.",
  "Please enter a room code.": "Gib bittschee an Raumcode ei.",
  "The room code must contain 6 characters.": "Da Raumcode muaß 6 Zeichn ham.",
  "The server did not return a room code.":
    "Da Server hod koan Raumcode zruckgem.",
  "The room could not be created.": "Da Raum hod ned aufgmocht werdn kenna.",
  "This room is already full.": "Da Raum is scho vui.",
  "This room could not be found.": "Da Raum is ned gfundn worn.",
  "This game has already started.": "Des Spui hod scho ogfangt.",
  "You have already joined this room.": "Du bist in dem Raum scho drin.",
  "Could not join room.": "Beitritt hod ned klappt.",
};

const ko: Record<string, string> = {
  "Bavarian Watten": "바이에른 바튼",
  "3 Player Multiplayer": "3인 멀티플레이",
  "Create room": "방 만들기",
  "Join room": "방 참가",
  "Create 3-player room": "3인 방 만들기",
  "Join 3-player room": "3인 방 참가",
  "Room code": "방 코드",
  "Target score": "목표 점수",
  "Sign in required": "로그인이 필요합니다",
  "Multiplayer uses your Supabase account.":
    "멀티플레이는 Supabase 계정을 사용합니다.",
  "Waiting for players": "플레이어 대기 중",
  "players connected": "명 연결됨",
  "Share this room code. The game starts automatically when all three players have joined.":
    "이 방 코드를 공유하세요. 세 명이 모두 참가하면 자동으로 게임이 시작됩니다.",
  "Click this box to copy the code": "이 상자를 클릭하면 코드가 복사됩니다",
  "Copied to clipboard": "클립보드에 복사됨",
  Players: "플레이어",
  Round: "라운드",
  "Solo player": "솔로 플레이어",
  Opponents: "상대 팀",
  Dealer: "딜러",
  Cutter: "컷 플레이어",
  "Your turn": "내 차례",
  Waiting: "대기",
  Cards: "카드",
  Tricks: "트릭",
  Points: "점수",
  "Round value": "라운드 점수",
  "Raise to": "점수 올리기",
  Hold: "받기",
  Decline: "거절",
  "Choose trump": "트럼프 선택",
  "Choose rank": "Schlag 선택",
  "Choose the trump suit.": "트럼프 무늬를 선택하세요.",
  "Choose the Schlag rank.": "Schlag 랭크를 선택하세요.",
  Abheben: "컷",
  "Choose a cut position": "카드를 자를 위치를 선택하세요",
  "You are cutting the deck.": "당신이 덱을 자릅니다.",
  "Waiting for the cutter.": "컷 플레이어를 기다리는 중입니다.",
  "Game table": "게임 테이블",
  "Current player": "현재 플레이어",
  "Card ranking": "카드 순위",
  "Show card ranking": "카드 순위 보기",
  "Hide card ranking": "카드 순위 숨기기",
  Help: "도움말",
  "Help On": "도움말 켜짐",
  Leave: "나가기",
  Language: "언어",
  Trump: "트럼프",
  Schlag: "Schlag",
  "Round winner": "라운드 승자",
  "Match winner": "최종 승자",
  "Next round": "다음 라운드",
  "3 tricks to win": "3트릭 선취",
  Solo: "솔로",
  Team: "팀",
  "Game is loading...": "게임 로딩 중...",
  Back: "뒤로",
  "You must play trump or a critical card.":
    "트럼프 또는 크리티컬 카드를 내야 합니다.",
  "Trumpf oder Kritisch": "트럼프 또는 크리티컬",
  "Your cards": "내 카드",
  "Opponent cards": "상대 카드",
  "Current trick": "현재 트릭",
  Continue: "계속",
  "Game starts automatically.": "게임은 자동으로 시작됩니다.",
  Beginner: "초보자 도움말",
  "Highest priority first.": "위에서부터 우선순위가 높습니다.",
  "Critical cards": "크리티컬 카드",
  "Main Schlag": "메인 Schlag",
  "Other Schlag cards": "기타 Schlag",
  "Trump cards": "트럼프 카드",
  "Normal cards": "일반 카드",
  "Connection error": "연결 오류",
  "Could not copy room code.": "방 코드를 복사할 수 없습니다.",
  "Room not found.": "방을 찾을 수 없습니다.",
  "You are not a player in this room.": "이 방의 플레이어가 아닙니다.",
  "Three players. One plays solo, the other two form a team.":
    "세 명 중 한 명은 솔로로, 나머지 두 명은 한 팀으로 플레이합니다.",
  Multiplayer: "멀티플레이",
  "Choose a game variant first, then create a private room or join an existing one.":
    "먼저 게임 방식을 선택한 다음 비공개 방을 만들거나 기존 방에 참가하세요.",
  "Number of players": "플레이어 수",
  "3 Players": "3명",
  "4 Players": "4명",
  "One solo player against a team of two.":
    "한 명의 솔로 플레이어가 두 명으로 이루어진 팀과 대결합니다.",
  "Two fixed teams with partners sitting opposite each other.":
    "서로 마주 보는 파트너로 구성된 두 고정 팀이 대결합니다.",
  "Team of 2": "2인 팀",
  "Signed in as": "로그인 계정",
  "You must be signed in to play multiplayer.":
    "멀티플레이를 하려면 로그인해야 합니다.",
  "3-player Watten": "3인 바튼",
  "4-player Watten": "4인 바튼",
  "Create a new room": "새 방 만들기",
  "Create a private room and share the six-character room code with the other players.":
    "비공개 방을 만든 뒤 6자리 방 코드를 다른 플레이어와 공유하세요.",
  Mode: "모드",
  Room: "방",
  Private: "비공개",
  "1 vs 2": "1 대 2",
  "2 vs 2": "2 대 2",
  "Creating room...": "방 만드는 중...",
  "Create 4-player room": "4인 방 만들기",
  "Join an existing game": "기존 게임 참가",
  "Choose the same game mode as the host above, then enter the room code.":
    "위에서 방장과 같은 게임 모드를 선택한 다음 방 코드를 입력하세요.",
  Selected: "선택됨",
  "Opening room...": "방 여는 중...",
  "Join 4-player room": "4인 방 참가",
  "You must be signed in.": "로그인이 필요합니다.",
  "Please enter a room code.": "방 코드를 입력하세요.",
  "The room code must contain 6 characters.": "방 코드는 6자리여야 합니다.",
  "The server did not return a room code.":
    "서버가 방 코드를 반환하지 않았습니다.",
  "The room could not be created.": "방을 만들 수 없습니다.",
  "This room is already full.": "이 방은 이미 가득 찼습니다.",
  "This room could not be found.": "이 방을 찾을 수 없습니다.",
  "This game has already started.": "이 게임은 이미 시작되었습니다.",
  "You have already joined this room.": "이미 이 방에 참가했습니다.",
  "Could not join room.": "방에 참가할 수 없습니다.",
};

const ru: Record<string, string> = {
  "Bavarian Watten": "Баварский ваттен",
  "3 Player Multiplayer": "3 игрока · Онлайн",
  "Create room": "Создать комнату",
  "Join room": "Войти в комнату",
  "Create 3-player room": "Создать комнату на 3 игроков",
  "Join 3-player room": "Войти в комнату на 3 игроков",
  "Room code": "Код комнаты",
  "Target score": "Целевой счёт",
  "Sign in required": "Требуется вход",
  "Multiplayer uses your Supabase account.":
    "Мультиплеер использует вашу учётную запись Supabase.",
  "Waiting for players": "Ожидание игроков",
  "players connected": "игроков подключено",
  "Share this room code. The game starts automatically when all three players have joined.":
    "Поделитесь кодом комнаты. Игра начнётся автоматически, когда войдут все три игрока.",
  "Click this box to copy the code": "Нажмите, чтобы скопировать код",
  "Copied to clipboard": "Скопировано",
  Players: "Игроки",
  Round: "Раунд",
  "Solo player": "Одиночный игрок",
  Opponents: "Соперники",
  Dealer: "Сдающий",
  Cutter: "Снимающий",
  "Your turn": "Ваш ход",
  Waiting: "Ожидание",
  Cards: "Карты",
  Tricks: "Взятки",
  Points: "Очки",
  "Round value": "Цена раунда",
  "Raise to": "Повысить до",
  Hold: "Принять",
  Decline: "Отказаться",
  "Choose trump": "Выбрать козырь",
  "Choose rank": "Выбрать Schlag",
  "Choose the trump suit.": "Выберите козырную масть.",
  "Choose the Schlag rank.": "Выберите ранг Schlag.",
  Abheben: "Снятие",
  "Choose a cut position": "Выберите место снятия",
  "You are cutting the deck.": "Вы снимаете колоду.",
  "Waiting for the cutter.": "Ожидание снимающего.",
  "Game table": "Игровой стол",
  "Current player": "Текущий игрок",
  "Card ranking": "Порядок карт",
  "Show card ranking": "Показать порядок карт",
  "Hide card ranking": "Скрыть порядок карт",
  Help: "Помощь",
  "Help On": "Помощь включена",
  Leave: "Выйти",
  Language: "Язык",
  Trump: "Козырь",
  Schlag: "Schlag",
  "Round winner": "Победитель раунда",
  "Match winner": "Победитель матча",
  "Next round": "Следующий раунд",
  "3 tricks to win": "3 взятки для победы",
  Solo: "Соло",
  Team: "Команда",
  "Game is loading...": "Игра загружается...",
  Back: "Назад",
  "You must play trump or a critical card.":
    "Нужно сыграть козырь или критическую карту.",
  "Your cards": "Ваши карты",
  "Current trick": "Текущая взятка",
  Continue: "Продолжить",
  "Three players. One plays solo, the other two form a team.":
    "Три игрока: один играет один, двое остальных образуют команду.",
  Multiplayer: "Мультиплеер",
  "Choose a game variant first, then create a private room or join an existing one.":
    "Сначала выберите вариант игры, затем создайте приватную комнату или присоединитесь к существующей.",
  "Number of players": "Количество игроков",
  "3 Players": "3 игрока",
  "4 Players": "4 игрока",
  "One solo player against a team of two.":
    "Один игрок играет в одиночку против команды из двух игроков.",
  "Two fixed teams with partners sitting opposite each other.":
    "Две постоянные команды, партнёры сидят друг напротив друга.",
  "Team of 2": "Команда из 2",
  "Signed in as": "Вы вошли как",
  "You must be signed in to play multiplayer.":
    "Для мультиплеера необходимо войти в аккаунт.",
  "3-player Watten": "Ваттен на 3 игроков",
  "4-player Watten": "Ваттен на 4 игроков",
  "Create a new room": "Создать новую комнату",
  "Create a private room and share the six-character room code with the other players.":
    "Создайте приватную комнату и поделитесь шестизначным кодом комнаты с другими игроками.",
  Mode: "Режим",
  Room: "Комната",
  Private: "Приватная",
  "1 vs 2": "1 против 2",
  "2 vs 2": "2 против 2",
  "Creating room...": "Создание комнаты...",
  "Create 4-player room": "Создать комнату на 4 игроков",
  "Join an existing game": "Присоединиться к существующей игре",
  "Choose the same game mode as the host above, then enter the room code.":
    "Выберите выше тот же режим игры, что и у хозяина комнаты, затем введите код комнаты.",
  Selected: "Выбрано",
  "Opening room...": "Открытие комнаты...",
  "Join 4-player room": "Войти в комнату на 4 игроков",
  "You must be signed in.": "Необходимо войти в аккаунт.",
  "Please enter a room code.": "Введите код комнаты.",
  "The room code must contain 6 characters.":
    "Код комнаты должен содержать 6 символов.",
  "The server did not return a room code.": "Сервер не вернул код комнаты.",
  "The room could not be created.": "Не удалось создать комнату.",
  "This room is already full.": "Эта комната уже заполнена.",
  "This room could not be found.": "Эта комната не найдена.",
  "This game has already started.": "Эта игра уже началась.",
  "You have already joined this room.": "Вы уже присоединились к этой комнате.",
  "Could not join room.": "Не удалось войти в комнату.",
};

const rulebookTranslations: Partial<
  Partial<Record<WattenLanguage, Record<string, string>>>
> = {
  de: {
    Design: "Design",
    Gehen: "Gehen",
    "A round starts at a value of": "Eine Runde beginnt mit einem Wert von",
    "2 points": "2 Punkten",
    "The goal is to win a round through tricks and earn points for the overall score.":
      "Ziel ist es, eine Runde durch Stiche zu gewinnen und dadurch Punkte für die Gesamtwertung zu erhalten.",
    "A round normally has up to five tricks. The first side to reach the required majority wins the round.":
      "Eine Runde wird normalerweise über bis zu fünf Stiche entschieden. Wer zuerst die notwendige Mehrheit erreicht, gewinnt die Runde.",
    "Basic idea:": "Grundidee:",
    "Strong cards help, but suit, Schlag, critical cards and tactical calls often determine which card actually wins.":
      "Gute Karten helfen – aber Farbe, Schlag, Kritische und taktische Ansagen bestimmen oft, welche Karte tatsächlich gewinnt.",
    "Each player plays one card per trick. The winning card is then determined.":
      "Jeder Spieler legt pro Stich eine Karte. Anschließend wird bestimmt, welche Karte den Stich gewinnt.",
    "Card priority is decisive:": "Entscheidend ist dabei die Kartenpriorität:",
    "The winner of a trick leads the next trick. There is no fixed order between different suits; the led suit matters, and within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.":
      "Der Gewinner eines Stichs spielt den nächsten Stich aus. Zwischen verschiedenen Farben gibt es keine feste Reihenfolge; es zählt die angespielte Farbe. Innerhalb dieser Farbe gilt: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.",
    "There is no fixed order between different suits. The led suit matters; within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.":
      "Zwischen verschiedenen Farben gibt es keine feste Reihenfolge. Es zählt die angespielte Farbe; innerhalb dieser Farbe gilt: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.",
    "With “Gehen”, one side can try to raise the value of the round.":
      "Durch „Gehen“ kann eine Seite versuchen, den Rundenwert zu erhöhen.",
    "The opposing side can": "Die Gegenseite kann den höheren Wert",
    " hold": " halten",
    ". The round then continues at the new value.":
      ". Dann wird um den neuen Wert weitergespielt.",
    "If the raise is declined, the raising side wins the round at the previously accepted round value.":
      "Wird nicht gehalten, gewinnt die Seite, die erhöht hat, die Runde zum bisher gültigen Rundenwert.",
    "The deck is cut before the cards are dealt.":
      "Vor dem eigentlichen Austeilen wird abgehoben.",
    "The cutter sits to the right of the dealer.":
      "Der Abheber befindet sich rechts vom Geber.",
    "A card is revealed when cutting. If it is critical, the cutter receives it. A normal card ends the cutting sequence.":
      "Beim Abheben wird eine Karte aufgedeckt. Ist sie kritisch, erhält der Abheber die Karte. Eine normale Karte beendet das Abheben.",
    "The deck is split at the chosen position. Critical cards can already be distributed while revealing before the remaining cards are dealt.":
      "Der Stapel wird an einer gewählten Stelle getrennt. Kritische Karten können beim Aufdecken bereits verteilt werden, bevor die restlichen Karten ausgegeben werden.",
    "Cards are then dealt until every player has five cards in total.":
      "Danach wird so ausgeteilt, dass jeder Spieler insgesamt fünf Karten besitzt.",
    "This special rule can be activated in the first trick by the":
      "Diese Sonderregel kann im ersten Stich durch den",
    "Main Schlag": "Hauptschlag",
    "being played.": "aktiviert werden.",
    "When the Main Schlag is played:": "Wird der Hauptschlag ausgespielt:",
    "Players who hold a trump or critical card must play one of those cards.":
      "Spieler, die einen Trumpf oder eine Kritische besitzen, müssen eine solche Karte spielen.",
    "If a player has neither trump nor a critical card, they may freely choose another card.":
      "Besitzt ein Spieler weder Trumpf noch Kritische, darf er frei eine andere Karte wählen.",
    "The three critical cards are at the top of the card ranking.":
      "Die drei Kritischen stehen an der Spitze der Kartenrangfolge.",
    "Therefore:": "Damit gilt:",
    "The Main Schlag is created by combining":
      "Der Hauptschlag entsteht aus der Kombination von",
    Trump: "Trumpf",
    and: "und",
    Example: "Beispiel",
    "is the Main Schlag.": "ist der Hauptschlag.",
    "The Main Schlag ranks directly below the critical cards and above all ordinary Schlag and trump cards.":
      "Der Hauptschlag steht unmittelbar unter den Kritischen und über allen gewöhnlichen Schlägen und Trumpfkarten.",
    "In the first trick, the Main Schlag can also activate the “Trump or Critical” rule.":
      "Im ersten Stich kann der Hauptschlag außerdem die Regel „Trumpf oder Kritisch“ aktivieren.",
    "Schlag is a selected card rank, for example Ober, King or 9.":
      "Der Schlag ist ein bestimmter Kartenrang, zum Beispiel Ober, König oder 9.",
    "All cards of this rank become Schlag cards.":
      "Alle Karten dieses Rangs werden zu Schlägen.",
    "Important:": "Wichtig:",
    "The normal Schlag cards are equal in strength. If two equal Schlag cards are played, the one played first wins.":
      "Die normalen Schläge besitzen untereinander dieselbe Stärke. Werden zwei gleichwertige Schläge gespielt, gewinnt der zuerst gespielte.",
    "The selected suit is the trump suit for the round.":
      "Die gewählte Farbe ist die Trumpffarbe der Runde.",
    "Trump cards rank below Schlag cards but above ordinary cards.":
      "Trumpfkarten stehen unterhalb der Schläge, sind aber stärker als gewöhnliche Karten.",
    "Normal cards are neither critical cards, Main Schlag, Schlag nor trump.":
      "Normale Karten sind weder Kritische noch Hauptschlag, Schlag oder Trumpf.",
    "There is no general priority between different normal suits.":
      "Zwischen verschiedenen normalen Farben besteht keine allgemeine Trumpf-Priorität.",
    "Configure example": "Beispiel konfigurieren",
    "Choose trump and Schlag. The ranking below updates automatically.":
      "Wähle Trumpf und Schlag. Die Rangfolge darunter wird automatisch angepasst.",
    "Suit + Schlag": "Farbe + Schlag",
    "With this combination, the corresponding card is already a critical card.":
      "Bei dieser Kombination fällt die entsprechende Karte bereits unter die Kritischen.",
    "If cards have equal strength, the one played first wins.":
      "Bei gleicher Stärke gewinnt die zuerst gespielte Karte.",
    "Remaining trump cards": "Übrige Trumpfkarten",
    Herz: "Herz",
    Schellen: "Schellen",
    Eichel: "Eichel",
    Gras: "Gras",
    Ass: "Ass",
    König: "König",
    Ober: "Ober",
    Unter: "Unter",
    "Rules, card ranking and an interactive example for suit, Schlag and card priority.":
      "Regeln, Kartenrangfolge und ein interaktives Beispiel für Farbe, Schlag und Kartenpriorität.",
  },
  bar: {
    Design: "Design",
    Gehen: "Gehn",
    "A round starts at a value of": "D'Rundn fangt mit am Wert vo",
    "2 points": "2 Punkt",
    "Basic idea:": "Grundidee:",
    "Configure example": "Beispui einstelln",
    "Choose trump and Schlag. The ranking below updates automatically.":
      "Such Trumpf und Schlag aus. De Rangfolg drunter passt si automatisch o.",
    Example: "Beispui",
    "Important:": "Wichtig:",
    "Remaining trump cards": "Übrige Trumpfkartn",
    Herz: "Herz",
    Schellen: "Schellen",
    Eichel: "Eichel",
    Gras: "Gras",
    Ass: "Ass",
    König: "König",
    Ober: "Ober",
    Unter: "Unter",
    "Trumpf oder Kritisch": "Trumpf oder Kritisch",
  },
  ko: {
    Design: "디자인",
    Gehen: "Gehen",
    "A round starts at a value of": "라운드는 다음 점수로 시작합니다:",
    "2 points": "2점",
    "The goal is to win a round through tricks and earn points for the overall score.":
      "트릭을 따서 라운드에서 승리하고, 그 결과 전체 점수에 포인트를 얻는 것이 목표입니다.",
    "A round normally has up to five tricks. The first side to reach the required majority wins the round.":
      "한 라운드는 보통 최대 5개의 트릭으로 진행됩니다. 필요한 과반수의 트릭을 먼저 얻는 쪽이 라운드에서 승리합니다.",
    "Basic idea:": "기본 개념:",
    "Strong cards help, but suit, Schlag, critical cards and tactical calls often determine which card actually wins.":
      "강한 카드도 중요하지만, 무늬, Schlag, 크리티컬 카드와 전술적 선언이 실제 승패를 좌우하는 경우가 많습니다.",
    "Each player plays one card per trick. The winning card is then determined.":
      "각 플레이어는 한 트릭에 카드 한 장을 냅니다. 이후 어떤 카드가 트릭에서 이겼는지 결정합니다.",
    "Card priority is decisive:": "카드 우선순위가 핵심입니다:",
    "The winner of a trick leads the next trick. There is no fixed order between different suits; the led suit matters, and within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.":
      "트릭의 승자가 다음 트릭을 선도합니다. 서로 다른 일반 무늬 사이에는 고정된 우선순위가 없고, 먼저 나온 무늬가 중요합니다. 그 무늬 안에서는 에이스 → 킹 → 오버 → 운터 → 10 → 9 → 8 → 7 순입니다.",
    "There is no fixed order between different suits. The led suit matters; within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.":
      "서로 다른 일반 무늬 사이에는 고정된 우선순위가 없습니다. 먼저 나온 무늬가 중요하며, 그 무늬 안에서는 에이스 → 킹 → 오버 → 운터 → 10 → 9 → 8 → 7 순입니다.",
    "With “Gehen”, one side can try to raise the value of the round.":
      "‘Gehen’을 통해 한쪽이 라운드 점수를 올릴 수 있습니다.",
    "The opposing side can": "상대편은 더 높은 점수를",
    " hold": " 받아들일 수 있습니다",
    ". The round then continues at the new value.":
      ". 그러면 새 점수로 라운드를 계속합니다.",
    "If the raise is declined, the raising side wins the round at the previously accepted round value.":
      "상대가 받지 않으면 Gehen을 건 쪽이 이전에 확정된 라운드 점수로 라운드에서 승리합니다.",
    "The deck is cut before the cards are dealt.":
      "카드를 나누기 전에 덱을 컷합니다.",
    "The cutter sits to the right of the dealer.":
      "컷 플레이어는 딜러의 오른쪽에 있습니다.",
    "A card is revealed when cutting. If it is critical, the cutter receives it. A normal card ends the cutting sequence.":
      "컷할 때 카드 한 장을 공개합니다. 크리티컬 카드면 컷 플레이어가 그 카드를 받고, 일반 카드가 나오면 컷 과정이 끝납니다.",
    "The deck is split at the chosen position. Critical cards can already be distributed while revealing before the remaining cards are dealt.":
      "선택한 위치에서 덱을 나눕니다. 공개 과정에서 크리티컬 카드가 나오면 나머지 카드를 나누기 전에 먼저 배분될 수 있습니다.",
    "Cards are then dealt until every player has five cards in total.":
      "그 다음 모든 플레이어가 총 5장의 카드를 갖도록 나눕니다.",
    "This special rule can be activated in the first trick by the":
      "이 특별 규칙은 첫 번째 트릭에서",
    "Main Schlag": "메인 Schlag",
    "being played.": "가 선도되면 활성화될 수 있습니다.",
    "When the Main Schlag is played:": "메인 Schlag가 선도되면:",
    "Players who hold a trump or critical card must play one of those cards.":
      "트럼프 또는 크리티컬 카드를 가진 플레이어는 그중 하나를 반드시 내야 합니다.",
    "If a player has neither trump nor a critical card, they may freely choose another card.":
      "트럼프도 크리티컬 카드도 없다면 다른 카드를 자유롭게 낼 수 있습니다.",
    "The three critical cards are at the top of the card ranking.":
      "세 장의 크리티컬 카드는 카드 우선순위의 최상위입니다.",
    "Therefore:": "따라서:",
    "The Main Schlag is created by combining":
      "메인 Schlag는 다음 두 요소의 조합으로 결정됩니다:",
    Trump: "트럼프",
    and: "그리고",
    Example: "예시",
    "is the Main Schlag.": "가 메인 Schlag입니다.",
    "The Main Schlag ranks directly below the critical cards and above all ordinary Schlag and trump cards.":
      "메인 Schlag는 크리티컬 카드 바로 아래이며, 모든 일반 Schlag와 트럼프 카드보다 높습니다.",
    "In the first trick, the Main Schlag can also activate the “Trump or Critical” rule.":
      "첫 번째 트릭에서 메인 Schlag는 ‘트럼프 또는 크리티컬’ 규칙도 활성화할 수 있습니다.",
    "Schlag is a selected card rank, for example Ober, King or 9.":
      "Schlag는 선택된 카드 랭크로, 예를 들면 오버, 킹 또는 9입니다.",
    "All cards of this rank become Schlag cards.":
      "선택된 랭크의 모든 카드는 Schlag가 됩니다.",
    "Important:": "중요:",
    "The normal Schlag cards are equal in strength. If two equal Schlag cards are played, the one played first wins.":
      "일반 Schlag끼리는 강도가 같습니다. 같은 강도의 Schlag가 둘 이상 나오면 먼저 나온 카드가 이깁니다.",
    "The selected suit is the trump suit for the round.":
      "선택된 무늬가 해당 라운드의 트럼프 무늬입니다.",
    "Trump cards rank below Schlag cards but above ordinary cards.":
      "트럼프 카드는 Schlag보다 낮지만 일반 카드보다 높습니다.",
    "Normal cards are neither critical cards, Main Schlag, Schlag nor trump.":
      "일반 카드는 크리티컬, 메인 Schlag, Schlag, 트럼프에 해당하지 않는 카드입니다.",
    "There is no general priority between different normal suits.":
      "서로 다른 일반 무늬 사이에는 전반적인 우선순위가 없습니다.",
    "Configure example": "예시 설정",
    "Choose trump and Schlag. The ranking below updates automatically.":
      "트럼프와 Schlag를 선택하세요. 아래 순위가 자동으로 갱신됩니다.",
    "Suit + Schlag": "무늬 + Schlag",
    "With this combination, the corresponding card is already a critical card.":
      "이 조합에서는 해당 카드가 이미 크리티컬 카드에 속합니다.",
    "If cards have equal strength, the one played first wins.":
      "카드의 강도가 같으면 먼저 나온 카드가 이깁니다.",
    "Remaining trump cards": "나머지 트럼프 카드",
    Herz: "하트",
    Schellen: "방울",
    Eichel: "도토리",
    Gras: "잎",
    Ass: "에이스",
    König: "킹",
    Ober: "오버",
    Unter: "운터",
  },
  ru: {
    Design: "Дизайн",
    Gehen: "Gehen",
    "A round starts at a value of": "Раунд начинается со значения",
    "2 points": "2 очка",
    "The goal is to win a round through tricks and earn points for the overall score.":
      "Цель — выиграть раунд по взяткам и получить за это очки в общем счёте.",
    "A round normally has up to five tricks. The first side to reach the required majority wins the round.":
      "Раунд обычно состоит максимум из пяти взяток. Сторона, первой набравшая необходимое большинство взяток, выигрывает раунд.",
    "Basic idea:": "Основная идея:",
    "Strong cards help, but suit, Schlag, critical cards and tactical calls often determine which card actually wins.":
      "Сильные карты помогают, но масть, Schlag, критические карты и тактические объявления часто определяют, какая карта действительно выигрывает.",
    "Each player plays one card per trick. The winning card is then determined.":
      "В каждой взятке каждый игрок кладёт одну карту, после чего определяется победившая карта.",
    "Card priority is decisive:": "Решающим является приоритет карт:",
    "The winner of a trick leads the next trick. There is no fixed order between different suits; the led suit matters, and within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.":
      "Победитель взятки начинает следующую. Между обычными мастями нет постоянного порядка: важна масть первой карты. Внутри этой масти порядок такой: туз → король → обер → унтер → 10 → 9 → 8 → 7.",
    "There is no fixed order between different suits. The led suit matters; within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.":
      "Между обычными мастями нет постоянного порядка. Важна масть первой карты; внутри неё: туз → король → обер → унтер → 10 → 9 → 8 → 7.",
    "With “Gehen”, one side can try to raise the value of the round.":
      "С помощью «Gehen» одна из сторон может попытаться повысить стоимость раунда.",
    "The opposing side can": "Противоположная сторона может",
    " hold": " принять повышение",
    ". The round then continues at the new value.":
      ". После этого игра продолжается с новым значением.",
    "If the raise is declined, the raising side wins the round at the previously accepted round value.":
      "Если повышение отклонено, поднявшая сторона выигрывает раунд по ранее принятой стоимости.",
    "The deck is cut before the cards are dealt.":
      "Перед раздачей колоду снимают.",
    "The cutter sits to the right of the dealer.":
      "Снимающий сидит справа от сдающего.",
    "A card is revealed when cutting. If it is critical, the cutter receives it. A normal card ends the cutting sequence.":
      "При снятии открывается одна карта. Если она критическая, снимающий получает её; обычная карта завершает снятие.",
    "The deck is split at the chosen position. Critical cards can already be distributed while revealing before the remaining cards are dealt.":
      "Колода разделяется в выбранном месте. Критические карты могут быть распределены уже во время открытия, до раздачи остальных карт.",
    "Cards are then dealt until every player has five cards in total.":
      "Затем карты раздаются так, чтобы у каждого игрока было по пять карт.",
    "This special rule can be activated in the first trick by the":
      "Это специальное правило может быть активировано в первой взятке, если сыгран",
    "Main Schlag": "Главный Schlag",
    "being played.": ".",
    "When the Main Schlag is played:": "Когда первым сыгран главный Schlag:",
    "Players who hold a trump or critical card must play one of those cards.":
      "Игроки, у которых есть козырь или критическая карта, обязаны сыграть одну из них.",
    "If a player has neither trump nor a critical card, they may freely choose another card.":
      "Если у игрока нет ни козыря, ни критической карты, он может свободно выбрать другую карту.",
    "The three critical cards are at the top of the card ranking.":
      "Три критические карты находятся на вершине порядка карт.",
    "Therefore:": "Следовательно:",
    "The Main Schlag is created by combining":
      "Главный Schlag образуется сочетанием",
    Trump: "Козырь",
    and: "и",
    Example: "Пример",
    "is the Main Schlag.": "— главный Schlag.",
    "The Main Schlag ranks directly below the critical cards and above all ordinary Schlag and trump cards.":
      "Главный Schlag стоит сразу под критическими картами и выше всех обычных Schlag и козырей.",
    "In the first trick, the Main Schlag can also activate the “Trump or Critical” rule.":
      "В первой взятке главный Schlag также может активировать правило «Козырь или критическая».",
    "Schlag is a selected card rank, for example Ober, King or 9.":
      "Schlag — это выбранный ранг карты, например обер, король или 9.",
    "All cards of this rank become Schlag cards.":
      "Все карты этого ранга становятся Schlag.",
    "Important:": "Важно:",
    "The normal Schlag cards are equal in strength. If two equal Schlag cards are played, the one played first wins.":
      "Обычные Schlag равны по силе. Если сыграны две равные карты Schlag, выигрывает сыгранная первой.",
    "The selected suit is the trump suit for the round.":
      "Выбранная масть становится козырной мастью раунда.",
    "Trump cards rank below Schlag cards but above ordinary cards.":
      "Козыри стоят ниже Schlag, но выше обычных карт.",
    "Normal cards are neither critical cards, Main Schlag, Schlag nor trump.":
      "Обычные карты не являются ни критическими, ни главным Schlag, ни Schlag, ни козырями.",
    "There is no general priority between different normal suits.":
      "Между разными обычными мастями нет общего приоритета.",
    "Configure example": "Настроить пример",
    "Choose trump and Schlag. The ranking below updates automatically.":
      "Выберите козырь и Schlag. Порядок ниже обновится автоматически.",
    "Suit + Schlag": "Масть + Schlag",
    "With this combination, the corresponding card is already a critical card.":
      "При этой комбинации соответствующая карта уже является критической.",
    "If cards have equal strength, the one played first wins.":
      "Если карты равны по силе, выигрывает сыгранная первой.",
    "Remaining trump cards": "Остальные козыри",
    Herz: "Червы",
    Schellen: "Бубенцы",
    Eichel: "Жёлуди",
    Gras: "Листья",
    Ass: "Туз",
    König: "Король",
    Ober: "Обер",
    Unter: "Унтер",
    "Other Schlag cards": "Другие карты Schlag",
    "Trumpf oder Kritisch": "Козырь или критическая карта",
  },
  en: {
    Herz: "Hearts",
    Schellen: "Bells",
    Eichel: "Acorns",
    Gras: "Leaves",
    Ass: "Ace",
    König: "King",
    Ober: "Ober",
    Unter: "Unter",
  },
};

const extraTranslations: Partial<
  Partial<Record<WattenLanguage, Record<string, string>>>
> = {
  de: {
    "How would you like to play?": "Wie möchtest du spielen?",
    Local: "Lokal",
    "Play together on one device. After each turn, simply pass the device to the next player.":
      "Spielt gemeinsam an einem Gerät. Nach jedem Zug wird das Gerät einfach an den nächsten Spieler weitergegeben.",
    "One device · Multiple players": "Ein Gerät · Mehrere Spieler",
    Play: "Spielen",
    "Create a private game and invite your friends with a game code.":
      "Erstelle eine private Partie und lade deine Freunde mit einem Spielcode ein.",
    "Multiple devices · Online": "Mehrere Geräte · Online",
    Rules: "Spielregeln",
    "Choose the game variant first.": "Wählt zuerst die Spielvariante.",
    "Player names": "Spielernamen",
    "Start game": "Spiel starten",
    Overview: "Übersicht",
    Cards: "Karten",
    "Customize how the rules are displayed": "Darstellung der Regeln anpassen",
    "Game rules": "Spielregeln",
    "Rules, card ranking and an interactive example for suit, Schlag and card priority.":
      "Regeln, Kartenrangfolge und ein interaktives Beispiel für Farbe, Schlag und Kartenpriorität.",
    "Goal of the game": "Ziel des Spiels",
    Tricks: "Stiche",
    "Start value": "Startwert",
    "first raise": "erstes Gehen",
    maximum: "maximal",
    "3 Players": "3 Spieler",
    "4 Players": "4 Spieler",
    "Critical cards": "Kritische Karten",
    "Trump / suit": "Farbe / Trumpf",
    "Normal cards": "Normale Karten",
    lower: "niedriger",
    stronger: "stärker",
    equal: "gleich",
    "highest priority": "höchste Priorität",
    "equal priority": "gleiche Priorität",
    Example: "Beispiel",
    "Why this card won": "Warum diese Karte gewonnen hat",
    "Lead suit": "Angespielte Farbe",
    "Trick winner": "Stich-Sieger",
    "No critical card": "Keine Kritische",
    "Cut finished": "Abheben beendet",
    "Next card...": "Nächste Karte...",
    "The final card stays visible briefly. Then the deck returns to the table.":
      "Die letzte Karte bleibt kurz sichtbar. Danach liegt der Stapel wieder auf dem Tisch.",
    "The revealed card stays visible briefly. Then the deck returns to the table.":
      "Die aufgedeckte Karte bleibt kurz sichtbar. Danach liegt der Stapel wieder auf dem Tisch.",
    "Card played.": "Karte gespielt.",
    Done: "Fertig",
    "Give the device to": "Gib das Gerät an",
    "Look at your cards": "Sieh dir deine Karten an",
    "Make sure nobody else can see the cards.":
      "Achte darauf, dass niemand sonst die Karten sieht.",
    "Make sure nobody else can see your cards.":
      "Achte darauf, dass niemand sonst deine Karten sieht.",
    "One of these three special cards can be drawn:":
      "Eine dieser drei Sonderkarten kann gezogen werden:",
    Partner: "Partner",
    "Pass the device": "Gerät weitergeben",
    "Pass the device to": "Gib das Gerät weiter an",
    "Player wants to see their cards": "Spieler möchte seine Karten ansehen",
    "Select your player and pass the device to them.":
      "Wähle deinen Spieler und gib ihm das Gerät.",
    "Special cards": "Sonderkarten",
    "Team A": "Team A",
    "Team B": "Team B",
    "These cards are only visible to you.":
      "Diese Karten sind nur für dich sichtbar.",
    VS: "VS",
    Vorhand: "Vorhand",
    "Schlag:": "Schlag:",
    Exit: "Verlassen",
    "I'm ready": "Ich bin bereit",
    "Ready?": "Bereit?",
    Score: "Punktestand",
    "No card in this category.": "Keine Karte in dieser Kategorie.",

    You: "Du",
  },
  bar: {
    "How would you like to play?": "Wia mogst spuin?",
    Local: "Lokal",
    "Play together on one device. After each turn, simply pass the device to the next player.":
      "Spuilts zamm auf oam Gerät. Nach jedem Zug gebts as Gerät oafach weiter.",
    "One device · Multiple players": "Oa Gerät · Mehrere Spieler",
    Play: "Spuin",
    "Create a private game and invite your friends with a game code.":
      "Moch a private Partie auf und lad deine Freind mit am Spuicode ei.",
    "Multiple devices · Online": "Mehrere Geräte · Online",
    Rules: "Spuiregeln",
    "Choose the game variant first.": "Suchts eich zerscht d’Spuivariant aus.",
    "Player names": "Spielernam",
    "Start game": "Spui startn",
    Overview: "Übersicht",
    Cards: "Kartn",
    "Customize how the rules are displayed": "Darstellung vo de Regeln anpassn",
    "Game rules": "Spuiregeln",
    "Goal of the game": "Ziel vom Spui",
    Tricks: "Stich",
    "Start value": "Startwert",
    "first raise": "erstes Gehen",
    maximum: "maximal",
    "Critical cards": "Kritische Kartn",
    "Trump / suit": "Trumpf / Farb",
    "Normal cards": "Normale Kartn",
    lower: "niedriger",
    stronger: "stärker",
    equal: "gleich",
    "highest priority": "höchste Priorität",
    "equal priority": "gleiche Priorität",
    Example: "Beispui",
    "Why this card won": "Warum de Kartn gwunna hod",
    "Lead suit": "Angspuite Farb",
    "Trick winner": "Stich-Sieger",
    "No critical card": "Koane Kritische",
    "Cut finished": "Abhebn fertig",
    "Next card...": "Nächste Kartn...",
    "Card played.": "Kartn gspuit.",
    Done: "Fertig",
    "Give the device to": "Gib as Gerät an",
    "Look at your cards": "Schaug deine Kartn o",
    "Make sure nobody else can see the cards.":
      "Pass auf, dass koana sonst de Kartn siacht.",
    "Make sure nobody else can see your cards.":
      "Pass auf, dass koana sonst deine Kartn siacht.",
    Partner: "Partner",
    "Pass the device": "Gerät weitergebn",
    "Pass the device to": "Gib as Gerät weiter an",
    "Special cards": "Sonderkartn",
    "Team A": "Team A",
    "Team B": "Team B",
    VS: "VS",
    Vorhand: "Vorhand",
    "Schlag:": "Schlag:",
    Exit: "Rausgeh",
    "I'm ready": "I bin bereit",
    "Ready?": "Bereit?",
    Score: "Punktestand",
    "No card in this category.": "Koane Kartn in dera Kategorie.",

    You: "Du",
  },
  ko: {
    "How would you like to play?": "어떻게 플레이하시겠어요?",
    Local: "로컬",
    "Play together on one device. After each turn, simply pass the device to the next player.":
      "한 기기에서 함께 플레이합니다. 각 턴이 끝나면 다음 플레이어에게 기기를 넘기세요.",
    "One device · Multiple players": "기기 1대 · 여러 플레이어",
    Play: "플레이",
    "Create a private game and invite your friends with a game code.":
      "비공개 게임을 만들고 게임 코드로 친구를 초대하세요.",
    "Multiple devices · Online": "여러 기기 · 온라인",
    Rules: "게임 규칙",
    "Choose the game variant first.": "먼저 게임 변형을 선택하세요.",
    "Player names": "플레이어 이름",
    "Start game": "게임 시작",
    Overview: "개요",
    Cards: "카드",
    "Customize how the rules are displayed": "규칙 화면의 디자인을 조정합니다",
    "Game rules": "게임 규칙",
    "Rules, card ranking and an interactive example for suit, Schlag and card priority.":
      "규칙, 카드 순위, 무늬·Schlag·카드 우선순위의 인터랙티브 예시입니다.",
    "Goal of the game": "게임 목표",
    Tricks: "트릭",
    "Start value": "시작 값",
    "first raise": "첫 번째 Gehen",
    maximum: "최대",
    "Critical cards": "크리티컬 카드",
    "Trump / suit": "트럼프 / 무늬",
    "Normal cards": "일반 카드",
    lower: "낮음",
    stronger: "더 강함",
    equal: "동일",
    "highest priority": "최우선",
    "equal priority": "동일 우선순위",
    Example: "예시",
    "Why this card won": "이 카드가 이긴 이유",
    "Lead suit": "선도 무늬",
    "Trick winner": "트릭 승자",
    "No critical card": "크리티컬 카드 없음",
    "Cut finished": "컷 완료",
    "Next card...": "다음 카드...",
    "The final card stays visible briefly. Then the deck returns to the table.":
      "마지막 카드를 잠시 보여준 뒤 덱이 테이블로 돌아갑니다.",
    "The revealed card stays visible briefly. Then the deck returns to the table.":
      "공개된 카드를 잠시 보여준 뒤 덱이 테이블로 돌아갑니다.",
    "Card played.": "카드를 냈습니다.",
    Done: "완료",
    "Give the device to": "기기를 다음 사람에게 주세요",
    "Look at your cards": "내 카드를 확인하세요",
    "Make sure nobody else can see the cards.":
      "다른 사람이 카드를 보지 못하게 하세요.",
    "Make sure nobody else can see your cards.":
      "다른 사람이 내 카드를 보지 못하게 하세요.",
    "One of these three special cards can be drawn:":
      "다음 세 특수 카드 중 하나가 나올 수 있습니다:",
    Partner: "파트너",
    "Pass the device": "기기 넘기기",
    "Pass the device to": "기기를 넘길 대상",
    "Player wants to see their cards": "플레이어가 자신의 카드를 보려고 합니다",
    "Select your player and pass the device to them.":
      "플레이어를 선택하고 기기를 넘겨주세요.",
    "Special cards": "특수 카드",
    "Team A": "팀 A",
    "Team B": "팀 B",
    "These cards are only visible to you.": "이 카드는 본인에게만 보입니다.",
    VS: "VS",
    Vorhand: "Vorhand",
    "Schlag:": "Schlag:",
    Exit: "나가기",
    "I'm ready": "준비됐어요",
    "Ready?": "준비됐나요?",
    Score: "점수",
    "No card in this category.": "이 범주에는 카드가 없습니다.",

    You: "나",
  },
  ru: {
    "How would you like to play?": "Как вы хотите играть?",
    Local: "Локально",
    "Play together on one device. After each turn, simply pass the device to the next player.":
      "Играйте вместе на одном устройстве. После каждого хода передавайте устройство следующему игроку.",
    "One device · Multiple players": "Одно устройство · Несколько игроков",
    Play: "Играть",
    "Create a private game and invite your friends with a game code.":
      "Создайте приватную игру и пригласите друзей с помощью игрового кода.",
    "Multiple devices · Online": "Несколько устройств · Онлайн",
    Rules: "Правила",
    "Choose the game variant first.": "Сначала выберите вариант игры.",
    "Player names": "Имена игроков",
    "Start game": "Начать игру",
    Overview: "Обзор",
    Cards: "Карты",
    "Customize how the rules are displayed": "Настройте отображение правил",
    "Game rules": "Правила игры",
    "Rules, card ranking and an interactive example for suit, Schlag and card priority.":
      "Правила, порядок карт и интерактивный пример масти, Schlag и приоритета карт.",
    "Goal of the game": "Цель игры",
    Tricks: "Взятки",
    "Start value": "Начальное значение",
    "first raise": "первое повышение",
    maximum: "максимум",
    "Critical cards": "Критические карты",
    "Trump / suit": "Козырь / масть",
    "Normal cards": "Обычные карты",
    lower: "ниже",
    stronger: "сильнее",
    equal: "равно",
    "highest priority": "высший приоритет",
    "equal priority": "равный приоритет",
    Example: "Пример",
    "Why this card won": "Почему эта карта выиграла",
    "Lead suit": "Первая масть",
    "Trick winner": "Победитель взятки",
    "No critical card": "Нет критической карты",
    "Cut finished": "Снятие завершено",
    "Next card...": "Следующая карта...",
    "The final card stays visible briefly. Then the deck returns to the table.":
      "Последняя карта ненадолго остаётся видимой, затем колода возвращается на стол.",
    "The revealed card stays visible briefly. Then the deck returns to the table.":
      "Открытая карта ненадолго остаётся видимой, затем колода возвращается на стол.",
    "Card played.": "Карта сыграна.",
    Done: "Готово",
    "Give the device to": "Передайте устройство",
    "Look at your cards": "Посмотрите свои карты",
    "Make sure nobody else can see the cards.":
      "Убедитесь, что никто другой не видит карты.",
    "Make sure nobody else can see your cards.":
      "Убедитесь, что никто другой не видит ваши карты.",
    "One of these three special cards can be drawn:":
      "Можно вытянуть одну из этих трёх специальных карт:",
    Partner: "Партнёр",
    "Pass the device": "Передать устройство",
    "Pass the device to": "Передайте устройство",
    "Player wants to see their cards": "Игрок хочет посмотреть свои карты",
    "Select your player and pass the device to them.":
      "Выберите игрока и передайте ему устройство.",
    "Special cards": "Специальные карты",
    "Team A": "Команда A",
    "Team B": "Команда B",
    "These cards are only visible to you.": "Эти карты видны только вам.",
    VS: "VS",
    Vorhand: "Vorhand",
    "Schlag:": "Schlag:",
    Exit: "Выйти",
    "I'm ready": "Я готов",
    "Ready?": "Готовы?",
    Score: "Счёт",
    "No card in this category.": "В этой категории нет карт.",

    You: "Вы",
  },
};

const menuAndSituationTranslations: Partial<
  Partial<Record<WattenLanguage, Record<string, string>>>
> = {
  de: {
    "Choose between local Hotseat, online Multiplayer, or review the rules first.":
      "Wähle zwischen lokalem Hotseat, Online-Multiplayer oder sieh dir zuerst die Regeln an.",
    "3 or 4 players": "3 oder 4 Spieler",
    Device: "Gerät",
    "One device": "Ein Gerät",
    "Pass-and-play": "Weitergabe am selben Gerät",
    "Play Hotseat": "Hotseat spielen",
    Online: "Online",
    Connection: "Verbindung",
    "Online room code": "Online-Raumcode",
    "Play Multiplayer": "Multiplayer spielen",
    "Rules & examples": "Regeln & Beispiele",
    "Learn the rules": "Regeln lernen",
    "Card ranking, Abheben, Gehen, Trumpf oder Kritisch and concrete trick situations.":
      "Kartenrangfolge, Abheben, Gehen, Trumpf oder Kritisch und konkrete Stichsituationen.",
    Situations: "Situationen",
    "Interactive situations": "Interaktive Situationen",
    "Why did this card win?": "Warum hat diese Karte gewonnen?",
    "Choose a situation and inspect the cards in play order. The winner and the relevant edge rule are explained below.":
      "Wähle eine Situation und sieh dir die Karten in Spielreihenfolge an. Der Sieger und die relevante Sonderregel werden darunter erklärt.",
    "Three-player mode: one Solo player faces a two-player team. Card priority itself is the same as in four-player mode.":
      "3-Spieler-Modus: Ein Solo-Spieler spielt gegen ein Zweierteam. Die Kartenpriorität selbst ist dieselbe wie im 4-Spieler-Modus.",
    "Four-player mode: Team A and Team B alternate seats. Card priority itself is the same as in three-player mode.":
      "4-Spieler-Modus: Team A und Team B sitzen abwechselnd. Die Kartenpriorität selbst ist dieselbe wie im 3-Spieler-Modus.",
    "Choose a case": "Fall auswählen",
    "First trick": "Erster Stich",
    "Any / later trick": "Beliebiger / späterer Stich",
    Player: "Spieler",
    Led: "Angespielt",
    Winner: "Sieger",
    "Why this card won": "Warum diese Karte gewinnt",
    "Rule snapshot": "Regelübersicht",
    "Lead suit": "Angespielte Farbe",
    "Winning card": "Gewinnerkarte",
    "Edge case": "Sonderfall",
    "Trumpf oder Kritisch: legal-card examples":
      "Trumpf oder Kritisch: Beispiele für erlaubte Karten",
    Legal: "Erlaubt",
    "Not legal": "Nicht erlaubt",
    "Max · highest critical": "Max · höchste Kritische",
    "Belli · second critical": "Belli · zweithöchste Kritische",
    "Spitz · third critical": "Spitz · dritthöchste Kritische",
    "Led suit": "angespielte Farbe",
    "Off-suit normal card": "Fehlfarbe",
    "Max beats everything": "Max schlägt alles",
    "Critical vs Main Schlag": "Kritische gegen Hauptschlag",
    "Max is the highest critical card. Critical cards are above Main Schlag, Schlag, trump and normal cards.":
      "Max ist die höchste Kritische. Kritische stehen über Hauptschlag, Schlag, Trumpf und normalen Karten.",
    "Critical cards have their own order":
      "Kritische haben ihre eigene Rangfolge",
    "Max > Belli > Spitz": "Max > Belli > Spitz",
    "Among the three critical cards, Max is highest, then Belli, then Spitz.":
      "Unter den drei Kritischen ist Max am höchsten, danach Belli und dann Spitz.",
    "Main Schlag beats ordinary Schlag": "Hauptschlag schlägt normalen Schlag",
    "Suit + Schlag": "Farbe + Schlag",
    "Gras Ober is both the selected suit and the selected Schlag, so it is the Main Schlag and outranks every ordinary Schlag and trump card.":
      "Gras Ober entspricht sowohl der gewählten Farbe als auch dem gewählten Schlag. Deshalb ist er der Hauptschlag und steht über jedem normalen Schlag und Trumpf.",
    "Schlag beats trump even in another suit":
      "Schlag schlägt Trumpf auch in einer anderen Farbe",
    "Schlag vs trump": "Schlag gegen Trumpf",
    "Every ordinary Schlag is above normal trump cards. The Schlag does not need to be in the trump suit.":
      "Jeder normale Schlag steht über normalen Trumpfkarten. Ein Schlag muss nicht in der Trumpffarbe liegen.",
    "In the four-player example two ordinary Schlag cards appear. They are equal, so the first Schlag played wins between them.":
      "Im 4-Spieler-Beispiel erscheinen zwei normale Schläge. Sie sind gleich stark; zwischen ihnen gewinnt der zuerst gespielte Schlag.",
    "Equal Schlag: the first one wins": "Gleiche Schläge: Der erste gewinnt",
    "Play order decides": "Spielreihenfolge entscheidet",
    "All ordinary Schlag cards have equal strength. Because equal strength does not replace the current winner, the first Schlag played keeps the trick.":
      "Alle normalen Schläge sind gleich stark. Da gleiche Stärke den bisherigen Sieger nicht verdrängt, behält der zuerst gespielte Schlag den Stich.",
    "Even a low trump beats a normal led-suit card":
      "Auch ein niedriger Trumpf schlägt eine normale Karte der angespielten Farbe",
    "Trump vs normal": "Trumpf gegen normal",
    "A normal trump card is a higher category than every ordinary card, so Gras 7 beats the Ace of the led suit.":
      "Eine normale Trumpfkarte gehört zu einer höheren Kategorie als jede gewöhnliche Karte. Deshalb schlägt Gras 7 sogar das Ass der angespielten Farbe.",
    "Higher trump wins between trump cards":
      "Unter Trumpfkarten gewinnt der höhere Trumpf",
    "Ace > King > Ober ...": "Ass > König > Ober ...",
    "When several normal trump cards are played, their normal rank decides: Ace, King, Ober, Unter, 10, 9, 8, 7.":
      "Werden mehrere normale Trumpfkarten gespielt, entscheidet ihre normale Rangfolge: Ass, König, Ober, Unter, 10, 9, 8, 7.",
    "Without a special card, the led suit decides":
      "Ohne Sonderkarte entscheidet die angespielte Farbe",
    "Led suit matters": "Angespielte Farbe zählt",
    "No critical, Main Schlag, Schlag or trump is present. Only cards of the first played suit can win, and Herz Unter is higher than Herz 8.":
      "Es liegt weder Kritische noch Hauptschlag, Schlag oder Trumpf. Nur Karten der zuerst gespielten Farbe können gewinnen, und Herz Unter steht über Herz 8.",
    "An off-suit Ace can still lose":
      "Ein Ass in Fehlfarbe kann trotzdem verlieren",
    "Off-suit edge case": "Sonderfall Fehlfarbe",
    "The Ace is not in the led suit and is not a special card, so it cannot beat a lower card that follows the led suit.":
      "Das Ass gehört nicht zur angespielten Farbe und ist keine Sonderkarte. Deshalb kann es eine niedrigere Karte der angespielten Farbe nicht schlagen.",
    "When Main Schlag would also be a critical card":
      "Wenn der Hauptschlag zugleich eine Kritische wäre",
    "Critical classification wins": "Kritische Einstufung hat Vorrang",
    "Herz König is Max. Even though it matches both suit and Schlag, it stays a critical card and therefore uses the higher critical priority.":
      "Herz König ist Max. Obwohl die Karte sowohl Farbe als auch Schlag entspricht, bleibt sie eine Kritische und erhält damit die höhere Kritische-Priorität.",
    "In this combination the mathematical Main Schlag is already Max, so it is not treated as a separate lower Main-Schlag card.":
      "In dieser Kombination ist der rechnerische Hauptschlag bereits Max. Deshalb wird er nicht zusätzlich als niedrigerer Hauptschlag behandelt.",
    "Trumpf oder Kritisch forces a response":
      "Trumpf oder Kritisch erzwingt eine Antwort",
    "First-trick obligation": "Pflicht im ersten Stich",
    "The Main Schlag was led in the first trick, so Trumpf oder Kritisch is active. A player who holds a trump or critical card must play one. Belli then wins because it is critical.":
      "Der Hauptschlag wurde im ersten Stich ausgespielt, daher ist Trumpf oder Kritisch aktiv. Wer Trumpf oder eine Kritische besitzt, muss eine davon spielen. Belli gewinnt anschließend, weil er eine Kritische ist.",
    "A player with no trump and no critical card is free to play another card.":
      "Ein Spieler ohne Trumpf und ohne Kritische darf frei eine andere Karte spielen.",
    "This player has a trump card, so the off-suit Ace is not legal while Trumpf oder Kritisch is active.":
      "Dieser Spieler besitzt eine Trumpfkarte. Solange Trumpf oder Kritisch aktiv ist, ist das Ass in Fehlfarbe daher nicht erlaubt.",
    "Belli is critical, so it satisfies Trumpf oder Kritisch and must be chosen over the normal card.":
      "Belli ist eine Kritische, erfüllt daher Trumpf oder Kritisch und muss anstelle der normalen Karte gespielt werden.",
    "This player has neither trump nor a critical card, so either normal card is legal.":
      "Dieser Spieler besitzt weder Trumpf noch Kritische; deshalb ist jede der beiden normalen Karten erlaubt.",
    "Trumpf oder Kritisch when a player has no matching card":
      "Trumpf oder Kritisch, wenn keine passende Karte vorhanden ist",
    "No trump or critical in hand":
      "Kein Trumpf und keine Kritische auf der Hand",
    "Trumpf oder Kritisch does not invent a card a player does not have. If the hand contains neither trump nor a critical card, a normal card may be played freely; here the Main Schlag remains the winner.":
      "Trumpf oder Kritisch erzeugt keine Karte, die ein Spieler nicht besitzt. Enthält die Hand weder Trumpf noch Kritische, darf frei eine normale Karte gespielt werden; hier bleibt der Hauptschlag Sieger.",
    "The obligation is conditional: it applies only when the player actually holds at least one trump or critical card.":
      "Die Pflicht gilt nur dann, wenn der Spieler tatsächlich mindestens einen Trumpf oder eine Kritische besitzt.",
    "Neither card is trump or critical, so both normal cards are legal.":
      "Keine der beiden Karten ist Trumpf oder Kritische; deshalb sind beide normalen Karten erlaubt.",
    "This hand also contains no trump and no critical card, so the player may discard freely.":
      "Auch diese Hand enthält weder Trumpf noch Kritische; der Spieler darf daher frei abwerfen.",
    "Main Schlag in a later trick": "Hauptschlag in einem späteren Stich",
    "No Trumpf-oder-Kritisch trigger": "Kein Trumpf-oder-Kritisch-Auslöser",
    "The Main Schlag is still a very strong card, but Trumpf oder Kritisch is only activated when it is led in the first trick. Here Belli still wins simply because it is critical.":
      "Der Hauptschlag bleibt sehr stark, aber Trumpf oder Kritisch wird nur ausgelöst, wenn er im ersten Stich angespielt wird. Hier gewinnt Belli allein deshalb, weil er eine Kritische ist.",
    "Playing the Main Schlag later does not create the special forced-response rule.":
      "Wird der Hauptschlag später gespielt, entsteht die besondere Antwortpflicht nicht.",
  },
  ko: {
    "Choose between local Hotseat, online Multiplayer, or review the rules first.":
      "로컬 핫시트, 온라인 멀티플레이를 선택하거나 먼저 규칙을 확인하세요.",
    "3 or 4 players": "3명 또는 4명",
    Device: "기기",
    "One device": "한 기기",
    "Pass-and-play": "기기를 넘겨가며 플레이",
    "Play Hotseat": "핫시트 플레이",
    Online: "온라인",
    Connection: "연결",
    "Online room code": "온라인 방 코드",
    "Play Multiplayer": "멀티플레이 시작",
    "Rules & examples": "규칙 & 예시",
    "Learn the rules": "규칙 배우기",
    "Card ranking, Abheben, Gehen, Trumpf oder Kritisch and concrete trick situations.":
      "카드 우선순위, Abheben, Gehen, Trumpf oder Kritisch와 실제 트릭 상황을 확인합니다.",
    Situations: "상황 예시",
    "Interactive situations": "인터랙티브 상황 예시",
    "Why did this card win?": "왜 이 카드가 이겼을까요?",
    "Choose a situation and inspect the cards in play order. The winner and the relevant edge rule are explained below.":
      "상황을 선택해 카드가 나온 순서를 확인하세요. 승리 카드와 관련 예외 규칙을 아래에서 설명합니다.",
    "Three-player mode: one Solo player faces a two-player team. Card priority itself is the same as in four-player mode.":
      "3인 모드에서는 솔로 한 명이 2인 팀과 대결합니다. 카드 우선순위 자체는 4인 모드와 같습니다.",
    "Four-player mode: Team A and Team B alternate seats. Card priority itself is the same as in three-player mode.":
      "4인 모드에서는 Team A와 Team B가 번갈아 앉습니다. 카드 우선순위 자체는 3인 모드와 같습니다.",
    "Choose a case": "상황 선택",
    "First trick": "첫 번째 트릭",
    "Any / later trick": "일반 / 이후 트릭",
    Player: "플레이어",
    Led: "선출",
    Winner: "승자",
    "Why this card won": "이 카드가 이긴 이유",
    "Rule snapshot": "규칙 요약",
    "Lead suit": "선출 무늬",
    "Winning card": "승리 카드",
    "Edge case": "예외 상황",
    "Trumpf oder Kritisch: legal-card examples":
      "Trumpf oder Kritisch: 가능한 카드 예시",
    Legal: "가능",
    "Not legal": "불가",
    "Max · highest critical": "Max · 최고 Kritische",
    "Belli · second critical": "Belli · 두 번째 Kritische",
    "Spitz · third critical": "Spitz · 세 번째 Kritische",
    "Led suit": "선출 무늬",
    "Off-suit normal card": "다른 무늬의 일반 카드",
    "Max beats everything": "Max는 모든 카드를 이깁니다",
    "Critical vs Main Schlag": "Kritische vs Hauptschlag",
    "Max is the highest critical card. Critical cards are above Main Schlag, Schlag, trump and normal cards.":
      "Max는 가장 높은 Kritische입니다. Kritische는 Hauptschlag, Schlag, Trumpf, 일반 카드보다 우선합니다.",
    "Critical cards have their own order": "Kritische에도 순서가 있습니다",
    "Max > Belli > Spitz": "Max > Belli > Spitz",
    "Among the three critical cards, Max is highest, then Belli, then Spitz.":
      "세 Kritische의 순서는 Max, Belli, Spitz입니다.",
    "Main Schlag beats ordinary Schlag": "Hauptschlag는 일반 Schlag를 이깁니다",
    "Suit + Schlag": "Farbe + Schlag",
    "Gras Ober is both the selected suit and the selected Schlag, so it is the Main Schlag and outranks every ordinary Schlag and trump card.":
      "Gras Ober는 선택된 Farbe와 Schlag를 동시에 만족하므로 Hauptschlag이며 모든 일반 Schlag와 Trumpf보다 높습니다.",
    "Schlag beats trump even in another suit":
      "다른 무늬의 Schlag도 Trumpf를 이깁니다",
    "Schlag vs trump": "Schlag vs Trumpf",
    "Every ordinary Schlag is above normal trump cards. The Schlag does not need to be in the trump suit.":
      "모든 일반 Schlag는 보통 Trumpf보다 높으며 Schlag가 Trumpf 무늬일 필요는 없습니다.",
    "In the four-player example two ordinary Schlag cards appear. They are equal, so the first Schlag played wins between them.":
      "4인 예시에서는 일반 Schlag가 두 장 나옵니다. 두 카드는 같은 세기이므로 먼저 나온 Schlag가 이깁니다.",
    "Equal Schlag: the first one wins": "같은 Schlag라면 먼저 나온 카드가 승리",
    "Play order decides": "플레이 순서가 결정",
    "All ordinary Schlag cards have equal strength. Because equal strength does not replace the current winner, the first Schlag played keeps the trick.":
      "일반 Schlag는 모두 같은 세기입니다. 같은 세기의 카드는 기존 승자를 바꾸지 않으므로 먼저 나온 Schlag가 트릭을 가져갑니다.",
    "Even a low trump beats a normal led-suit card":
      "낮은 Trumpf도 일반 선출 카드를 이깁니다",
    "Trump vs normal": "Trumpf vs 일반",
    "A normal trump card is a higher category than every ordinary card, so Gras 7 beats the Ace of the led suit.":
      "일반 Trumpf는 모든 일반 카드보다 높은 범주이므로 Gras 7도 선출 무늬의 Ass를 이깁니다.",
    "Higher trump wins between trump cards": "Trumpf끼리는 높은 랭크가 승리",
    "Ace > King > Ober ...": "Ass > König > Ober ...",
    "When several normal trump cards are played, their normal rank decides: Ace, King, Ober, Unter, 10, 9, 8, 7.":
      "여러 일반 Trumpf가 나오면 일반 랭크 순서 Ass, König, Ober, Unter, 10, 9, 8, 7로 결정됩니다.",
    "Without a special card, the led suit decides":
      "특수 카드가 없으면 선출 무늬가 결정",
    "Led suit matters": "선출 무늬가 중요",
    "No critical, Main Schlag, Schlag or trump is present. Only cards of the first played suit can win, and Herz Unter is higher than Herz 8.":
      "Kritische, Hauptschlag, Schlag, Trumpf가 없으므로 처음 나온 무늬의 카드만 이길 수 있고 Herz Unter가 Herz 8보다 높습니다.",
    "An off-suit Ace can still lose": "다른 무늬의 Ass도 질 수 있습니다",
    "Off-suit edge case": "다른 무늬 예외",
    "The Ace is not in the led suit and is not a special card, so it cannot beat a lower card that follows the led suit.":
      "Ass가 선출 무늬가 아니고 특수 카드도 아니므로 더 낮더라도 선출 무늬를 따른 카드를 이길 수 없습니다.",
    "When Main Schlag would also be a critical card":
      "Hauptschlag가 Kritische와 겹치는 경우",
    "Critical classification wins": "Kritische 분류가 우선",
    "Herz König is Max. Even though it matches both suit and Schlag, it stays a critical card and therefore uses the higher critical priority.":
      "Herz König는 Max입니다. Farbe와 Schlag를 모두 만족해도 Kritische로 남아 더 높은 Kritische 우선순위를 적용합니다.",
    "In this combination the mathematical Main Schlag is already Max, so it is not treated as a separate lower Main-Schlag card.":
      "이 조합에서는 계산상 Hauptschlag가 이미 Max이므로 별도의 낮은 Hauptschlag로 취급하지 않습니다.",
    "Trumpf oder Kritisch forces a response":
      "Trumpf oder Kritisch는 응답을 강제합니다",
    "First-trick obligation": "첫 트릭 의무",
    "The Main Schlag was led in the first trick, so Trumpf oder Kritisch is active. A player who holds a trump or critical card must play one. Belli then wins because it is critical.":
      "첫 트릭에서 Hauptschlag가 선출되어 Trumpf oder Kritisch가 활성화됩니다. Trumpf나 Kritische가 있으면 반드시 그중 하나를 내야 하며 Belli는 Kritische이므로 승리합니다.",
    "A player with no trump and no critical card is free to play another card.":
      "Trumpf도 Kritische도 없는 플레이어는 다른 카드를 자유롭게 낼 수 있습니다.",
    "This player has a trump card, so the off-suit Ace is not legal while Trumpf oder Kritisch is active.":
      "이 플레이어는 Trumpf를 가지고 있으므로 Trumpf oder Kritisch가 활성화된 동안 다른 무늬의 Ass는 낼 수 없습니다.",
    "Belli is critical, so it satisfies Trumpf oder Kritisch and must be chosen over the normal card.":
      "Belli는 Kritische이므로 Trumpf oder Kritisch 조건을 만족하며 일반 카드보다 우선해 내야 합니다.",
    "This player has neither trump nor a critical card, so either normal card is legal.":
      "이 플레이어는 Trumpf도 Kritische도 없으므로 두 일반 카드 모두 낼 수 있습니다.",
    "Trumpf oder Kritisch when a player has no matching card":
      "Trumpf oder Kritisch에서 해당 카드가 없는 경우",
    "No trump or critical in hand": "손에 Trumpf나 Kritische가 없음",
    "Trumpf oder Kritisch does not invent a card a player does not have. If the hand contains neither trump nor a critical card, a normal card may be played freely; here the Main Schlag remains the winner.":
      "Trumpf oder Kritisch는 플레이어가 가지지 않은 카드를 만들어내지 않습니다. 손에 Trumpf도 Kritische도 없으면 일반 카드를 자유롭게 낼 수 있으며, 이 예에서는 Hauptschlag가 그대로 승리합니다.",
    "The obligation is conditional: it applies only when the player actually holds at least one trump or critical card.":
      "이 의무는 조건부이며, 실제로 Trumpf나 Kritische를 한 장 이상 가지고 있을 때만 적용됩니다.",
    "Neither card is trump or critical, so both normal cards are legal.":
      "두 카드 모두 Trumpf나 Kritische가 아니므로 두 일반 카드 모두 낼 수 있습니다.",
    "This hand also contains no trump and no critical card, so the player may discard freely.":
      "이 손에도 Trumpf나 Kritische가 없으므로 자유롭게 버릴 수 있습니다.",
    "Main Schlag in a later trick": "이후 트릭의 Hauptschlag",
    "No Trumpf-oder-Kritisch trigger": "Trumpf-oder-Kritisch 발동 없음",
    "The Main Schlag is still a very strong card, but Trumpf oder Kritisch is only activated when it is led in the first trick. Here Belli still wins simply because it is critical.":
      "Hauptschlag는 여전히 강하지만 Trumpf oder Kritisch는 첫 트릭에서 선출될 때만 활성화됩니다. 여기서는 Belli가 Kritische이기 때문에 승리합니다.",
    "Playing the Main Schlag later does not create the special forced-response rule.":
      "이후 트릭에서 Hauptschlag를 내도 특별한 강제 응답 규칙은 생기지 않습니다.",
  },
  ru: {
    "Choose between local Hotseat, online Multiplayer, or review the rules first.":
      "Выберите локальный Hotseat, онлайн-мультиплеер или сначала посмотрите правила.",
    "3 or 4 players": "3 или 4 игрока",
    Device: "Устройство",
    "One device": "Одно устройство",
    "Pass-and-play": "Передача устройства",
    "Play Hotseat": "Играть Hotseat",
    Online: "Онлайн",
    Connection: "Соединение",
    "Online room code": "Код онлайн-комнаты",
    "Play Multiplayer": "Играть онлайн",
    "Rules & examples": "Правила и примеры",
    "Learn the rules": "Изучить правила",
    "Card ranking, Abheben, Gehen, Trumpf oder Kritisch and concrete trick situations.":
      "Порядок карт, Abheben, Gehen, Trumpf oder Kritisch и конкретные ситуации во взятках.",
    Situations: "Ситуации",
    "Interactive situations": "Интерактивные ситуации",
    "Why did this card win?": "Почему эта карта выиграла?",
    "Choose a situation and inspect the cards in play order. The winner and the relevant edge rule are explained below.":
      "Выберите ситуацию и посмотрите карты в порядке хода. Ниже объясняются победитель и важное исключение.",
    "Three-player mode: one Solo player faces a two-player team. Card priority itself is the same as in four-player mode.":
      "В режиме на 3 игроков один Solo играет против команды из двух. Приоритет карт тот же, что и в режиме на 4 игроков.",
    "Four-player mode: Team A and Team B alternate seats. Card priority itself is the same as in three-player mode.":
      "В режиме на 4 игроков Team A и Team B сидят через одного. Приоритет карт тот же, что и в режиме на 3 игроков.",
    "Choose a case": "Выберите пример",
    "First trick": "Первая взятка",
    "Any / later trick": "Любая / более поздняя взятка",
    Player: "Игрок",
    Led: "Первой",
    Winner: "Победитель",
    "Why this card won": "Почему эта карта выиграла",
    "Rule snapshot": "Краткое правило",
    "Lead suit": "Первая масть",
    "Winning card": "Победившая карта",
    "Edge case": "Особый случай",
    "Trumpf oder Kritisch: legal-card examples":
      "Trumpf oder Kritisch: примеры допустимых карт",
    Legal: "Можно",
    "Not legal": "Нельзя",
    "Max · highest critical": "Max · высшая Kritische",
    "Belli · second critical": "Belli · вторая Kritische",
    "Spitz · third critical": "Spitz · третья Kritische",
    "Led suit": "первая масть",
    "Off-suit normal card": "обычная карта другой масти",
    "Max beats everything": "Max бьёт всё",
    "Critical vs Main Schlag": "Kritische против Hauptschlag",
    "Max is the highest critical card. Critical cards are above Main Schlag, Schlag, trump and normal cards.":
      "Max — самая высокая Kritische. Kritische выше Hauptschlag, Schlag, козыря и обычных карт.",
    "Critical cards have their own order":
      "У Kritische есть собственный порядок",
    "Max > Belli > Spitz": "Max > Belli > Spitz",
    "Among the three critical cards, Max is highest, then Belli, then Spitz.":
      "Среди трёх Kritische выше всего Max, затем Belli и Spitz.",
    "Main Schlag beats ordinary Schlag": "Hauptschlag бьёт обычный Schlag",
    "Suit + Schlag": "Масть + Schlag",
    "Gras Ober is both the selected suit and the selected Schlag, so it is the Main Schlag and outranks every ordinary Schlag and trump card.":
      "Gras Ober одновременно соответствует выбранной масти и Schlag, поэтому это Hauptschlag, который выше обычных Schlag и козырей.",
    "Schlag beats trump even in another suit":
      "Schlag бьёт козырь даже в другой масти",
    "Schlag vs trump": "Schlag против козыря",
    "Every ordinary Schlag is above normal trump cards. The Schlag does not need to be in the trump suit.":
      "Любой обычный Schlag выше обычного козыря и не обязан быть козырной масти.",
    "In the four-player example two ordinary Schlag cards appear. They are equal, so the first Schlag played wins between them.":
      "В примере на 4 игроков появляются два обычных Schlag. Они равны, поэтому между ними выигрывает первый сыгранный Schlag.",
    "Equal Schlag: the first one wins": "Равные Schlag: выигрывает первый",
    "Play order decides": "Решает порядок хода",
    "All ordinary Schlag cards have equal strength. Because equal strength does not replace the current winner, the first Schlag played keeps the trick.":
      "Все обычные Schlag равны. Равная сила не заменяет текущего победителя, поэтому первый Schlag сохраняет взятку.",
    "Even a low trump beats a normal led-suit card":
      "Даже низкий козырь бьёт обычную карту первой масти",
    "Trump vs normal": "Козырь против обычной карты",
    "A normal trump card is a higher category than every ordinary card, so Gras 7 beats the Ace of the led suit.":
      "Обычный козырь относится к более высокой категории, поэтому Gras 7 бьёт даже туз первой масти.",
    "Higher trump wins between trump cards": "Среди козырей выигрывает старший",
    "Ace > King > Ober ...": "Ass > König > Ober ...",
    "When several normal trump cards are played, their normal rank decides: Ace, King, Ober, Unter, 10, 9, 8, 7.":
      "Если сыграно несколько обычных козырей, действует обычный порядок: Ass, König, Ober, Unter, 10, 9, 8, 7.",
    "Without a special card, the led suit decides":
      "Без особой карты решает первая масть",
    "Led suit matters": "Первая масть важна",
    "No critical, Main Schlag, Schlag or trump is present. Only cards of the first played suit can win, and Herz Unter is higher than Herz 8.":
      "Нет Kritische, Hauptschlag, Schlag или козыря. Выиграть могут только карты первой масти, а Herz Unter выше Herz 8.",
    "An off-suit Ace can still lose":
      "Туз другой масти всё равно может проиграть",
    "Off-suit edge case": "Случай другой масти",
    "The Ace is not in the led suit and is not a special card, so it cannot beat a lower card that follows the led suit.":
      "Туз не относится к первой масти и не является особой картой, поэтому не может побить более низкую карту первой масти.",
    "When Main Schlag would also be a critical card":
      "Когда Hauptschlag одновременно является Kritische",
    "Critical classification wins": "Приоритет у Kritische",
    "Herz König is Max. Even though it matches both suit and Schlag, it stays a critical card and therefore uses the higher critical priority.":
      "Herz König — это Max. Хотя карта совпадает и с мастью, и со Schlag, она остаётся Kritische и получает более высокий приоритет.",
    "In this combination the mathematical Main Schlag is already Max, so it is not treated as a separate lower Main-Schlag card.":
      "В этой комбинации математический Hauptschlag уже является Max и не считается отдельным более низким Hauptschlag.",
    "Trumpf oder Kritisch forces a response":
      "Trumpf oder Kritisch требует ответа",
    "First-trick obligation": "Обязанность в первой взятке",
    "The Main Schlag was led in the first trick, so Trumpf oder Kritisch is active. A player who holds a trump or critical card must play one. Belli then wins because it is critical.":
      "Hauptschlag был сыгран первым в первой взятке, поэтому действует Trumpf oder Kritisch. Игрок с козырем или Kritische обязан сыграть такую карту. Belli выигрывает как Kritische.",
    "A player with no trump and no critical card is free to play another card.":
      "Игрок без козыря и Kritische может свободно сыграть другую карту.",
    "This player has a trump card, so the off-suit Ace is not legal while Trumpf oder Kritisch is active.":
      "У игрока есть козырь, поэтому туз другой масти нельзя играть при активном Trumpf oder Kritisch.",
    "Belli is critical, so it satisfies Trumpf oder Kritisch and must be chosen over the normal card.":
      "Belli — Kritische, поэтому соответствует Trumpf oder Kritisch и должен быть выбран вместо обычной карты.",
    "This player has neither trump nor a critical card, so either normal card is legal.":
      "У игрока нет ни козыря, ни Kritische, поэтому можно сыграть любую из двух обычных карт.",
    "Trumpf oder Kritisch when a player has no matching card":
      "Trumpf oder Kritisch, когда подходящей карты нет",
    "No trump or critical in hand": "В руке нет козыря или Kritische",
    "Trumpf oder Kritisch does not invent a card a player does not have. If the hand contains neither trump nor a critical card, a normal card may be played freely; here the Main Schlag remains the winner.":
      "Trumpf oder Kritisch не создаёт карту, которой у игрока нет. Если в руке нет ни козыря, ни Kritische, обычную карту можно сыграть свободно; здесь Hauptschlag остаётся победителем.",
    "The obligation is conditional: it applies only when the player actually holds at least one trump or critical card.":
      "Обязанность условна: она действует только если у игрока действительно есть хотя бы один козырь или Kritische.",
    "Neither card is trump or critical, so both normal cards are legal.":
      "Ни одна карта не является козырем или Kritische, поэтому обе обычные карты допустимы.",
    "This hand also contains no trump and no critical card, so the player may discard freely.":
      "В этой руке также нет ни козыря, ни Kritische, поэтому можно свободно сбросить карту.",
    "Main Schlag in a later trick": "Hauptschlag в более поздней взятке",
    "No Trumpf-oder-Kritisch trigger": "Trumpf-oder-Kritisch не включается",
    "The Main Schlag is still a very strong card, but Trumpf oder Kritisch is only activated when it is led in the first trick. Here Belli still wins simply because it is critical.":
      "Hauptschlag остаётся очень сильным, но Trumpf oder Kritisch включается только когда он сыгран первым в первой взятке. Здесь Belli выигрывает просто как Kritische.",
    "Playing the Main Schlag later does not create the special forced-response rule.":
      "Розыгрыш Hauptschlag позже не создаёт особого обязательного ответа.",
  },
};

export function getInitialWattenLanguage(): WattenLanguage {
  if (typeof window === "undefined") return "en";

  const stored = window.localStorage.getItem("watten-language");

  return wattenLanguageOptions.some((option) => option.value === stored)
    ? (stored as WattenLanguage)
    : "en";
}

export function setStoredWattenLanguage(language: WattenLanguage) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("watten-language", language);
  }
}

export function translateWatten(language: WattenLanguage, key: string): string {
  if (isGameTerm(key)) return key;
  const rulebook =
    rulebookTranslations[language]?.[key];
  if (rulebook) return rulebook;

  if (language === "en") return key;

  const feature =
    menuAndSituationTranslations[language]?.[key];
  if (feature) return feature;

  const extra = extraTranslations[language]?.[key];
  if (extra) return extra;

  if (language === "de") return de[key] ?? translateGameUi(language, key);
  if (language === "bar") return bar[key] ?? translateGameUi(language, key);
  if (language === "ko") return ko[key] ?? translateGameUi(language, key);
  if (language === "ru") return ru[key] ?? translateGameUi(language, key);
  return translateGameUi(language, key);
}

/**
 * Transitional helper for older Watten components that still keep a German
 * and English string next to each other. Other languages use the centralized
 * English translation key when available.
 */
export function translateWattenPair(
  language: WattenLanguage,
  deText: string,
  enText: string,
): string {
  if (language === "de") return deText;
  if (language === "bar") {
    const translated = translateWatten(language, enText);
    return translated === enText ? deText : translated;
  }
  return translateWatten(language, enText);
}

export function WattenLanguageSelector({
  language,
  onChange,
  label = "Language",
}: {
  language: WattenLanguage;
  onChange: (language: WattenLanguage) => void;
  label?: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-xs font-bold text-zinc-500 sm:inline">
        {label}
      </span>

      <select
        value={language}
        onChange={(event) => onChange(event.target.value as WattenLanguage)}
        className="
          rounded-lg
          border
          border-white/10
          bg-zinc-950/90
          px-3
          py-2
          text-xs
          font-bold
          text-zinc-200
          outline-none
          transition
          hover:border-amber-400/30
          focus:border-amber-400/50
        "
      >
        {wattenLanguageOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
