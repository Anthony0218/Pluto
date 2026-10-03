import { decodePixelAvatar, PIXEL_PALETTE, PIXEL_SIZE } from "./pixelAvatar";

type Mood = "happy" | "smile" | "calm" | "serious" | "wink" | "excited";

type HairStyle =
  | "short"
  | "curly"
  | "side"
  | "buzz"
  | "quiff"
  | "bald"
  | "bob"
  | "long"
  | "pony"
  | "bun"
  | "curlyLong"
  | "pixie";

type AvatarKind = "human" | "animal";
type AnimalSpecies = "cat" | "dog" | "guineaPig" | "lion";

type AvatarPreset = {
  id: string;
  name: string;
  kind: AvatarKind;

  gender?: "male" | "female";
  species?: AnimalSpecies;

  skin?: string;
  hair?: string;
  shirt?: string;

  background: string;
  hairStyle?: HairStyle;
  mood?: Mood;

  glasses?: boolean;
  freckles?: boolean;
  wrinkles?: boolean;
  beard?: boolean;

  fur?: string;
  earInner?: string;
  muzzle?: string;
  nose?: string;
};
const avatarPresets: AvatarPreset[] = [
  {
    id: "m1",
    name: "Happy",
    kind: "human",
    gender: "male",
    skin: "#f1c7a5",
    hair: "#3f2718",
    shirt: "#3b82f6",
    background: "#172554",
    hairStyle: "short",
    mood: "happy",
  },
  {
    id: "m2",
    name: "Curly",
    kind: "human",
    gender: "male",
    skin: "#c98e67",
    hair: "#20150f",
    shirt: "#16a34a",
    background: "#052e16",
    hairStyle: "curly",
    mood: "smile",
  },
  {
    id: "m3",
    name: "Cool",
    kind: "human",
    gender: "male",
    skin: "#edbb91",
    hair: "#c15c32",
    shirt: "#a855f7",
    background: "#3b0764",
    hairStyle: "side",
    mood: "calm",
    glasses: true,
  },
  {
    id: "m4",
    name: "Focused",
    kind: "human",
    gender: "male",
    skin: "#8d573a",
    hair: "#17110e",
    shirt: "#f97316",
    background: "#431407",
    hairStyle: "buzz",
    mood: "serious",
  },
  {
    id: "m5",
    name: "Wink",
    kind: "human",
    gender: "male",
    skin: "#f0bf9a",
    hair: "#d7d7d7",
    shirt: "#06b6d4",
    background: "#083344",
    hairStyle: "quiff",
    mood: "wink",
  },
  {
    id: "m6",
    name: "Excited",
    kind: "human",
    gender: "male",
    skin: "#70452f",
    hair: "#211610",
    shirt: "#eab308",
    background: "#422006",
    hairStyle: "bald",
    mood: "excited",
  },

  {
    id: "f1",
    name: "Happy",
    kind: "human",
    gender: "female",
    skin: "#f4c9aa",
    hair: "#3a2418",
    shirt: "#ec4899",
    background: "#500724",
    hairStyle: "bob",
    mood: "happy",
  },
  {
    id: "f2",
    name: "Long Hair",
    kind: "human",
    gender: "female",
    skin: "#c98b65",
    hair: "#17110e",
    shirt: "#8b5cf6",
    background: "#2e1065",
    hairStyle: "long",
    mood: "smile",
  },
  {
    id: "f3",
    name: "Ponytail",
    kind: "human",
    gender: "female",
    skin: "#f0bd91",
    hair: "#a84b28",
    shirt: "#14b8a6",
    background: "#042f2e",
    hairStyle: "pony",
    mood: "wink",
  },
  {
    id: "f4",
    name: "Bun",
    kind: "human",
    gender: "female",
    skin: "#916044",
    hair: "#231713",
    shirt: "#f59e0b",
    background: "#451a03",
    hairStyle: "bun",
    mood: "calm",
    glasses: true,
  },
  {
    id: "f5",
    name: "Curly",
    kind: "human",
    gender: "female",
    skin: "#e4aa82",
    hair: "#5d321d",
    shirt: "#ef4444",
    background: "#450a0a",
    hairStyle: "curlyLong",
    mood: "excited",
  },
  {
    id: "f6",
    name: "Pixie",
    kind: "human",
    gender: "female",
    skin: "#6f4634",
    hair: "#16100d",
    shirt: "#0ea5e9",
    background: "#082f49",
    hairStyle: "pixie",
    mood: "serious",
  },

  /* NEW HUMAN AVATARS */
  {
    id: "m7",
    name: "Old Man",
    kind: "human",
    gender: "male",
    skin: "#d8b091",
    hair: "#d6d6d6",
    shirt: "#64748b",
    background: "#1e293b",
    hairStyle: "short",
    mood: "calm",
    glasses: true,
    wrinkles: true,
    beard: true,
  },
  {
    id: "f7",
    name: "Old Woman",
    kind: "human",
    gender: "female",
    skin: "#ddb69a",
    hair: "#d9d9d9",
    shirt: "#a855f7",
    background: "#312e81",
    hairStyle: "bun",
    mood: "smile",
    glasses: true,
    wrinkles: true,
  },
  {
    id: "f8",
    name: "Freckles",
    kind: "human",
    gender: "female",
    skin: "#f4c8a7",
    hair: "#d95d39",
    shirt: "#22c55e",
    background: "#14532d",
    hairStyle: "long",
    mood: "happy",
    freckles: true,
  },

  /* NEW ANIMALS */
  {
    id: "a1",
    name: "Cat",
    kind: "animal",
    species: "cat",
    background: "#1f2937",
    fur: "#f59e0b",
    earInner: "#fbcfe8",
    muzzle: "#fff7ed",
    nose: "#7c2d12",
    shirt: "#f59e0b",
  },
  {
    id: "a2",
    name: "Dog",
    kind: "animal",
    species: "dog",
    background: "#3f3f46",
    fur: "#c08457",
    earInner: "#fed7aa",
    muzzle: "#fafaf9",
    nose: "#18181b",
    shirt: "#c08457",
  },
  {
    id: "a3",
    name: "Guinea Pig",
    kind: "animal",
    species: "guineaPig",
    background: "#3b2f2f",
    fur: "#f5d0a9",
    earInner: "#fbcfe8",
    muzzle: "#fffaf5",
    nose: "#7c3f00",
    shirt: "#f5d0a9",
  },
  {
    id: "a4",
    name: "Lion",
    kind: "animal",
    species: "lion",
    background: "#451a03",
    fur: "#fbbf24",
    earInner: "#fed7aa",
    muzzle: "#fff7ed",
    nose: "#7c2d12",
    shirt: "#fbbf24",
  },
];

export function ProfileAvatar({
  avatarId,
  className = "",
}: {
  avatarId: string;
  className?: string;
}) {
  const pixels = decodePixelAvatar(avatarId);
  if (pixels) return <PixelAvatarImage pixels={pixels} className={className} />;

  const avatar =
    avatarPresets.find((item) => item.id === avatarId) ?? avatarPresets[0];

  if (avatar.kind === "animal") {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        role="img"
        aria-label={avatar.name}
      >
        <rect width="100" height="100" rx="24" fill={avatar.background} />

        {/* body */}
        <path
          d="M17 100 C19 78 31 71 50 71 C69 71 81 78 83 100"
          fill={avatar.shirt ?? avatar.fur ?? "#888"}
        />

        {/* ears */}
        <path d="M28 28 L38 12 L45 30 Z" fill={avatar.fur} />
        <path d="M72 28 L62 12 L55 30 Z" fill={avatar.fur} />
        <path d="M33 26 L38 17 L42 28 Z" fill={avatar.earInner} />
        <path d="M67 26 L62 17 L58 28 Z" fill={avatar.earInner} />

        {/* lion mane */}
        {avatar.species === "lion" && (
          <>
            <circle cx="50" cy="44" r="31" fill="#92400e" />
            {[24, 33, 42, 58, 67, 76].map((x, i) => (
              <circle
                key={x}
                cx={x}
                cy={i % 2 === 0 ? 30 : 58}
                r="10"
                fill="#a16207"
              />
            ))}
          </>
        )}

        {/* floppy dog ears */}
        {avatar.species === "dog" && (
          <>
            <ellipse
              cx="24"
              cy="40"
              rx="8"
              ry="18"
              fill="#8b5e3c"
              transform="rotate(12 24 40)"
            />
            <ellipse
              cx="76"
              cy="40"
              rx="8"
              ry="18"
              fill="#8b5e3c"
              transform="rotate(-12 76 40)"
            />
          </>
        )}

        {/* face */}
        <circle cx="50" cy="44" r="24" fill={avatar.fur} />

        {/* guinea pig cheeks */}
        {avatar.species === "guineaPig" && (
          <>
            <circle cx="34" cy="54" r="8" fill={avatar.muzzle} />
            <circle cx="66" cy="54" r="8" fill={avatar.muzzle} />
          </>
        )}

        {/* muzzle */}
        <ellipse
          cx="50"
          cy="57"
          rx={avatar.species === "cat" ? 13 : 16}
          ry={avatar.species === "cat" ? 10 : 12}
          fill={avatar.muzzle}
        />

        {/* eyes */}
        <circle cx="40" cy="44" r="3" fill="#111827" />
        <circle cx="60" cy="44" r="3" fill="#111827" />

        {/* nose */}
        {avatar.species === "cat" ? (
          <path d="M46 54 L54 54 L50 58 Z" fill={avatar.nose} />
        ) : (
          <ellipse cx="50" cy="54" rx="5" ry="4" fill={avatar.nose} />
        )}

        {/* mouth */}
        <path
          d="M50 58 L50 62"
          stroke="#6b2117"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M50 62 Q46 66 42 64"
          stroke="#6b2117"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M50 62 Q54 66 58 64"
          stroke="#6b2117"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* whiskers */}
        {(avatar.species === "cat" ||
          avatar.species === "lion" ||
          avatar.species === "guineaPig") && (
          <>
            <path d="M21 55 H37" stroke="#5b4636" strokeWidth="1.5" />
            <path d="M24 60 H37" stroke="#5b4636" strokeWidth="1.5" />
            <path d="M63 55 H79" stroke="#5b4636" strokeWidth="1.5" />
            <path d="M63 60 H76" stroke="#5b4636" strokeWidth="1.5" />
          </>
        )}
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={avatar.name}
    >
      <rect width="100" height="100" rx="24" fill={avatar.background} />

      {/* shoulders */}
      <path
        d="M17 100 C19 78 31 71 50 71 C69 71 81 78 83 100"
        fill={avatar.shirt}
      />

      {/* long hair behind face */}
      {["long", "curlyLong"].includes(avatar.hairStyle ?? "") && (
        <path
          d="M27 42 C25 19 40 12 51 12 C70 12 78 27 75 49 L79 79
             C70 75 62 73 50 73 C38 73 29 76 21 80 L26 50 Z"
          fill={avatar.hair}
        />
      )}

      {avatar.hairStyle === "pony" && (
        <ellipse
          cx="78"
          cy="39"
          rx="12"
          ry="19"
          fill={avatar.hair}
          transform="rotate(18 78 39)"
        />
      )}

      {/* ears */}
      <circle cx="28" cy="48" r="6" fill={avatar.skin} />
      <circle cx="72" cy="48" r="6" fill={avatar.skin} />

      {/* neck */}
      <rect x="43" y="64" width="14" height="16" rx="6" fill={avatar.skin} />

      {/* face */}
      <ellipse cx="50" cy="45" rx="23" ry="28" fill={avatar.skin} />

      {/* hair styles */}
      {avatar.hairStyle === "short" && (
        <path
          d="M27 41 C26 18 40 13 51 14 C66 14 75 25 72 41
             C66 32 58 29 48 29 C39 29 33 34 27 41Z"
          fill={avatar.hair}
        />
      )}

      {avatar.hairStyle === "curly" && (
        <>
          {[29, 37, 45, 53, 61, 69].map((x, index) => (
            <circle
              key={x}
              cx={x}
              cy={index % 2 === 0 ? 27 : 22}
              r="9"
              fill={avatar.hair}
            />
          ))}
        </>
      )}

      {avatar.hairStyle === "side" && (
        <path
          d="M27 42 C27 20 41 13 55 14 C67 15 74 23 73 37
             C61 27 47 26 31 37 Z"
          fill={avatar.hair}
        />
      )}

      {avatar.hairStyle === "buzz" && (
        <path
          d="M28 34 C30 17 42 12 52 13 C65 14 71 21 72 34
             C61 26 40 26 28 34Z"
          fill={avatar.hair}
        />
      )}

      {avatar.hairStyle === "quiff" && (
        <path
          d="M27 39 C26 23 34 18 40 18
             C39 10 51 8 56 17
             C66 13 76 24 72 39
             C61 29 42 27 27 39Z"
          fill={avatar.hair}
        />
      )}

      {avatar.hairStyle === "bob" && (
        <path
          d="M25 48 C22 24 35 12 51 12
             C69 12 78 27 74 53
             L68 65 L67 38
             C58 28 41 27 31 39
             L31 65 Z"
          fill={avatar.hair}
        />
      )}

      {avatar.hairStyle === "long" && (
        <path
          d="M26 42 C24 20 37 12 51 12
             C67 12 77 24 74 45
             C66 30 40 26 27 44Z"
          fill={avatar.hair}
        />
      )}

      {avatar.hairStyle === "pony" && (
        <path
          d="M27 40 C26 20 40 13 52 14
             C66 14 74 25 72 41
             C61 29 40 28 27 40Z"
          fill={avatar.hair}
        />
      )}

      {avatar.hairStyle === "bun" && (
        <>
          <circle cx="52" cy="13" r="12" fill={avatar.hair} />
          <path
            d="M28 40 C28 19 40 14 52 14
               C67 14 75 26 72 41
               C62 30 40 27 28 40Z"
            fill={avatar.hair}
          />
        </>
      )}

      {avatar.hairStyle === "curlyLong" && (
        <>
          {[29, 37, 45, 53, 61, 69].map((x, index) => (
            <circle
              key={x}
              cx={x}
              cy={index % 2 === 0 ? 26 : 21}
              r="9"
              fill={avatar.hair}
            />
          ))}
        </>
      )}

      {avatar.hairStyle === "pixie" && (
        <path
          d="M27 39 C26 22 38 13 52 14
             C62 15 69 20 72 29
             C63 25 60 22 57 19
             C53 26 40 25 27 39Z"
          fill={avatar.hair}
        />
      )}

      {/* eyebrows */}
      <path
        d="M35 39 Q40 36 44 39"
        stroke="#3f2b24"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M56 39 Q61 36 65 39"
        stroke="#3f2b24"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* eyes */}
      {avatar.mood === "wink" ? (
        <>
          <path
            d="M35 46 Q40 50 45 46"
            stroke="#211713"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="61" cy="46" r="2.4" fill="#211713" />
        </>
      ) : avatar.mood === "excited" ? (
        <>
          <path
            d="M35 47 Q40 42 45 47"
            stroke="#211713"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M55 47 Q60 42 65 47"
            stroke="#211713"
            strokeWidth="2"
            fill="none"
          />
        </>
      ) : (
        <>
          <circle cx="40" cy="46" r="2.4" fill="#211713" />
          <circle cx="60" cy="46" r="2.4" fill="#211713" />
        </>
      )}

      {/* glasses */}
      {avatar.glasses && (
        <>
          <circle
            cx="40"
            cy="46"
            r="7"
            fill="none"
            stroke="#171717"
            strokeWidth="2"
          />
          <circle
            cx="60"
            cy="46"
            r="7"
            fill="none"
            stroke="#171717"
            strokeWidth="2"
          />
          <path d="M47 46 H53" stroke="#171717" strokeWidth="2" />
        </>
      )}

      {/* nose */}
      <path
        d="M50 47 L48 55 L52 55"
        stroke="#b9785d"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* freckles */}
      {avatar.freckles && (
        <>
          <circle cx="37" cy="54" r="1" fill="#b45309" />
          <circle cx="41" cy="56" r="1" fill="#b45309" />
          <circle cx="44" cy="53" r="1" fill="#b45309" />
          <circle cx="56" cy="53" r="1" fill="#b45309" />
          <circle cx="59" cy="56" r="1" fill="#b45309" />
          <circle cx="63" cy="54" r="1" fill="#b45309" />
        </>
      )}

      {/* wrinkles */}
      {avatar.wrinkles && (
        <>
          <path
            d="M32 34 Q40 32 46 34"
            stroke="#b08968"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M54 34 Q60 32 68 34"
            stroke="#b08968"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M38 60 Q50 63 62 60"
            stroke="#b08968"
            strokeWidth="1"
            fill="none"
          />
        </>
      )}

      {/* beard */}
      {avatar.beard && (
        <path d="M39 58 Q50 72 61 58 L60 66 Q50 77 40 66 Z" fill="#d7d7d7" />
      )}

      {/* mouth */}
      {avatar.mood === "serious" && (
        <path
          d="M43 61 H57"
          stroke="#7f4038"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}

      {avatar.mood === "calm" && (
        <path
          d="M43 60 Q50 64 57 60"
          stroke="#7f4038"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {["happy", "smile", "wink"].includes(avatar.mood ?? "") && (
        <path
          d="M41 59 Q50 69 59 59"
          stroke="#7f4038"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {avatar.mood === "excited" && (
        <ellipse cx="50" cy="62" rx="7" ry="5" fill="#7f4038" />
      )}
    </svg>
  );
}

export function PixelAvatarImage({ pixels, className = "" }: { pixels: number[]; className?: string }) {
  return (
    <svg viewBox={`0 0 ${PIXEL_SIZE} ${PIXEL_SIZE}`} className={className} role="img" aria-label="Pixel avatar" shapeRendering="crispEdges">
      <rect width={PIXEL_SIZE} height={PIXEL_SIZE} fill={PIXEL_PALETTE[0]} />
      {pixels.map((index, cell) => index === 0 ? null : (
        <rect key={cell} x={cell % PIXEL_SIZE} y={Math.floor(cell / PIXEL_SIZE)} width="1.02" height="1.02" fill={PIXEL_PALETTE[index]} />
      ))}
    </svg>
  );
}

export default function ProfileAvatarPicker({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: string;
  onSelect: (avatarId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
      {avatarPresets.map((avatar) => {
        const active = selected === avatar.id;

        return (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onSelect(avatar.id)}
            title={avatar.name}
            aria-pressed={active}
            disabled={disabled}
            className={`
              overflow-hidden
              rounded-2xl
              border
              p-1
              transition
              hover:-translate-y-1
              ${
                active
                  ? "border-amber-300 bg-amber-400/10 ring-2 ring-amber-400/20"
                  : "border-white/10 bg-white/5 hover:border-white/25"
              }
            `}
          >
            <ProfileAvatar
              avatarId={avatar.id}
              className="aspect-square w-full rounded-xl"
            />

            <p
              className={`py-1 text-[9px] font-bold ${
                active ? "text-amber-300" : "text-zinc-400"
              }`}
            >
              {avatar.name}
            </p>
          </button>
        );
      })}
    </div>
  );
}
