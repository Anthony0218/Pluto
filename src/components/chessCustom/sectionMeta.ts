import { Box, Crown, FlaskConical, FolderOpen, Globe, Grid2x2, Grid3x3, LayoutDashboard, ScrollText, Sparkles, Trophy, Users, Zap, type LucideIcon } from "lucide-react";
import type { EditorSection } from "@/games/chess/custom/editor/editorContext";

/** Editor navigation: order, labels, icons and grouping. */
export const SECTION_META: { id: EditorSection; label: string; icon: LucideIcon; group: "build" | "play" | "library" }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "build" },
  { id: "board", label: "Board", icon: Grid3x3, group: "build" },
  { id: "teams", label: "Teams", icon: Users, group: "build" },
  { id: "pieces", label: "Pieces", icon: Crown, group: "build" },
  { id: "rules", label: "Rules", icon: ScrollText, group: "build" },
  { id: "events", label: "Events", icon: Zap, group: "build" },
  { id: "victory", label: "Victory", icon: Trophy, group: "build" },
  { id: "test", label: "Test Position", icon: FlaskConical, group: "play" },
  { id: "simulation2d", label: "2D Simulation", icon: Grid2x2, group: "play" },
  { id: "simulation", label: "3D Simulation", icon: Box, group: "play" },
  { id: "presets", label: "Presets", icon: Sparkles, group: "library" },
  { id: "saved", label: "Saved Variants", icon: FolderOpen, group: "library" },
  { id: "community", label: "Community", icon: Globe, group: "library" },
];

