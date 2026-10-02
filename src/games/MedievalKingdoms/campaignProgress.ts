import { useCallback, useMemo, useState } from "react";

import { CAMPAIGN_ORDER, CAMPAIGNS, type CampaignId } from "./campaignData";

import type { CampaignBattleNode, CampaignProgress } from "./types";

const STORAGE_KEY = "medieval-kingdoms-campaign-progress-v1";

export const INITIAL_CAMPAIGN_PROGRESS: CampaignProgress = {
  completedCampaigns: [],
  completedBattles: [],
  currentCampaignId: "moonville",
};

export function battleProgressKey(
  campaignId: string,
  battleNodeId: string,
): string {
  return `${campaignId}:${battleNodeId}`;
}

export function loadCampaignProgress(): CampaignProgress {
  if (typeof window === "undefined") {
    return INITIAL_CAMPAIGN_PROGRESS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return INITIAL_CAMPAIGN_PROGRESS;
    }

    const parsed = JSON.parse(raw) as Partial<CampaignProgress>;

    return {
      completedCampaigns: Array.isArray(parsed.completedCampaigns)
        ? parsed.completedCampaigns
        : [],

      completedBattles: Array.isArray(parsed.completedBattles)
        ? parsed.completedBattles
        : [],

      currentCampaignId:
        typeof parsed.currentCampaignId === "string"
          ? parsed.currentCampaignId
          : "moonville",
    };
  } catch {
    return INITIAL_CAMPAIGN_PROGRESS;
  }
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function isCampaignUnlocked(
  campaignId: string,
  progress: CampaignProgress,
): boolean {
  const index = CAMPAIGN_ORDER.indexOf(campaignId as CampaignId);

  if (index <= 0) {
    return campaignId === "moonville";
  }

  const previous = CAMPAIGN_ORDER[index - 1];

  return progress.completedCampaigns.includes(previous);
}

export function isCampaignCompleted(
  campaignId: string,
  progress: CampaignProgress,
): boolean {
  return progress.completedCampaigns.includes(campaignId);
}

export function isBattleCompleted(
  campaignId: string,
  nodeId: string,
  progress: CampaignProgress,
): boolean {
  return progress.completedBattles.includes(
    battleProgressKey(campaignId, nodeId),
  );
}

export function isBattleUnlocked(
  campaignId: string,
  node: CampaignBattleNode,
  progress: CampaignProgress,
): boolean {
  if (!isCampaignUnlocked(campaignId, progress)) {
    return false;
  }

  const campaign = CAMPAIGNS[campaignId as CampaignId];

  if (!campaign) {
    return false;
  }

  const requiredBefore = campaign.battles.filter(
    (candidate) => !candidate.optional && candidate.order < node.order,
  );

  return requiredBefore.every((candidate) =>
    isBattleCompleted(campaignId, candidate.id, progress),
  );
}

function campaignIsNowComplete(
  campaignId: string,
  completedBattles: string[],
): boolean {
  const campaign = CAMPAIGNS[campaignId as CampaignId];

  if (!campaign) {
    return false;
  }

  return campaign.battles
    .filter((node) => !node.optional)
    .every((node) =>
      completedBattles.includes(battleProgressKey(campaignId, node.id)),
    );
}

export function completeBattleInProgress(
  progress: CampaignProgress,
  campaignId: string,
  nodeId: string,
): CampaignProgress {
  const key = battleProgressKey(campaignId, nodeId);

  const completedBattles = progress.completedBattles.includes(key)
    ? progress.completedBattles
    : [...progress.completedBattles, key];

  const completedCampaigns =
    campaignIsNowComplete(campaignId, completedBattles) &&
    !progress.completedCampaigns.includes(campaignId)
      ? [...progress.completedCampaigns, campaignId]
      : progress.completedCampaigns;

  const campaignIndex = CAMPAIGN_ORDER.indexOf(campaignId as CampaignId);

  const nextCampaign =
    campaignIndex >= 0 ? CAMPAIGN_ORDER[campaignIndex + 1] : undefined;

  return {
    completedBattles,
    completedCampaigns,
    currentCampaignId:
      nextCampaign && completedCampaigns.includes(campaignId)
        ? nextCampaign
        : campaignId,
  };
}

export function completeCampaignInProgress(
  progress: CampaignProgress,
  campaignId: string,
): CampaignProgress {
  const completedCampaigns = progress.completedCampaigns.includes(campaignId)
    ? progress.completedCampaigns
    : [...progress.completedCampaigns, campaignId];

  const campaignIndex = CAMPAIGN_ORDER.indexOf(campaignId as CampaignId);

  const nextCampaign =
    campaignIndex >= 0 ? CAMPAIGN_ORDER[campaignIndex + 1] : undefined;

  return {
    ...progress,
    completedCampaigns,
    currentCampaignId: nextCampaign ?? campaignId,
  };
}

export function useCampaignProgress() {
  const [progress, setProgress] = useState<CampaignProgress>(() =>
    loadCampaignProgress(),
  );

  const update = useCallback(
    (
      updater:
        | CampaignProgress
        | ((current: CampaignProgress) => CampaignProgress),
    ) => {
      setProgress((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;

        saveCampaignProgress(next);

        return next;
      });
    },
    [],
  );

  const completeBattle = useCallback(
    (campaignId: string, nodeId: string) => {
      update((current) =>
        completeBattleInProgress(current, campaignId, nodeId),
      );
    },
    [update],
  );

  const completeCampaign = useCallback(
    (campaignId: string) => {
      update((current) => completeCampaignInProgress(current, campaignId));
    },
    [update],
  );

  const reset = useCallback(() => {
    update({
      ...INITIAL_CAMPAIGN_PROGRESS,
      completedCampaigns: [],
      completedBattles: [],
    });
  }, [update]);

  return useMemo(
    () => ({
      progress,
      completeBattle,
      completeCampaign,
      reset,
    }),
    [progress, completeBattle, completeCampaign, reset],
  );
}
