import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import GameXpReward from "@/components/games/GameXpReward";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BATTLES,
  createInitialBattleState,
} from "../../games/MedievalKingdoms/battleData";
import {
  applyDefenseAction,
  archerAttackAtPoint,
  areaAttackAtPoint,
  attackUnit,
  boostTarget,
  burnTarget,
  canMeleeAttack,
  chargeAttack,
  endTurn,
  findRayTarget,
  finishUnit,
  healTarget,
  meleeAttack,
  moveUnitWithTerrain,
  placeTrap,
  spendAttackIntoAir,
  sweepAttack,
  teleportCaster,
} from "../../games/MedievalKingdoms/battleEngine";
import { TerrainMask } from "../../games/MedievalKingdoms/terrainMask";
import type {
  AimStage,
  AttackActionId,
  BattleState,
  DefenseActionId,
  HitEffect,
  Position,
  PreviewAction,
  GameMode,
  GameModeConfig,
  FactionId,
  SkillActionId,
  TerrainType,
  Unit,
} from "../../games/MedievalKingdoms/types";
import UnitToken from "./UnitToken";
import RangeZone from "./RangeZone";
import ObjectiveMarker from "./ObjectiveMarker";
import ClanCornerBadges from "./ClanCornerBadges";
import BattleSidebar from "./BattleSidebar";
import AttackAimOverlay from "./AttackAimOverlay";
import ArcherAimOverlay from "./ArcherAimOverlay";
import AreaTargetOverlay from "./AreaTargetOverlay";
import ProjectileOverlay from "./ProjectileOverlay";
import DamagePopup from "./DamagePopup";
import ArmyStatusBar from "./ArmyStatusBar";
import MeleeTimingOverlay from "./MeleeTimingOverlay";
import TrapMarker from "./TrapMarker";
import SpellEffectOverlay from "./SpellEffectOverlay";
import BattlefieldObjectMarker from "./BattlefieldObjectMarker";
import BattlefieldObjectPanel from "./BattlefieldObjectPanel";
import {
  applyLandingObjectEffects,
  applyObjectInteraction,
  getObjectMovementRule,
  unitCanInteractWithObject,
} from "../../games/MedievalKingdoms/objectInteractions";
import SkillPreviewOverlay from "./SkillPreviewOverlay";
import {
  evaluateGameMode,
  GAME_MODE_DESCRIPTIONS,
  GAME_MODE_LABELS,
} from "../../games/MedievalKingdoms/gameModes";

type Props = {
  battleId: string;
  gameMode?: GameMode;
  gameModeConfig?: GameModeConfig;
  playerFaction?: FactionId;
  backPath?: string;
  onVictory?: (winner: FactionId) => void;
};
type PendingProjectile = {
  start: Position;
  end: Position;
  kind: "straight" | "archer";
  resultState: BattleState;
  hitEffects: HitEffect[];
  arcHeight: number;
};
type PendingSpell = {
  kind: SkillActionId;
  start: Position;
  end: Position;
  resultState: BattleState;
  hitEffects: HitEffect[];
};

export default function Battlefield({
  battleId,
  gameMode = "capture",
  gameModeConfig,
  playerFaction = "falconstone",
  backPath = "/games/medieval-kingdoms/legacy",
  onVictory,
}: Props) {
  useGameLanguage();
  const navigate = useNavigate();
  const battle = BATTLES[battleId] ?? BATTLES["falcon-bridge"];
  const [game, setGame] = useState(() => createInitialBattleState(battle.id));
  const reportedWinnerRef = useRef<FactionId | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  const [pinnedUnitId, setPinnedUnitId] = useState<string | null>(null);
  const [message, setMessage] = useState("Select a unit.");
  const [maskReady, setMaskReady] = useState(false);
  const terrainMaskRef = useRef<TerrainMask | null>(null);

  const [moveMode, setMoveMode] = useState(false);
  const [aimMode, setAimMode] = useState(false);
  const [aimStage, setAimStage] = useState<AimStage>(null);
  const [attackAction, setAttackAction] = useState<AttackActionId | null>(null);
  const [skillAction, setSkillAction] = useState<SkillActionId | null>(null);
  const [previewAction, setPreviewAction] = useState<PreviewAction>(null);
  const [aimAngle, setAimAngle] = useState(0);
  const [previewAngle, setPreviewAngle] = useState(0);
  const [elevation, setElevation] = useState(20);
  const [timingValue, setTimingValue] = useState(20);
  const timingDirectionRef = useRef(1);

  const [meleeTargetId, setMeleeTargetId] = useState<string | null>(null);
  const [meleePulse, setMeleePulse] = useState(1);
  const meleeDirectionRef = useRef(-1);

  const [projectile, setProjectile] = useState<PendingProjectile | null>(null);
  const [pendingSpell, setPendingSpell] = useState<PendingSpell | null>(null);
  const [hitFlashUnitIds, setHitFlashUnitIds] = useState<string[]>([]);
  const [damageEffects, setDamageEffects] = useState<HitEffect[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    position: Position;
    legal: boolean;
    reason: string;
  } | null>(null);

  const selectedUnit = useMemo(
    () => game.units.find((u) => u.id === selectedUnitId) ?? null,
    [game.units, selectedUnitId],
  );
  const hoveredUnit = useMemo(
    () => game.units.find((u) => u.id === hoveredUnitId) ?? null,
    [game.units, hoveredUnitId],
  );
  const pinnedUnit = useMemo(
    () => game.units.find((u) => u.id === pinnedUnitId) ?? null,
    [game.units, pinnedUnitId],
  );
  const meleeTarget = useMemo(
    () => game.units.find((u) => u.id === meleeTargetId) ?? null,
    [game.units, meleeTargetId],
  );
  const hasMeleeTargets = useMemo(
    () =>
      selectedUnit !== null &&
      game.units.some((unit) =>
        canMeleeAttack(selectedUnit, unit, battle.mapAspectRatio),
      ),
    [selectedUnit, game.units, battle.mapAspectRatio],
  );

  const selectedObject = useMemo(
    () => game.objects.find((object) => object.id === selectedObjectId) ?? null,
    [game.objects, selectedObjectId],
  );

  const selectedObjectInRange = selectedObject
    ? unitCanInteractWithObject(
        selectedUnit,
        selectedObject,
        battle.mapAspectRatio,
      )
    : false;

  useEffect(() => {
    setGame(createInitialBattleState(battle.id));
    setSelectedUnitId(null);
    setPinnedUnitId(null);
    setHoveredUnitId(null);
    setSelectedObjectId(null);
    setDragPreview(null);
    clearInteraction();
    setProjectile(null);
    setPendingSpell(null);
    setMaskReady(false);
    const mask = new TerrainMask();
    terrainMaskRef.current = mask;
    let cancelled = false;
    void mask.load(battle.terrainMask).then(() => {
      if (!cancelled) {
        setMaskReady(true);
        setMessage("Terrain ready.");
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.id, battle.terrainMask]);

  useEffect(() => {
    reportedWinnerRef.current = null;
  }, [battle.id, gameMode]);

  useEffect(() => {
    if (!game.winner || reportedWinnerRef.current === game.winner) {
      return;
    }

    reportedWinnerRef.current = game.winner;

    onVictory?.(game.winner);
  }, [game.winner, onVictory]);

  useEffect(() => {
    if (!aimMode || aimStage !== "direction" || projectile || pendingSpell)
      return;
    const timer = window.setInterval(
      () => setAimAngle((a) => (a + 1.55) % 360),
      20,
    );
    return () => window.clearInterval(timer);
  }, [aimMode, aimStage, projectile, pendingSpell]);

  useEffect(() => {
    if (!previewAction || aimMode || moveMode) return;
    const timer = window.setInterval(
      () => setPreviewAngle((a) => (a + 1.15) % 360),
      25,
    );
    return () => window.clearInterval(timer);
  }, [previewAction, aimMode, moveMode]);

  useEffect(() => {
    if (
      !aimMode ||
      !["power", "distance", "elevation"].includes(aimStage ?? "") ||
      projectile ||
      pendingSpell
    )
      return;
    const timer = window.setInterval(() => {
      const setter = aimStage === "elevation" ? setElevation : setTimingValue;
      setter((current) => {
        let next = current + timingDirectionRef.current * 1.6;
        if (next >= 90) {
          next = 90;
          timingDirectionRef.current = -1;
        }
        if (next <= 10) {
          next = 10;
          timingDirectionRef.current = 1;
        }
        return next;
      });
    }, 24);
    return () => window.clearInterval(timer);
  }, [aimMode, aimStage, projectile, pendingSpell]);

  useEffect(() => {
    if (!aimMode || aimStage !== "meleeTiming" || !meleeTarget) return;
    const timer = window.setInterval(
      () =>
        setMeleePulse((current) => {
          let next = current + meleeDirectionRef.current * 0.025;
          if (next <= 0) {
            next = 0;
            meleeDirectionRef.current = 1;
          }
          if (next >= 1) {
            next = 1;
            meleeDirectionRef.current = -1;
          }
          return next;
        }),
      18,
    );
    return () => window.clearInterval(timer);
  }, [aimMode, aimStage, meleeTarget]);

  function terrainFor(unit: Unit | null): TerrainType | null {
    if (!unit || !maskReady || !terrainMaskRef.current) return null;
    return terrainMaskRef.current.getTerrainAtPosition(unit.position);
  }

  function clearInteraction() {
    setMoveMode(false);
    setAimMode(false);
    setAimStage(null);
    setAttackAction(null);
    setSkillAction(null);
    setMeleeTargetId(null);
    setPreviewAction(null);
  }

  function selectAndPin(unit: Unit) {
    if (skillAction) {
      handleSkillUnitTarget(unit);
      return;
    }
    if (aimMode && attackAction === "melee" && aimStage === "meleeTarget") {
      chooseMeleeTarget(unit);
      return;
    }
    setPinnedUnitId(unit.id);
    if (unit.faction === game.activeFaction && !game.winner) {
      setSelectedUnitId(unit.id);
      clearInteraction();
    }
  }

  function eventToPosition(
    clientX: number,
    clientY: number,
    element: HTMLElement,
  ): Position {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function movementPreview(target: Position): {
    legal: boolean;
    reason: string;
  } {
    if (!selectedUnit || !terrainMaskRef.current) {
      return {
        legal: false,
        reason: "No selected unit",
      };
    }

    const terrain = terrainMaskRef.current.getTerrainAtPosition(target);

    if (terrain === "river") {
      return {
        legal: false,
        reason: "River / lethal terrain",
      };
    }

    if (terrain === "blocked") {
      return {
        legal: false,
        reason: "Impassable terrain",
      };
    }

    if (terrain === "highGround") {
      return {
        legal: false,
        reason: "Steep high ground — use a platform",
      };
    }

    const objectRule = getObjectMovementRule(
      selectedUnit,
      target,
      game.objects,
      battle.mapAspectRatio,
    );

    if (!objectRule.legal) {
      return {
        legal: false,
        reason: objectRule.reason,
      };
    }

    const test = moveUnitWithTerrain(
      game,
      selectedUnit.id,
      target,
      terrainMaskRef.current,
      battle.mapAspectRatio,
    );

    if (!test.moved) {
      return {
        legal: false,
        reason: "Outside move range or blocked route",
      };
    }

    if (test.died) {
      return {
        legal: false,
        reason: "Lethal destination",
      };
    }

    return {
      legal: true,
      reason: "Legal move",
    };
  }

  function performMove(target: Position) {
    if (!selectedUnit || !moveMode || !terrainMaskRef.current) return;

    const preview = movementPreview(target);

    if (!preview.legal) {
      setMessage(`Illegal move: ${preview.reason}.`);
      setDragPreview(null);
      return;
    }

    const result = moveUnitWithTerrain(
      game,
      selectedUnit.id,
      target,
      terrainMaskRef.current,
      battle.mapAspectRatio,
    );
    const landing = applyLandingObjectEffects(
      result.state,
      selectedUnit.id,
      target,
      battle.mapAspectRatio,
    );

    setGame(landing.state);

    setMessage([result.message, ...landing.messages].filter(Boolean).join(" "));

    setMoveMode(false);
    setDragPreview(null);

    if (landing.damage > 0) {
      const effect: HitEffect = {
        targetId: selectedUnit.id,
        damage: landing.damage,
        hit: true,
        position: target,
        label: "HAZARD",
      };

      setDamageEffects([effect]);

      setHitFlashUnitIds([selectedUnit.id]);

      window.setTimeout(() => {
        setDamageEffects([]);

        setHitFlashUnitIds([]);
      }, 1000);
    }

    if (result.trapTriggered) {
      const effect: HitEffect = {
        targetId: selectedUnit.id,
        damage: result.trapDamage ?? 0,
        hit: true,
        position: target,
        label: "TRAP",
      };
      setDamageEffects([effect]);
      setHitFlashUnitIds([selectedUnit.id]);
      window.setTimeout(() => {
        setDamageEffects([]);
        setHitFlashUnitIds([]);
      }, 1000);
    }
  }

  function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    const position = eventToPosition(
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
    if (skillAction === "trap" || skillAction === "teleport") {
      handleSkillMapTarget(position);
      return;
    }
    if (moveMode) performMove(position);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!moveMode || !selectedUnit) return;
    event.preventDefault();
    performMove(
      eventToPosition(event.clientX, event.clientY, event.currentTarget),
    );
    setDragPreview(null);
  }

  function startMove() {
    if (
      !pinnedUnit ||
      pinnedUnit.hasMoved ||
      pinnedUnit.faction !== game.activeFaction
    )
      return;
    setSelectedUnitId(pinnedUnit.id);
    setMoveMode(true);
    setAimMode(false);
    setAttackAction(null);
    setSkillAction(null);
    setMessage(`Drag ${pinnedUnit.name} to its destination.`);
  }

  function rayEndPoint(unit: Unit, range: number, angle = aimAngle): Position {
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.max(0, Math.min(100, unit.position.x + Math.cos(rad) * range)),
      y: Math.max(
        0,
        Math.min(
          100,
          unit.position.y + (Math.sin(rad) * range) / battle.mapAspectRatio,
        ),
      ),
    };
  }

  const timedTargetPoint = useMemo(() => {
    if (!selectedUnit) return null;
    const value = aimStage === "elevation" ? elevation : timingValue;
    const normalized = (value - 10) / 80;
    return rayEndPoint(
      selectedUnit,
      selectedUnit.attackRange * (0.22 + normalized * 0.78),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedUnit,
    timingValue,
    elevation,
    aimAngle,
    aimStage,
    battle.mapAspectRatio,
  ]);

  function startAttack(action: AttackActionId) {
    if (
      !pinnedUnit ||
      pinnedUnit.faction !== game.activeFaction ||
      pinnedUnit.hasActed ||
      game.winner
    )
      return;
    setSelectedUnitId(pinnedUnit.id);
    setMoveMode(false);
    setSkillAction(null);
    setAttackAction(action);
    setAimMode(true);
    if (action === "melee") {
      setAimStage("meleeTarget");
      setMeleeTargetId(null);
      setMessage("Melee Precision: click a nearby enemy.");
      return;
    }
    setAimStage("direction");
    setAimAngle(0);
    setTimingValue(20);
    setElevation(20);
    timingDirectionRef.current = 1;
    setMessage(`${action}: time the rotating silver pointer.`);
  }

  function chooseMeleeTarget(unit: Unit) {
    if (
      !selectedUnit ||
      unit.faction === selectedUnit.faction ||
      !canMeleeAttack(selectedUnit, unit, battle.mapAspectRatio)
    ) {
      setMessage("That enemy is outside melee range.");
      return;
    }
    setMeleeTargetId(unit.id);
    setMeleePulse(1);
    meleeDirectionRef.current = -1;
    setAimStage("meleeTiming");
    setMessage("Strike when the shrinking ring reaches the golden center.");
  }

  function resolveMelee() {
    if (!selectedUnit || !meleeTarget || !terrainMaskRef.current) return;
    const score = Math.max(0, Math.min(1, 1 - meleePulse));
    const result = meleeAttack(
      game,
      selectedUnit.id,
      meleeTarget.id,
      score,
      terrainMaskRef.current,
      battle.mapAspectRatio,
    );
    const label =
      score > 0.9
        ? "PERFECT"
        : score > 0.65
          ? "STRONG"
          : score > 0.35
            ? "HIT"
            : "WEAK";
    launchProjectile(
      meleeTarget.position,
      result.state,
      result.targetId
        ? [
            {
              targetId: result.targetId,
              damage: result.damage,
              hit: result.hit,
              position: meleeTarget.position,
              label,
            },
          ]
        : [],
    );
    setMeleeTargetId(null);
  }

  function lockDirection() {
    if (attackAction === "power") setAimStage("power");
    else if (attackAction === "area") setAimStage("distance");
    else if (attackAction === "archer") setAimStage("elevation");
  }

  const currentAimTarget = useMemo(() => {
    if (!selectedUnit || !aimMode || aimStage !== "direction") return null;
    return findRayTarget(game, selectedUnit, aimAngle, battle.mapAspectRatio);
  }, [game, selectedUnit, aimMode, aimStage, aimAngle, battle.mapAspectRatio]);

  function launchProjectile(
    end: Position,
    resultState: BattleState,
    hitEffects: HitEffect[],
    kind: "straight" | "archer" = "straight",
    arcHeight = 0,
  ) {
    if (!selectedUnit) return;
    setProjectile({
      start: { ...selectedUnit.position },
      end,
      kind,
      resultState,
      hitEffects,
      arcHeight,
    });
    setAimMode(false);
    setAimStage(null);
  }

  function fire() {
    if (
      !selectedUnit ||
      !attackAction ||
      !terrainMaskRef.current ||
      projectile ||
      pendingSpell
    )
      return;
    if (attackAction === "archer") {
      if (aimStage === "direction") {
        lockDirection();
        return;
      }
      if (!timedTargetPoint) return;
      const result = archerAttackAtPoint(
        game,
        selectedUnit.id,
        timedTargetPoint,
        battle.mapAspectRatio,
      );
      const position = result.targetId
        ? (game.units.find((u) => u.id === result.targetId)?.position ??
          timedTargetPoint)
        : timedTargetPoint;
      launchProjectile(
        timedTargetPoint,
        result.state,
        result.targetId
          ? [
              {
                targetId: result.targetId,
                damage: result.damage,
                hit: result.hit,
                position,
              },
            ]
          : [],
        "archer",
        8 + elevation * 0.14,
      );
      return;
    }
    if (attackAction === "area") {
      if (aimStage === "direction") {
        lockDirection();
        return;
      }
      if (!timedTargetPoint) return;
      const result = areaAttackAtPoint(
        game,
        selectedUnit.id,
        timedTargetPoint,
        battle.mapAspectRatio,
        5,
      );
      launchProjectile(timedTargetPoint, result.state, result.hits);
      return;
    }
    if (attackAction === "sweep") {
      const result = sweepAttack(
        game,
        selectedUnit.id,
        aimAngle,
        battle.mapAspectRatio,
      );
      launchProjectile(
        rayEndPoint(selectedUnit, Math.min(selectedUnit.attackRange, 10)),
        result.state,
        result.hits,
      );
      return;
    }
    if (attackAction === "charge") {
      const result = chargeAttack(
        game,
        selectedUnit.id,
        aimAngle,
        terrainMaskRef.current,
        battle.mapAspectRatio,
      );
      setGame(result.state);
      clearInteraction();
      if (result.hit) {
        setHitFlashUnitIds([result.hit.targetId]);
        setDamageEffects([result.hit]);
        window.setTimeout(() => {
          setHitFlashUnitIds([]);
          setDamageEffects([]);
        }, 950);
      }
      setMessage(
        result.hit
          ? `Charge hit for ${result.hit.damage} HP.`
          : "Charge completed.",
      );
      return;
    }
    const target = currentAimTarget;
    if (!target) {
      launchProjectile(
        rayEndPoint(selectedUnit, selectedUnit.attackRange),
        spendAttackIntoAir(game, selectedUnit.id),
        [],
      );
      return;
    }
    const power =
      attackAction === "power" ? 0.75 + (timingValue / 100) * 0.65 : 1;
    const accuracy = attackAction === "power" ? -0.12 * (timingValue / 100) : 0;
    const result = attackUnit(
      game,
      selectedUnit.id,
      target.id,
      terrainMaskRef.current,
      battle.mapAspectRatio,
      {
        damageMultiplier: power,
        accuracyModifier: accuracy,
        knockback: attackAction === "knockback" ? 4 : 0,
      },
    );
    launchProjectile(target.position, result.state, [
      {
        targetId: target.id,
        damage: result.damage,
        hit: result.hit,
        position: target.position,
      },
    ]);
  }

  const finishProjectile = useCallback(() => {
    if (!projectile) return;
    setGame(projectile.resultState);
    const successful = projectile.hitEffects.filter((effect) => effect.hit);
    setHitFlashUnitIds(successful.map((effect) => effect.targetId));
    setDamageEffects(projectile.hitEffects);
    setMessage(
      successful.length
        ? successful.length === 1
          ? `${successful[0].label ?? "HIT"} — ${successful[0].damage} HP.`
          : `${successful.length} targets hit.`
        : "Miss.",
    );
    window.setTimeout(() => {
      setHitFlashUnitIds([]);
      setDamageEffects([]);
    }, 1000);
    setProjectile(null);
    setAttackAction(null);
  }, [projectile]);

  function chooseDefense(mode: DefenseActionId, guardTargetId?: string) {
    if (!pinnedUnit) return;
    setGame(
      applyDefenseAction(game, pinnedUnit.id, mode, guardTargetId ?? null),
    );
    setMessage(
      mode === "guard"
        ? `${pinnedUnit.name} guards an ally.`
        : `${pinnedUnit.name} enters ${mode} stance.`,
    );
  }

  function chooseSkill(action: SkillActionId) {
    if (
      !pinnedUnit ||
      pinnedUnit.faction !== game.activeFaction ||
      pinnedUnit.hasActed
    )
      return;
    setSelectedUnitId(pinnedUnit.id);
    setMoveMode(false);
    setAttackAction(null);
    setSkillAction(action);
    setAimMode(true);
    setAimStage(null);
    setMessage(
      action === "trap" || action === "teleport"
        ? "Click the battlefield to choose a location."
        : "Click a unit to choose the spell target.",
    );
  }

  function handleSkillUnitTarget(target: Unit) {
    if (!skillAction || !selectedUnit) return;
    if (skillAction === "heal") {
      if (target.faction !== selectedUnit.faction) {
        setMessage("Healing Light requires a friendly target.");
        return;
      }
      setPendingSpell({
        kind: "heal",
        start: selectedUnit.position,
        end: target.position,
        resultState: healTarget(game, selectedUnit.id, target.id),
        hitEffects: [],
      });
      setAimMode(false);
      return;
    }
    if (skillAction === "damageBoost") {
      if (target.faction !== selectedUnit.faction) {
        setMessage("War Blessing requires a friendly target.");
        return;
      }
      setPendingSpell({
        kind: "damageBoost",
        start: selectedUnit.position,
        end: target.position,
        resultState: boostTarget(game, selectedUnit.id, target.id),
        hitEffects: [],
      });
      setAimMode(false);
      return;
    }
    if (skillAction === "burn") {
      if (target.faction === selectedUnit.faction) {
        setMessage("Burn requires an enemy target.");
        return;
      }
      setPendingSpell({
        kind: "burn",
        start: selectedUnit.position,
        end: target.position,
        resultState: burnTarget(game, selectedUnit.id, target.id),
        hitEffects: [
          {
            targetId: target.id,
            damage: 7,
            hit: true,
            position: target.position,
            label: "BURN",
          },
        ],
      });
      setAimMode(false);
    }
  }

  function handleSkillMapTarget(position: Position) {
    if (!skillAction || !selectedUnit || !terrainMaskRef.current) return;
    if (skillAction === "trap") {
      setPendingSpell({
        kind: "trap",
        start: selectedUnit.position,
        end: position,
        resultState: placeTrap(game, selectedUnit.id, position),
        hitEffects: [],
      });
      setAimMode(false);
      return;
    }
    if (skillAction === "teleport") {
      const resultState = teleportCaster(
        game,
        selectedUnit.id,
        position,
        terrainMaskRef.current,
      );
      const moved = resultState.units.find((u) => u.id === selectedUnit.id);
      if (
        !moved ||
        (moved.position.x === selectedUnit.position.x &&
          moved.position.y === selectedUnit.position.y)
      ) {
        setMessage("Teleport cannot land there.");
        return;
      }
      setPendingSpell({
        kind: "teleport",
        start: selectedUnit.position,
        end: position,
        resultState,
        hitEffects: [],
      });
      setAimMode(false);
    }
  }

  const finishSpell = useCallback(() => {
    if (!pendingSpell) return;
    setGame(pendingSpell.resultState);
    setDamageEffects(pendingSpell.hitEffects);
    setHitFlashUnitIds(
      pendingSpell.hitEffects.filter((e) => e.hit).map((e) => e.targetId),
    );
    const labels: Record<SkillActionId, string> = {
      heal: "Healing Light restored HP.",
      damageBoost: "War Blessing granted a damage bonus.",
      trap: "Rune trap placed.",
      teleport: "Teleport complete.",
      burn: "The target is burning.",
    };
    setMessage(labels[pendingSpell.kind]);
    window.setTimeout(() => {
      setDamageEffects([]);
      setHitFlashUnitIds([]);
    }, 1000);
    setPendingSpell(null);
    setSkillAction(null);
  }, [pendingSpell]);

  function interactWithSelectedObject() {
    if (!selectedObject || !selectedUnit || !selectedObjectInRange) {
      return;
    }

    const result = applyObjectInteraction(
      game,
      selectedObject,
      selectedUnit.id,
    );

    setGame(result.state);

    setMessage(result.message);

    setSelectedObjectId(null);
  }

  function handleEndTurn() {
    clearInteraction();
    setSelectedUnitId(null);
    setPinnedUnitId(null);

    const actingFaction = game.activeFaction;

    // Campaign battles use the selected game-mode evaluator instead of
    // battleEngine's old "capture objective = instant win" rule.
    const transitioned = endTurn(game, battle.mapAspectRatio, "none");

    const evaluated = evaluateGameMode(
      transitioned,
      gameMode,
      {
        ...gameModeConfig,
        playerFaction: gameModeConfig?.playerFaction ?? playerFaction,
      },
      actingFaction,
    );

    setGame(evaluated.state);

    setMessage(
      evaluated.state.winner
        ? `${evaluated.state.winner} wins · ${GAME_MODE_LABELS[gameMode]}.`
        : (evaluated.message ?? `${evaluated.state.activeFaction} turn.`),
    );
  }

  const previewUnit =
    pinnedUnit && pinnedUnit.faction === game.activeFaction ? pinnedUnit : null;
  const ghostDirectional =
    previewAction?.kind === "attack" &&
    previewUnit &&
    ["quick", "power", "sweep", "charge", "knockback", "archer"].includes(
      previewAction.id,
    );
  const ghostAreaPoint = previewUnit
    ? rayEndPoint(previewUnit, previewUnit.attackRange * 0.6, previewAngle)
    : null;
  const ghostSkillPoint = previewUnit
    ? rayEndPoint(
        previewUnit,
        Math.max(6, previewUnit.attackRange * 0.45),
        previewAngle,
      )
    : null;
  const previewDefense =
    previewAction?.kind === "defense" ? previewAction.id : null;

  return (
    <div className="mx-auto w-full max-w-[1500px] text-[#f4e4c1]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d3a448]">{gameUi(" Medieval Kingdoms ")}</p>
          <h1 className="text-3xl font-black text-[#ffe7ad]">{gameUi(battle.name)}</h1>
          <p className="text-sm text-[#bba17a]">{gameUi(" Round ")}{gameUi(game.round)} · {gameUi(battle.subtitle)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#c89b4f] bg-[#5d411f] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffe2a0]">
              {gameUi(GAME_MODE_LABELS[gameMode])}
            </span>

            <span className="text-[11px] text-[#a9906c]">
              {gameUi(GAME_MODE_DESCRIPTIONS[gameMode])}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="rounded-xl border border-[#856239] bg-[#4a3521] px-5 py-3 font-bold text-[#f1d9aa] hover:bg-[#604526]"
        >{gameUi(" ← Campaign Map ")}</button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div>
          <div
            onClick={handleMapClick}
            onDragOver={(event) => {
              if (!moveMode) return;

              event.preventDefault();

              const position = eventToPosition(
                event.clientX,
                event.clientY,
                event.currentTarget,
              );

              const preview = movementPreview(position);

              setDragPreview({
                position,
                legal: preview.legal,
                reason: preview.reason,
              });
            }}
            onDragLeave={() => {
              if (moveMode) {
                setDragPreview(null);
              }
            }}
            onDrop={handleDrop}
            className="relative overflow-hidden rounded-2xl border-2 border-[#755433] bg-[#3b2a1b] shadow-2xl"
          >
            <img
              src={battle.mapImage}
              alt={gameUi(battle.name)}
              draggable={false}
              className="block w-full select-none"
            />
            <ClanCornerBadges />
            <ObjectiveMarker objective={game.objective} />

            {game.objects.map((object) => (
              <BattlefieldObjectMarker
                key={object.id}
                object={object}
                selected={object.id === selectedObjectId}
                reachable={unitCanInteractWithObject(
                  selectedUnit,
                  object,
                  battle.mapAspectRatio,
                )}
                onClick={() => setSelectedObjectId(object.id)}
              />
            ))}

            {selectedUnit && selectedUnit.faction === game.activeFaction && (
              <>
                {!selectedUnit.hasMoved && (
                  <RangeZone
                    x={selectedUnit.position.x}
                    y={selectedUnit.position.y}
                    range={selectedUnit.moveRange}
                    type="move"
                  />
                )}
                {!selectedUnit.hasActed && (
                  <RangeZone
                    x={selectedUnit.position.x}
                    y={selectedUnit.position.y}
                    range={selectedUnit.attackRange}
                    type="attack"
                  />
                )}
              </>
            )}

            {ghostDirectional && (
              <div className="opacity-30">
                <AttackAimOverlay
                  x={previewUnit.position.x}
                  y={previewUnit.position.y}
                  radius={previewUnit.moveRange}
                  angle={previewAngle}
                  mapAspectRatio={battle.mapAspectRatio}
                />
              </div>
            )}
            {previewAction?.kind === "attack" &&
              previewAction.id === "area" &&
              previewUnit &&
              ghostAreaPoint && (
                <div className="opacity-30">
                  <AreaTargetOverlay
                    start={previewUnit.position}
                    target={ghostAreaPoint}
                    radius={5}
                    mapAspectRatio={battle.mapAspectRatio}
                  />
                </div>
              )}
            {previewAction?.kind === "attack" &&
              previewAction.id === "melee" &&
              previewUnit && (
                <MeleeTimingOverlay
                  position={previewUnit.position}
                  pulse={0.5}
                  interactive={false}
                  preview
                />
              )}
            {previewAction?.kind === "skill" &&
              previewUnit &&
              ghostSkillPoint && (
                <SkillPreviewOverlay
                  kind={previewAction.id}
                  start={previewUnit.position}
                  target={ghostSkillPoint}
                />
              )}

            {selectedUnit &&
              ((aimMode && aimStage === "direction") ||
                projectile?.kind === "straight") && (
                <AttackAimOverlay
                  x={selectedUnit.position.x}
                  y={selectedUnit.position.y}
                  radius={selectedUnit.moveRange}
                  angle={aimAngle}
                  mapAspectRatio={battle.mapAspectRatio}
                />
              )}
            {selectedUnit &&
              aimMode &&
              attackAction === "archer" &&
              aimStage === "elevation" &&
              timedTargetPoint && (
                <ArcherAimOverlay
                  start={selectedUnit.position}
                  landing={timedTargetPoint}
                  elevation={elevation}
                  mapAspectRatio={battle.mapAspectRatio}
                />
              )}
            {selectedUnit &&
              aimMode &&
              attackAction === "area" &&
              aimStage === "distance" &&
              timedTargetPoint && (
                <AreaTargetOverlay
                  start={selectedUnit.position}
                  target={timedTargetPoint}
                  radius={5}
                  mapAspectRatio={battle.mapAspectRatio}
                />
              )}
            {aimMode && aimStage === "meleeTiming" && meleeTarget && (
              <MeleeTimingOverlay
                position={meleeTarget.position}
                pulse={meleePulse}
                interactive
                onStrike={resolveMelee}
              />
            )}

            {game.traps.map((trap) => (
              <TrapMarker
                key={trap.id}
                trap={trap}
                visible={trap.ownerFaction === game.activeFaction}
              />
            ))}

            {dragPreview && selectedUnit && (
              <div
                className="pointer-events-none absolute z-[95] -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${dragPreview.position.x}%`,
                  top: `${dragPreview.position.y}%`,
                }}
              >
                <div
                  className={`
                    relative
                    flex
                    items-center
                    justify-center
                    rounded-full
                    border-[4px]
                    ${
                      dragPreview.legal
                        ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_18px_rgba(52,211,153,0.95)]"
                        : "border-red-500 bg-red-500/25 shadow-[0_0_18px_rgba(239,68,68,0.95)]"
                    }
                  `}
                  style={{
                    width: `${(selectedUnit.tokenSize ?? 52) + 14}px`,
                    height: `${(selectedUnit.tokenSize ?? 52) + 14}px`,
                  }}
                >
                  {selectedUnit.ringImage ? (
                    <img
                      src={selectedUnit.ringImage}
                      alt=""
                      className={`
                        h-full
                        w-full
                        object-contain
                        ${
                          dragPreview.legal
                            ? "opacity-85"
                            : "opacity-45 grayscale"
                        }
                      `}
                    />
                  ) : null}

                  <div
                    className={`
                      absolute
                      left-1/2
                      top-full
                      mt-2
                      -translate-x-1/2
                      whitespace-nowrap
                      rounded-md
                      border
                      px-2
                      py-1
                      text-[9px]
                      font-black
                      uppercase
                      tracking-wide
                      ${
                        dragPreview.legal
                          ? "border-emerald-300 bg-emerald-950/95 text-emerald-100"
                          : "border-red-400 bg-red-950/95 text-red-100"
                      }
                    `}
                  >
                    {gameUi(dragPreview.legal ? "Legal move" : dragPreview.reason)}
                  </div>
                </div>
              </div>
            )}

            {game.units.map((unit) => (
              <div
                key={unit.id}
                className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${unit.position.x}%`,
                  top: `${unit.position.y}%`,
                }}
              >
                <UnitToken
                  unit={unit}
                  selected={unit.id === selectedUnitId}
                  hitFlash={hitFlashUnitIds.includes(unit.id)}
                  aimTarget={
                    unit.id === currentAimTarget?.id ||
                    (aimStage === "meleeTarget" &&
                      selectedUnit !== null &&
                      canMeleeAttack(selectedUnit, unit, battle.mapAspectRatio))
                  }
                  draggableMove={moveMode && unit.id === selectedUnitId}
                  previewDefense={
                    unit.id === pinnedUnitId ? previewDefense : null
                  }
                  onHover={() => setHoveredUnitId(unit.id)}
                  onLeave={() => setHoveredUnitId(null)}
                  onClick={() => selectAndPin(unit)}
                  onRightClick={() => setPinnedUnitId(unit.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", unit.id);

                    const transparent = new Image();

                    transparent.src =
                      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

                    event.dataTransfer.setDragImage(transparent, 0, 0);
                  }}
                  onDragEnd={() => setDragPreview(null)}
                />
              </div>
            ))}

            {projectile && (
              <ProjectileOverlay
                start={projectile.start}
                end={projectile.end}
                kind={projectile.kind}
                arcHeight={projectile.arcHeight}
                mapAspectRatio={battle.mapAspectRatio}
                onDone={finishProjectile}
              />
            )}
            {pendingSpell && (
              <SpellEffectOverlay
                kind={pendingSpell.kind}
                start={pendingSpell.start}
                end={pendingSpell.end}
                onDone={finishSpell}
              />
            )}
            {damageEffects.map((effect, index) => (
              <DamagePopup
                key={`${effect.targetId}-${index}`}
                position={effect.position}
                damage={effect.damage}
                hit={effect.hit}
                label={gameUi(effect.label)}
              />
            ))}

            {selectedObject && (
              <BattlefieldObjectPanel
                object={selectedObject}
                selectedUnit={selectedUnit}
                inRange={selectedObjectInRange}
                onInteract={interactWithSelectedObject}
                onClose={() => setSelectedObjectId(null)}
              />
            )}

            {game.winner && (
              <div className="absolute inset-0 z-[250] flex items-center justify-center bg-[#25190f]/70 backdrop-blur-sm">
                <div className="rounded-3xl border-2 border-[#c39745] bg-[#3b2a1b] p-8 text-center">
                  <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#dcb65f]">{gameUi(" Battle Over ")}</div>
                  <div className="mt-2 text-3xl font-black capitalize text-[#ffe4a3]">
                    {gameUi(game.winner)}{gameUi(" Victory ")}</div>
                  <GameXpReward />
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-[#755433] bg-[#3a291b] px-4 py-3 text-sm text-[#dbc49d]">
            {gameUi(message)}
          </div>
          <ArmyStatusBar
            units={game.units}
            faction={game.activeFaction}
            selectedUnitId={selectedUnitId}
            onSelect={selectAndPin}
          />
        </div>

        <BattleSidebar
          battle={battle}
          game={game}
          hoveredUnit={hoveredUnit}
          pinnedUnit={pinnedUnit}
          selectedUnit={selectedUnit}
          pinnedTerrain={terrainFor(pinnedUnit)}
          moveMode={moveMode}
          aimMode={aimMode}
          aimStage={aimStage}
          aimAngle={aimAngle}
          elevation={elevation}
          timingValue={timingValue}
          meleeScore={aimStage === "meleeTiming" ? 1 - meleePulse : null}
          hasMeleeTargets={hasMeleeTargets}
          currentAttackAction={attackAction}
          currentSkillAction={skillAction}
          onPinHovered={() => {
            if (hoveredUnit) setPinnedUnitId(hoveredUnit.id);
          }}
          onSelectPinned={() => {
            if (pinnedUnit) selectAndPin(pinnedUnit);
          }}
          onStartMove={startMove}
          onFinishPinned={() => {
            if (pinnedUnit) setGame(finishUnit(game, pinnedUnit.id));
          }}
          onChooseAttack={startAttack}
          onChooseDefense={chooseDefense}
          onChooseSkill={chooseSkill}
          onPreviewAction={setPreviewAction}
          onLockDirection={lockDirection}
          onCancelAction={clearInteraction}
          onFire={fire}
          onMeleeStrike={resolveMelee}
          onEndTurn={handleEndTurn}
        />
      </div>
    </div>
  );
}
