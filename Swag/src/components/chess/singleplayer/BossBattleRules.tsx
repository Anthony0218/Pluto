import VariantRulesPage, {
  EffectGrid,
  Flow,
  VisualCard,
} from "./VariantRulesPage";
import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../../../games/chess/i18n/chessLanguage";

const translations: Partial<TranslationTable> = {
  de: {
    "Boss Battle Chess": "Boss-Battle-Schach",
    "White plays chess. Black plays the boss.":
      "Weiß spielt Schach. Schwarz spielt den Boss.",
    "Back to Boss Battle": "Zurück zum Boss Battle",
    "Play Boss Battle Chess": "Boss Battle spielen",
    "White begins with the full standard army. Black controls a reduced army led by a 5-HP Boss King with special powers. White can win by reducing the Boss to 0 HP or by checkmating it; Black wins by checkmating White.":
      "Weiß beginnt mit der vollen Standardarmee. Schwarz führt eine reduzierte Armee mit einem Boss-König mit 5 HP und Spezialkräften. Weiß gewinnt bei 0 HP oder Matt des Bosses; Schwarz gewinnt durch Matt gegen Weiß.",
    "5 HP Boss": "Boss mit 5 HP",
    "A non-mating White check damages the Boss when its armor is inactive.":
      "Ein weißes Schach ohne Matt verletzt den Boss, wenn keine Rüstung aktiv ist.",
    "Three Boss powers": "Drei Boss-Kräfte",
    "Shockwave, Summon and Dark Step can replace Black's normal move.":
      "Shockwave, Summon und Dark Step können den normalen schwarzen Zug ersetzen.",
    Rage: "Rage",
    "Rage grows over time and reduces future power cooldowns.":
      "Rage wächst mit der Zeit und verkürzt künftige Abklingzeiten.",
    "White starts with the normal full army":
      "Weiß startet mit der normalen vollen Armee",
    "White uses the standard sixteen chess pieces and follows ordinary chess movement and King-safety rules.":
      "Weiß nutzt die 16 Standardfiguren und normale Zug- und Königssicherheitsregeln.",
    "Black starts with a reduced Boss army":
      "Schwarz startet mit einer reduzierten Boss-Armee",
    "Black begins with the Boss King, six pawns, one Knight and one Bishop instead of a full standard army.":
      "Schwarz beginnt mit Boss-König, sechs Bauern, einem Springer und einem Läufer.",
    "The Boss starts with 5 HP": "Der Boss startet mit 5 HP",
    "A non-mating White check removes 1 Boss HP whenever Boss armor is inactive.":
      "Ein weißes Schach ohne Matt entfernt 1 Boss-HP, wenn keine Rüstung aktiv ist.",
    "Damage creates 2 plies of armor": "Schaden erzeugt 2 Halbzüge Rüstung",
    "After losing HP, the Boss gains 2 completed plies of immunity from further HP damage. A check still remains a real chess check and must be answered legally.":
      "Nach HP-Verlust erhält der Boss 2 Halbzüge Immunität gegen weiteren HP-Schaden. Ein Schach muss trotzdem legal beantwortet werden.",
    "White has two ways to defeat the Boss":
      "Weiß hat zwei Wege, den Boss zu besiegen",
    "White wins if Boss HP reaches 0 or if the Boss is checkmated. Black wins by checkmating White's normal King.":
      "Weiß gewinnt bei 0 Boss-HP oder Boss-Matt. Schwarz gewinnt durch Matt des weißen Königs.",
    "Using a Boss power consumes Black's turn":
      "Eine Boss-Kraft verbraucht den schwarzen Zug",
    "A Boss power is an alternative to making a normal Black chess move. Black cannot use a power and then move another piece in the same turn.":
      "Eine Boss-Kraft ersetzt den normalen schwarzen Zug; danach darf keine weitere Figur gezogen werden.",
    "Powers are locked while the Boss is in check":
      "Kräfte sind im Schach gesperrt",
    "If Black begins its turn in check, the Boss must answer that check with a normal legal chess move. Special powers cannot be used as the response.":
      "Beginnt Schwarz im Schach, muss das Schach mit einem normalen legalen Zug beantwortet werden.",
    Shockwave: "Shockwave",
    "Shockwave tries to push adjacent non-King White pieces one square directly away from the Boss. A piece only moves if the destination square is valid and empty.":
      "Shockwave schiebt benachbarte weiße Nicht-Königsfiguren ein Feld direkt vom Boss weg, sofern das Zielfeld gültig und frei ist.",
    Summon: "Summon",
    "Summon places a new Black pawn on a valid empty square of rank 6 or rank 7.":
      "Summon setzt einen neuen schwarzen Bauern auf ein gültiges freies Feld der Reihe 6 oder 7.",
    "Dark Step": "Dark Step",
    "Dark Step relocates the Boss up to two squares away to an eligible empty safe square.":
      "Dark Step versetzt den Boss bis zu zwei Felder weit auf ein geeignetes sicheres freies Feld.",
    "Boss powers have independent cooldowns":
      "Boss-Kräfte haben eigene Abklingzeiten",
    "Base cooldowns are Shockwave 5 Boss turns, Summon 6 and Dark Step 4. A power cannot be selected while its cooldown is above zero.":
      "Basis-Abklingzeiten: Shockwave 5 Boss-Züge, Summon 6, Dark Step 4. Eine Kraft ist bei laufender Abklingzeit gesperrt.",
    "Rage strengthens the Boss over time": "Rage stärkt den Boss mit der Zeit",
    "Rage increases by one level after every 4 completed Boss turns, up to level 3. Each Rage level reduces future power cooldowns by 1, but no cooldown can become shorter than 2.":
      "Alle 4 Boss-Züge steigt Rage um eine Stufe bis maximal 3. Jede Stufe verkürzt künftige Abklingzeiten um 1, mindestens jedoch auf 2.",
    "Normal draw rules still matter": "Normale Remisregeln bleiben wichtig",
    "Stalemate, the 50-move rule and repetition remain possible. A Boss with no normal legal move is not considered stalemated if it still has an available legal Boss power.":
      "Patt, 50-Züge-Regel und Wiederholung bleiben möglich. Der Boss ist nicht patt, wenn noch eine legale Boss-Kraft verfügbar ist.",
    "Black's three special actions": "Drei Spezialaktionen von Schwarz",
    "Push adjacent non-King White pieces directly away from the Boss.":
      "Schiebt benachbarte weiße Nicht-Königsfiguren vom Boss weg.",
    "Create a Black pawn on an eligible empty square on rank 6 or 7.":
      "Erzeugt einen schwarzen Bauern auf Reihe 6 oder 7.",
    "Relocate the Boss up to two squares to a safe empty destination.":
      "Versetzt den Boss bis zu zwei Felder auf ein sicheres freies Feld.",
    "Every 4 Boss turns, future cooldowns become shorter.":
      "Alle 4 Boss-Züge werden künftige Abklingzeiten kürzer.",
    "How Boss HP and armor interact": "Zusammenspiel von Boss-HP und Rüstung",
    "White gives check": "Weiß gibt Schach",
    "If armor is inactive, Boss loses 1 HP.":
      "Ohne Rüstung verliert der Boss 1 HP.",
    "Boss takes damage": "Boss nimmt Schaden",
    "HP decreases unless the check is mating.":
      "HP sinken, sofern es kein Matt ist.",
    "Armor activates": "Rüstung aktiviert",
    "2 completed plies of HP-damage immunity.":
      "2 Halbzüge Immunität gegen HP-Schaden.",
    "Fight continues": "Kampf geht weiter",
    "Check rules still apply normally.":
      "Schachregeln gelten weiterhin normal.",
  },
  bar: {
    "Boss Battle Chess": "Boss-Battle-Schach",
    "Back to Boss Battle": "Zruck zum Boss Battle",
    "Play Boss Battle Chess": "Boss Battle spuin",
  },
  ko: {
    "Boss Battle Chess": "보스 배틀 체스",
    "White plays chess. Black plays the boss.":
      "백은 체스를 두고 흑은 보스를 조종합니다.",
    "Back to Boss Battle": "보스 배틀로 돌아가기",
    "Play Boss Battle Chess": "보스 배틀 플레이",
    "White begins with the full standard army. Black controls a reduced army led by a 5-HP Boss King with special powers. White can win by reducing the Boss to 0 HP or by checkmating it; Black wins by checkmating White.":
      "백은 표준 전체 군대로 시작하고 흑은 특수 능력을 가진 5HP 보스 킹과 축소된 군대를 사용합니다. 백은 보스 HP를 0으로 만들거나 체크메이트하면 승리하며 흑은 백 킹을 체크메이트하면 승리합니다.",
    "5 HP Boss": "5 HP 보스",
    "A non-mating White check damages the Boss when its armor is inactive.":
      "방어막이 없을 때 체크메이트가 아닌 백의 체크는 보스에게 피해를 줍니다.",
    "Three Boss powers": "세 가지 보스 능력",
    "Shockwave, Summon and Dark Step can replace Black's normal move.":
      "쇼크웨이브, 소환, 다크 스텝은 흑의 일반 수 대신 사용할 수 있습니다.",
    Rage: "분노",
    "Rage grows over time and reduces future power cooldowns.":
      "분노는 시간이 지날수록 올라가고 이후 능력 쿨다운을 줄입니다.",
    "White starts with the normal full army": "백은 표준 전체 군대로 시작",
    "White uses the standard sixteen chess pieces and follows ordinary chess movement and King-safety rules.":
      "백은 표준 16기물과 일반 이동 및 킹 안전 규칙을 사용합니다.",
    "Black starts with a reduced Boss army": "흑은 축소된 보스 군대로 시작",
    "Black begins with the Boss King, six pawns, one Knight and one Bishop instead of a full standard army.":
      "흑은 보스 킹, 폰 6, 나이트 1, 비숍 1로 시작합니다.",
    "The Boss starts with 5 HP": "보스는 5 HP로 시작",
    "A non-mating White check removes 1 Boss HP whenever Boss armor is inactive.":
      "보스 방어막이 없을 때 체크메이트가 아닌 백의 체크는 HP 1을 깎습니다.",
    "Damage creates 2 plies of armor": "피해 후 2하프무브 방어막",
    "After losing HP, the Boss gains 2 completed plies of immunity from further HP damage. A check still remains a real chess check and must be answered legally.":
      "HP를 잃으면 보스는 2하프무브 동안 추가 HP 피해 면역을 얻지만 체크는 여전히 합법적으로 대응해야 합니다.",
    "White has two ways to defeat the Boss": "백의 보스 격파 방법 두 가지",
    "White wins if Boss HP reaches 0 or if the Boss is checkmated. Black wins by checkmating White's normal King.":
      "보스 HP 0 또는 보스 체크메이트면 백 승리, 백 킹 체크메이트면 흑 승리입니다.",
    "Using a Boss power consumes Black's turn": "보스 능력은 흑의 한 턴을 소비",
    "A Boss power is an alternative to making a normal Black chess move. Black cannot use a power and then move another piece in the same turn.":
      "보스 능력은 일반 흑 수를 대신하며 같은 턴에 추가로 기물을 움직일 수 없습니다.",
    "Powers are locked while the Boss is in check":
      "보스가 체크 상태면 능력 잠금",
    "If Black begins its turn in check, the Boss must answer that check with a normal legal chess move. Special powers cannot be used as the response.":
      "흑 차례가 체크로 시작되면 일반 합법 수로 체크를 해소해야 하며 특수 능력은 사용할 수 없습니다.",
    Shockwave: "쇼크웨이브",
    "Shockwave tries to push adjacent non-King White pieces one square directly away from the Boss. A piece only moves if the destination square is valid and empty.":
      "인접 백 비킹 기물을 보스에서 한 칸 바깥으로 밀며 목적지가 유효하고 비어 있을 때만 이동합니다.",
    Summon: "소환",
    "Summon places a new Black pawn on a valid empty square of rank 6 or rank 7.":
      "6 또는 7랭크의 유효한 빈 칸에 흑 폰 하나를 생성합니다.",
    "Dark Step": "다크 스텝",
    "Dark Step relocates the Boss up to two squares away to an eligible empty safe square.":
      "보스를 최대 두 칸 떨어진 안전한 빈 칸으로 이동시킵니다.",
    "Boss powers have independent cooldowns": "보스 능력은 개별 쿨다운",
    "Base cooldowns are Shockwave 5 Boss turns, Summon 6 and Dark Step 4. A power cannot be selected while its cooldown is above zero.":
      "기본 쿨다운은 쇼크웨이브 5 보스턴, 소환 6, 다크 스텝 4이며 쿨다운 중에는 사용할 수 없습니다.",
    "Rage strengthens the Boss over time": "분노가 시간이 지나며 보스를 강화",
    "Rage increases by one level after every 4 completed Boss turns, up to level 3. Each Rage level reduces future power cooldowns by 1, but no cooldown can become shorter than 2.":
      "보스턴 4회마다 분노가 최대 3까지 오르고 각 레벨은 이후 쿨다운을 1 줄이지만 최소 2입니다.",
    "Normal draw rules still matter": "일반 무승부 규칙도 적용",
    "Stalemate, the 50-move rule and repetition remain possible. A Boss with no normal legal move is not considered stalemated if it still has an available legal Boss power.":
      "스테일메이트, 50수, 반복은 유지되며 일반 수가 없어도 사용할 수 있는 보스 능력이 있으면 스테일메이트가 아닙니다.",
    "Black's three special actions": "흑의 세 가지 특수 행동",
    "Push adjacent non-King White pieces directly away from the Boss.":
      "인접 백 비킹 기물을 보스에서 밀어냅니다.",
    "Create a Black pawn on an eligible empty square on rank 6 or 7.":
      "6/7랭크에 흑 폰을 생성합니다.",
    "Relocate the Boss up to two squares to a safe empty destination.":
      "보스를 최대 두 칸 떨어진 안전한 빈 칸으로 이동합니다.",
    "Every 4 Boss turns, future cooldowns become shorter.":
      "보스턴 4회마다 이후 쿨다운이 줄어듭니다.",
    "How Boss HP and armor interact": "보스 HP와 방어막 흐름",
    "White gives check": "백이 체크",
    "If armor is inactive, Boss loses 1 HP.": "방어막이 없으면 보스 HP -1.",
    "Boss takes damage": "보스 피해",
    "HP decreases unless the check is mating.": "체크메이트가 아니면 HP 감소.",
    "Armor activates": "방어막 활성",
    "2 completed plies of HP-damage immunity.": "2하프무브 HP 피해 면역.",
    "Fight continues": "전투 계속",
    "Check rules still apply normally.": "체크 규칙은 그대로 적용됩니다.",
  },
  ru: {
    "Boss Battle Chess": "Шахматы: Битва с боссом",
    "White plays chess. Black plays the boss.":
      "Белые играют в шахматы, чёрные управляют боссом.",
    "Back to Boss Battle": "Назад к битве с боссом",
    "Play Boss Battle Chess": "Играть в битву с боссом",
    "White begins with the full standard army. Black controls a reduced army led by a 5-HP Boss King with special powers. White can win by reducing the Boss to 0 HP or by checkmating it; Black wins by checkmating White.":
      "Белые начинают полной армией. У чёрных уменьшенная армия и король-босс с 5 HP и силами. Белые побеждают при 0 HP или мате босса; чёрные — матом белому королю.",
    "5 HP Boss": "Босс с 5 HP",
    "A non-mating White check damages the Boss when its armor is inactive.":
      "Шах белых без мата наносит урон, если броня не активна.",
    "Three Boss powers": "Три силы босса",
    "Shockwave, Summon and Dark Step can replace Black's normal move.":
      "Shockwave, Summon и Dark Step заменяют обычный ход чёрных.",
    Rage: "Ярость",
    "Rage grows over time and reduces future power cooldowns.":
      "Ярость растёт и сокращает будущие перезарядки.",
    "White starts with the normal full army": "Белые начинают полной армией",
    "White uses the standard sixteen chess pieces and follows ordinary chess movement and King-safety rules.":
      "Белые используют стандартные 16 фигур и обычные правила ходов и безопасности короля.",
    "Black starts with a reduced Boss army":
      "Чёрные начинают уменьшенной армией босса",
    "Black begins with the Boss King, six pawns, one Knight and one Bishop instead of a full standard army.":
      "У чёрных босс-король, 6 пешек, 1 конь и 1 слон.",
    "The Boss starts with 5 HP": "Босс начинает с 5 HP",
    "A non-mating White check removes 1 Boss HP whenever Boss armor is inactive.":
      "Шах белых без мата снимает 1 HP, если броня не активна.",
    "Damage creates 2 plies of armor": "Урон даёт броню на 2 полухода",
    "After losing HP, the Boss gains 2 completed plies of immunity from further HP damage. A check still remains a real chess check and must be answered legally.":
      "После потери HP босс получает иммунитет к HP-урону на 2 полухода, но шах всё равно нужно отражать легально.",
    "White has two ways to defeat the Boss": "У белых два способа победить",
    "White wins if Boss HP reaches 0 or if the Boss is checkmated. Black wins by checkmating White's normal King.":
      "Белые выигрывают при 0 HP или мате босса. Чёрные выигрывают матом белому королю.",
    "Using a Boss power consumes Black's turn": "Сила босса тратит ход чёрных",
    "A Boss power is an alternative to making a normal Black chess move. Black cannot use a power and then move another piece in the same turn.":
      "Сила заменяет обычный ход; после неё нельзя сделать второй ход фигурой.",
    "Powers are locked while the Boss is in check":
      "Силы заблокированы под шахом",
    "If Black begins its turn in check, the Boss must answer that check with a normal legal chess move. Special powers cannot be used as the response.":
      "Если ход начинается с шаха, нужно ответить обычным легальным ходом; силы использовать нельзя.",
    Shockwave: "Ударная волна",
    "Shockwave tries to push adjacent non-King White pieces one square directly away from the Boss. A piece only moves if the destination square is valid and empty.":
      "Ударная волна толкает соседние белые фигуры кроме короля на поле от босса, если оно свободно и допустимо.",
    Summon: "Призыв",
    "Summon places a new Black pawn on a valid empty square of rank 6 or rank 7.":
      "Призыв создаёт чёрную пешку на свободном поле ряда 6 или 7.",
    "Dark Step": "Тёмный шаг",
    "Dark Step relocates the Boss up to two squares away to an eligible empty safe square.":
      "Тёмный шаг переносит босса на безопасное пустое поле в пределах двух клеток.",
    "Boss powers have independent cooldowns": "У сил отдельные перезарядки",
    "Base cooldowns are Shockwave 5 Boss turns, Summon 6 and Dark Step 4. A power cannot be selected while its cooldown is above zero.":
      "Базовые перезарядки: волна 5 ходов босса, призыв 6, тёмный шаг 4.",
    "Rage strengthens the Boss over time": "Ярость усиливает босса",
    "Rage increases by one level after every 4 completed Boss turns, up to level 3. Each Rage level reduces future power cooldowns by 1, but no cooldown can become shorter than 2.":
      "Каждые 4 хода босса ярость растёт до 3. Каждый уровень сокращает будущую перезарядку на 1, минимум до 2.",
    "Normal draw rules still matter": "Обычные правила ничьей сохраняются",
    "Stalemate, the 50-move rule and repetition remain possible. A Boss with no normal legal move is not considered stalemated if it still has an available legal Boss power.":
      "Пат, правило 50 ходов и повторение действуют. Если у босса нет обычного хода, но есть легальная сила, это не пат.",
    "Black's three special actions": "Три особых действия чёрных",
    "Push adjacent non-King White pieces directly away from the Boss.":
      "Отталкивает соседние белые фигуры от босса.",
    "Create a Black pawn on an eligible empty square on rank 6 or 7.":
      "Создаёт чёрную пешку на 6-м или 7-м ряду.",
    "Relocate the Boss up to two squares to a safe empty destination.":
      "Переносит босса до двух клеток на безопасное поле.",
    "Every 4 Boss turns, future cooldowns become shorter.":
      "Каждые 4 хода босса будущие перезарядки сокращаются.",
    "How Boss HP and armor interact": "Как работают HP и броня",
    "White gives check": "Белые дают шах",
    "If armor is inactive, Boss loses 1 HP.": "Без брони босс теряет 1 HP.",
    "Boss takes damage": "Босс получает урон",
    "HP decreases unless the check is mating.":
      "HP уменьшается, если это не мат.",
    "Armor activates": "Броня активируется",
    "2 completed plies of HP-damage immunity.":
      "2 полухода иммунитета к HP-урону.",
    "Fight continues": "Бой продолжается",
    "Check rules still apply normally.": "Правила шаха действуют обычно.",
  },
};

export default function BossBattleRules() {
  const { language, setLanguage } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);
  return (
    <VariantRulesPage
      variantLabel={t("Chess Variant")}
      title={t("Boss Battle Chess")}
      subtitle={t("White plays chess. Black plays the boss.")}
      icon="♚"
      accent="amber"
      backRoute="/games/chess/variants/boss-battle/hotseat"
      backLabel={t("Back to Boss Battle")}
      coreIdea={t(
        "White begins with the full standard army. Black controls a reduced army led by a 5-HP Boss King with special powers. White can win by reducing the Boss to 0 HP or by checkmating it; Black wins by checkmating White.",
      )}
      language={language}
      onLanguageChange={setLanguage}
      languageLabel={t("Language")}
      coreIdeaLabel={t("Core idea")}
      ruleLabel={t("Rule")}
      playLabel={t("Play Boss Battle Chess")}
      features={[
        {
          icon: "♥♥♥♥♥",
          title: t("5 HP Boss"),
          text: t(
            "A non-mating White check damages the Boss when its armor is inactive.",
          ),
        },
        {
          icon: "⚡",
          title: t("Three Boss powers"),
          text: t(
            "Shockwave, Summon and Dark Step can replace Black's normal move.",
          ),
        },
        {
          icon: "🔥",
          title: t("Rage"),
          text: t("Rage grows over time and reduces future power cooldowns."),
        },
      ]}
      rules={[
        {
          icon: "♔",
          title: t("White starts with the normal full army"),
          text: t(
            "White uses the standard sixteen chess pieces and follows ordinary chess movement and King-safety rules.",
          ),
        },
        {
          icon: "♚",
          title: t("Black starts with a reduced Boss army"),
          text: t(
            "Black begins with the Boss King, six pawns, one Knight and one Bishop instead of a full standard army.",
          ),
        },
        {
          icon: "♥",
          title: t("The Boss starts with 5 HP"),
          text: t(
            "A non-mating White check removes 1 Boss HP whenever Boss armor is inactive.",
          ),
        },
        {
          icon: "🛡",
          title: t("Damage creates 2 plies of armor"),
          text: t(
            "After losing HP, the Boss gains 2 completed plies of immunity from further HP damage. A check still remains a real chess check and must be answered legally.",
          ),
        },
        {
          icon: "☠",
          title: t("White has two ways to defeat the Boss"),
          text: t(
            "White wins if Boss HP reaches 0 or if the Boss is checkmated. Black wins by checkmating White's normal King.",
          ),
        },
        {
          icon: "⚡",
          title: t("Using a Boss power consumes Black's turn"),
          text: t(
            "A Boss power is an alternative to making a normal Black chess move. Black cannot use a power and then move another piece in the same turn.",
          ),
        },
        {
          icon: "🔒",
          title: t("Powers are locked while the Boss is in check"),
          text: t(
            "If Black begins its turn in check, the Boss must answer that check with a normal legal chess move. Special powers cannot be used as the response.",
          ),
        },
        {
          icon: "💥",
          title: t("Shockwave"),
          text: t(
            "Shockwave tries to push adjacent non-King White pieces one square directly away from the Boss. A piece only moves if the destination square is valid and empty.",
          ),
        },
        {
          icon: "👹",
          title: t("Summon"),
          text: t(
            "Summon places a new Black pawn on a valid empty square of rank 6 or rank 7.",
          ),
        },
        {
          icon: "🌑",
          title: t("Dark Step"),
          text: t(
            "Dark Step relocates the Boss up to two squares away to an eligible empty safe square.",
          ),
        },
        {
          icon: "⏳",
          title: t("Boss powers have independent cooldowns"),
          text: t(
            "Base cooldowns are Shockwave 5 Boss turns, Summon 6 and Dark Step 4. A power cannot be selected while its cooldown is above zero.",
          ),
        },
        {
          icon: "🔥",
          title: t("Rage strengthens the Boss over time"),
          text: t(
            "Rage increases by one level after every 4 completed Boss turns, up to level 3. Each Rage level reduces future power cooldowns by 1, but no cooldown can become shorter than 2.",
          ),
        },
        {
          icon: "♟",
          title: t("Normal draw rules still matter"),
          text: t(
            "Stalemate, the 50-move rule and repetition remain possible. A Boss with no normal legal move is not considered stalemated if it still has an available legal Boss power.",
          ),
        },
      ]}
    >
      <VisualCard
        accent="amber"
        eyebrow={t("Boss powers")}
        title={t("Black's three special actions")}
      >
        <EffectGrid
          items={[
            {
              icon: "💥",
              title: t("Shockwave"),
              text: t(
                "Push adjacent non-King White pieces directly away from the Boss.",
              ),
            },
            {
              icon: "👹",
              title: t("Summon"),
              text: t(
                "Create a Black pawn on an eligible empty square on rank 6 or 7.",
              ),
            },
            {
              icon: "🌑",
              title: t("Dark Step"),
              text: t(
                "Relocate the Boss up to two squares to a safe empty destination.",
              ),
            },
            {
              icon: "🔥",
              title: t("Rage"),
              text: t("Every 4 Boss turns, future cooldowns become shorter."),
            },
          ]}
        />
      </VisualCard>
      <VisualCard
        accent="amber"
        eyebrow={t("Damage loop")}
        title={t("How Boss HP and armor interact")}
      >
        <Flow
          steps={[
            {
              icon: "♔+",
              label: t("White gives check"),
              detail: t("If armor is inactive, Boss loses 1 HP."),
            },
            {
              icon: "♥−1",
              label: t("Boss takes damage"),
              detail: t("HP decreases unless the check is mating."),
            },
            {
              icon: "🛡",
              label: t("Armor activates"),
              detail: t("2 completed plies of HP-damage immunity."),
            },
            {
              icon: "♚",
              label: t("Fight continues"),
              detail: t("Check rules still apply normally."),
            },
          ]}
        />
      </VisualCard>
    </VariantRulesPage>
  );
}
