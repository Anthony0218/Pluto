import type {
  AttackActionId,
  DefenseActionId,
  SkillActionId,
} from "../../games/MedievalKingdoms/types";

export type ActionIconId =
  | "move"
  | "finish"
  | AttackActionId
  | DefenseActionId
  | SkillActionId;

export default function ActionIcon({
  id,
  className = "h-6 w-6",
}: {
  id: ActionIconId;
  className?: string;
}) {
  const line = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const content = (() => {
    switch (id) {
      case "move":
        return (
          <>
            <path {...line} d="M12 2v20M2 12h20" />
            <path
              {...line}
              d="m12 2-3 3m3-3 3 3M22 12l-3-3m3 3-3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3"
            />
          </>
        );
      case "quick":
        return (
          <>
            <path {...line} d="M4 20 16 8" />
            <path {...line} d="m13 5 6-2-2 6-4-4Z" />
            <path {...line} d="m3 21 5-1-4-4-1 5Z" />
          </>
        );
      case "melee":
        return (
          <>
            <circle {...line} cx="12" cy="12" r="8" />
            <circle {...line} cx="12" cy="12" r="4" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          </>
        );
      case "power":
        return (
          <>
            <path {...line} d="m4 18 11-11" />
            <path {...line} d="m13 5 6-2-2 6" />
            <path {...line} d="M4 6h4M6 4v4M16 16h4M18 14v4" />
          </>
        );
      case "sweep":
        return (
          <>
            <path {...line} d="M5 17c5-8 9-8 14 0" />
            <path {...line} d="m5 17 1-5m-1 5 5-1M19 17l-1-5m1 5-5-1" />
          </>
        );
      case "charge":
        return (
          <>
            <path {...line} d="M3 16h8l4-4-4-4H3" />
            <path {...line} d="m14 5 7 7-7 7" />
          </>
        );
      case "area":
        return (
          <>
            <circle {...line} cx="12" cy="12" r="3" />
            <circle {...line} cx="12" cy="12" r="7" />
            <path {...line} d="M12 1v4M12 19v4M1 12h4M19 12h4" />
          </>
        );
      case "knockback":
        return (
          <>
            <path {...line} d="M3 12h13" />
            <path {...line} d="m12 7 5 5-5 5" />
            <path {...line} d="M20 5v14" />
          </>
        );
      case "archer":
        return (
          <>
            <path {...line} d="M6 3c7 4 7 14 0 18" />
            <path {...line} d="M6 3v18M8 12h13" />
            <path {...line} d="m18 9 3 3-3 3" />
          </>
        );
      case "brace":
        return (
          <>
            <path {...line} d="M12 2 5 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5l-7-3Z" />
            <path {...line} d="M8 12h8" />
          </>
        );
      case "dodge":
        return (
          <>
            <path {...line} d="M4 15c4-7 8-7 12 0" />
            <path {...line} d="m3 8 4-3M17 5l4 3M12 10v9" />
          </>
        );
      case "counter":
        return (
          <>
            <path {...line} d="m5 4 14 16M19 4 5 20" />
            <path {...line} d="M4 4h5M15 4h5" />
          </>
        );
      case "guard":
        return (
          <>
            <circle {...line} cx="8" cy="12" r="4" />
            <circle {...line} cx="17" cy="12" r="4" />
            <path {...line} d="M12 12h1" />
          </>
        );
      case "shield":
        return (
          <>
            <path {...line} d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-4Z" />
            <path {...line} d="M12 5v14" />
          </>
        );
      case "cover":
        return (
          <>
            <path {...line} d="M4 20c3-8 6-12 8-16 2 4 5 8 8 16" />
            <path {...line} d="M7 14h10M9 10h6" />
          </>
        );
      case "fortify":
        return (
          <>
            <path {...line} d="M3 21V9h4V5h4v4h4V5h4v16" />
            <path {...line} d="M3 21h18M9 21v-5h6v5" />
          </>
        );
      case "evade":
        return (
          <>
            <path {...line} d="M4 8h11M4 12h15M4 16h9" />
            <path {...line} d="m16 6 4 6-4 6" />
          </>
        );
      case "heal":
        return <path {...line} d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />;
      case "damageBoost":
        return (
          <>
            <path {...line} d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" />
            <path {...line} d="M12 8v8M8 12h8" />
          </>
        );
      case "trap":
        return (
          <>
            <path {...line} d="M4 6h16l-3 12H7L4 6Z" />
            <path {...line} d="m7 9 3 3-3 3M17 9l-3 3 3 3" />
          </>
        );
      case "teleport":
        return (
          <>
            <circle {...line} cx="12" cy="12" r="8" />
            <path {...line} d="M8 12h8M13 8l4 4-4 4M5 5 3 3M19 19l2 2" />
          </>
        );
      case "burn":
        return (
          <path
            {...line}
            d="M13 2c1 5-4 6-2 10 1 2 4 2 4-1 4 4 3 11-3 11-6 0-8-7-4-11 0 3 3 3 3 1-2-4 3-6 2-10Z"
          />
        );
      case "finish":
        return (
          <>
            <path {...line} d="M5 3v18" />
            <path {...line} d="M5 4h13l-3 4 3 4H5" />
          </>
        );
    }
  })();

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {content}
    </svg>
  );
}
