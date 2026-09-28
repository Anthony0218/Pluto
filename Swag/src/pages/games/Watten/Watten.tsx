import { useAppLanguage } from "@/i18n/languageStore";
import "./wattenMenus.css";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, ChevronRight, Gamepad2, Users } from "lucide-react";
import { useFitWattenScreen } from "@/games/watten/useFitWattenScreen";
import {
  setStoredWattenLanguage,
  translateWatten,
  WattenLanguageSelector,
  type WattenLanguage,
} from "@/games/watten/i18n/wattenLanguage";

const tableTalk = [
  "A good hand is better with good company.",
  "Call the cards. Read the room. Take the trick.",
  "One table, a few friends, and a little nerve.",
];

const homeCopy: Partial<Record<WattenLanguage, Record<string, string>>> = {
  de: {
    "Pull up a chair.": "Setz dich dazu.",
    "Cards on the table. Friends at your side. Every trick tells a story.": "Karten auf dem Tisch. Freunde an deiner Seite. Jeder Stich erzählt eine Geschichte.",
    "TABLE TALK": "AM STAMMTISCH",
    "A good hand is better with good company.": "Ein gutes Blatt ist mit Freunden noch besser.",
    "Call the cards. Read the room. Take the trick.": "Sag die Karten an. Lies die Runde. Hol den Stich.",
    "One table, a few friends, and a little nerve.": "Ein Tisch, ein paar Freunde und etwas Mut.",
    "CHOOSE YOUR TABLE": "WÄHLE DEINEN TISCH",
    "ONE DEVICE · 3 OR 4 PLAYERS": "EIN GERÄT · 3 ODER 4 SPIELER",
    "Pass the device around the table and play together.": "Reicht das Gerät weiter und spielt zusammen.",
    "PRIVATE ROOM · ONLINE": "PRIVATER RAUM · ONLINE",
    "Invite your friends with a room code.": "Lade deine Freunde mit einem Raumcode ein.",
    "One good round deserves another.": "Auf eine gute Runde folgt die nächste.",
    "Next table note": "Nächster Stammtischspruch",
  },
  bar: {
    "Pull up a chair.": "Hock di her.",
    "Cards on the table. Friends at your side. Every trick tells a story.": "Kartn aufn Tisch, Freind um di rum. Jeder Stich hod sei Gschicht.",
    "TABLE TALK": "AM STAMMTISCH",
    "A good hand is better with good company.": "A guats Blatt is mit Freind no besser.",
    "Call the cards. Read the room. Take the trick.": "Sag d'Kartn o. Schau auf d'Leit. Hol da an Stich.",
    "One table, a few friends, and a little nerve.": "Oa Tisch, a paar Freind und a bissl Schneid.",
    "CHOOSE YOUR TABLE": "SUCH DA AN TISCH AUS",
    "ONE DEVICE · 3 OR 4 PLAYERS": "OA GERÄT · 3 ODER 4 SPIELER",
    "Pass the device around the table and play together.": "Gebts as Gerät weiter und spuits zamm.",
    "PRIVATE ROOM · ONLINE": "PRIVATER RAUM · ONLINE",
    "Invite your friends with a room code.": "Lad dei Freind mit am Raumcode ei.",
    "One good round deserves another.": "Auf a guate Rund kummt no oane.",
    "Next table note": "Nächster Stammtischspruch",
  },
  ko: {
    "Pull up a chair.": "자리를 잡으세요.",
    "Cards on the table. Friends at your side. Every trick tells a story.": "테이블 위의 카드, 곁에 있는 친구. 매 트릭마다 이야기가 펼쳐집니다.",
    "TABLE TALK": "테이블 이야기",
    "A good hand is better with good company.": "좋은 패도 좋은 친구와 함께라면 더 즐겁습니다.",
    "Call the cards. Read the room. Take the trick.": "카드를 부르고, 분위기를 읽고, 트릭을 가져가세요.",
    "One table, a few friends, and a little nerve.": "테이블 하나, 친구 몇 명, 그리고 약간의 배짱.",
    "CHOOSE YOUR TABLE": "게임 방식 선택",
    "ONE DEVICE · 3 OR 4 PLAYERS": "기기 한 대 · 3~4명",
    "Pass the device around the table and play together.": "기기를 번갈아 건네며 함께 플레이하세요.",
    "PRIVATE ROOM · ONLINE": "비공개 방 · 온라인",
    "Invite your friends with a room code.": "방 코드로 친구를 초대하세요.",
    "One good round deserves another.": "즐거운 한 판 뒤엔 다음 판이 기다립니다.",
    "Next table note": "다음 테이블 이야기",
  },
  ru: {
    "Pull up a chair.": "Присаживайтесь.",
    "Cards on the table. Friends at your side. Every trick tells a story.": "Карты на столе, друзья рядом. Каждая взятка — новая история.",
    "TABLE TALK": "ЗА СТОЛОМ",
    "A good hand is better with good company.": "Хорошая рука ещё лучше в хорошей компании.",
    "Call the cards. Read the room. Take the trick.": "Назовите карты, почувствуйте соперников и возьмите взятку.",
    "One table, a few friends, and a little nerve.": "Один стол, несколько друзей и немного смелости.",
    "CHOOSE YOUR TABLE": "ВЫБЕРИТЕ ИГРУ",
    "ONE DEVICE · 3 OR 4 PLAYERS": "ОДНО УСТРОЙСТВО · 3 ИЛИ 4 ИГРОКА",
    "Pass the device around the table and play together.": "Передавайте устройство по кругу и играйте вместе.",
    "PRIVATE ROOM · ONLINE": "ЗАКРЫТАЯ КОМНАТА · ОНЛАЙН",
    "Invite your friends with a room code.": "Пригласите друзей с помощью кода комнаты.",
    "One good round deserves another.": "После хорошего раунда хочется сыграть ещё.",
    "Next table note": "Следующая заметка",
  },
};

export default function Watten() {
  useFitWattenScreen();
  const { language, setLanguage } = useAppLanguage();
  const [tip, setTip] = useState(0);
  const t = useCallback((key: string) => homeCopy[language]?.[key] ?? translateWatten(language, key), [language]);

  function changeLanguage(next: WattenLanguage) {
    setLanguage(next);
    setStoredWattenLanguage(next);
  }

  return <main className="watten-menu watten-menu--screen watten-menu--home">
    <div className="watten-menu__layout">
      <div className="watten-menu__panel">
        <div className="watten-pub-bar">
          <div className="watten-pub-brand"><span className="watten-menu__seal">W</span><span><strong>WATTEN</strong><small>{t("Bavarian Watten")}</small></span></div>
          <WattenLanguageSelector language={language} onChange={changeLanguage} label={t("Language")} />
        </div>

        <div className="watten-pub-grid">
          <section className="watten-pub-story" aria-labelledby="watten-menu-title">
            <div className="watten-pub-story__copy">
              <p className="watten-pub-kicker"><span aria-hidden="true">✦</span> {t("Bavarian Watten")} <span aria-hidden="true">✦</span></p>
              <h1 id="watten-menu-title">{t("Pull up a chair.")}</h1>
              <p className="watten-pub-lede">{t("Cards on the table. Friends at your side. Every trick tells a story.")}</p>
            </div>
            <div className="watten-pub-table" aria-hidden="true">
              <div className="watten-pub-table__ring" />
              <div className="watten-pub-hand">
                <img src="/images/bavarian/herz-king.png" alt="" />
                <img src="/images/bavarian/schellen-7.png" alt="" />
                <img src="/images/bavarian/eichel-7.png" alt="" />
              </div>
              <span className="watten-pub-table__stamp">EST. AT THE TABLE</span>
            </div>
            <button type="button" className="watten-pub-talk" onClick={() => setTip(current => (current + 1) % tableTalk.length)} aria-label={t("Next table note")}>
              <span className="watten-pub-talk__icon" aria-hidden="true">✦</span>
              <span><small>{t("TABLE TALK")} · {tip + 1} / {tableTalk.length}</small><strong>{t(tableTalk[tip])}</strong></span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </section>

          <section className="watten-pub-choices" aria-label={t("How would you like to play?")}>
            <div className="watten-pub-choices__intro"><span>{t("CHOOSE YOUR TABLE")}</span><p>{t("How would you like to play?")}</p></div>
            <Link to="/games/watten/singleplayer" className="watten-pub-choice watten-pub-choice--local">
              <span className="watten-pub-choice__icon"><Gamepad2 size={24} aria-hidden="true" /></span>
              <span className="watten-pub-choice__text"><small>{t("3 OR 4 PLAYERS · BOTS")}</small><strong>{t("Singleplayer")}</strong><span>{t("Play against bots filling the remaining seats.")}</span></span>
              <span className="watten-pub-choice__arrow"><ArrowRight size={21} aria-hidden="true" /></span>
            </Link>
            <Link to="/games/watten/hotseat" className="watten-pub-choice watten-pub-choice--local">
              <span className="watten-pub-choice__icon"><Gamepad2 size={24} aria-hidden="true" /></span>
              <span className="watten-pub-choice__text"><small>{t("ONE DEVICE · 3 OR 4 PLAYERS")}</small><strong>Hotseat</strong><span>{t("Pass the device around the table and play together.")}</span></span>
              <span className="watten-pub-choice__arrow"><ArrowRight size={21} aria-hidden="true" /></span>
            </Link>
            <Link to="/games/watten/multiplayer" className="watten-pub-choice watten-pub-choice--online">
              <span className="watten-pub-choice__icon"><Users size={24} aria-hidden="true" /></span>
              <span className="watten-pub-choice__text"><small>{t("PRIVATE ROOM · ONLINE")}</small><strong>{t("Multiplayer")}</strong><span>{t("Invite your friends with a room code.")}</span></span>
              <span className="watten-pub-choice__arrow"><ArrowRight size={21} aria-hidden="true" /></span>
            </Link>
            <Link to="/games/watten/rules" className="watten-pub-rules"><BookOpen size={22} aria-hidden="true" /><span><strong>{t("Learn the rules")}</strong><small>{t("Card ranking, Abheben, Gehen, Trumpf oder Kritisch and concrete trick situations.")}</small></span><ArrowRight size={19} aria-hidden="true" /></Link>
            <p className="watten-pub-choices__footer">✦ <span>{t("One good round deserves another.")}</span> ✦</p>
          </section>
        </div>
      </div>
    </div>
  </main>;
}
