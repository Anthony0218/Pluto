import { COLORS } from "../../../games/party/config.ts";
export function CharacterFace({ avatarId, color = COLORS[avatarId % 4] }: { avatarId: number; color?: string }) {
  const id = avatarId % 4;
  return <svg viewBox="0 0 64 72" aria-hidden="true" className="pp-character-face">
    {id === 0 && <><path d="M12 33 5 7 26 20M52 33 59 7 38 20" fill="#e89751" stroke="#713e38" strokeWidth="2"/><path d="M12 24 10 13 20 21M52 24 54 13 44 21" fill="#ffe0c1"/></>}
    {id === 1 && <><ellipse cx="22" cy="18" rx="8" ry="17" fill="#fff0e6"/><ellipse cx="43" cy="17" rx="8" ry="17" fill="#fff0e6"/><path d="M22 7V24M43 6V23" stroke="#e7a3b0" strokeWidth="5" strokeLinecap="round"/></>}
    {id === 3 ? <path d="M9 62V34C9 6 55 6 55 34V62L47 57 39 64 31 58 22 64 15 58Z" fill="#e5eaff" stroke="#9aa2d4" strokeWidth="2"/> : <ellipse cx="32" cy="41" rx="24" ry="24" fill={id === 0 ? "#edaa65" : id === 1 ? "#fff0e6" : "#eac19b"} stroke="#62464c" strokeWidth="2"/>}
    {id === 0 && <path d="M11 43Q17 60 32 61Q47 60 53 43L38 45 32 51 26 45Z" fill="#ffeed5"/>}
    {id === 2 && <><path d="M9 30 17 10H45L55 30Z" fill="#8caa77" stroke="#344f54" strokeWidth="2"/><rect x="4" y="26" width="56" height="7" rx="3" fill="#bdd19a"/><path d="M18 21H46" stroke="#5d715c" strokeWidth="5"/></>}
    <ellipse cx="23" cy="40" rx="3" ry="4" fill="#26354a"/><ellipse cx="42" cy="40" rx="3" ry="4" fill="#26354a"/>
    <path d="M27 50Q32 55 37 50" fill="none" stroke="#26354a" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M13 61Q31 70 51 61L49 68H15Z" fill={color}/><path d="M37 65 42 72 49 68" fill={color}/>
  </svg>;
}
