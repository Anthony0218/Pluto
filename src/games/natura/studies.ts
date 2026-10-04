import type { ScenarioId } from './naturaData';

/** Exhibit metadata describes the game, not measured biological difficulty. */
export type Study = { category: string; habitat: string; subjects: string; summary: string; accent: string; difficulty: string; solo: string };
export const STUDIES: Record<ScenarioId, Study> = {
  meadow: { category: 'Predator & prey', habitat: 'Grassland', subjects: 'American kestrel × meadow vole', summary: 'Watch from the perch. Dive at the right moment. Disappear into the grass.', accent: '#796127', difficulty: 'Tactical', solo: 'Animal rival' },
  bolas: { category: 'Hunting behaviour', habitat: 'Night forest', subjects: 'Bolas spider × moths', summary: 'A little silk, a clever lure, and one perfectly timed swing.', accent: '#695678', difficulty: 'Timing', solo: 'Spider rival' },
  coconut: { category: 'Tools & shelter', habitat: 'Open seabed', subjects: 'Coconut octopus', summary: 'Carry your shelter. Leave cover to forage. Read the approaching patrol.', accent: '#9a5836', difficulty: 'Tactical', solo: 'Octopus rival' },
  trapjaw: { category: 'Locomotion', habitat: 'Forest floor', subjects: 'Trap-jaw ant', summary: 'Read the cycling arc and time a jaw-powered leap from ledge to ledge.', accent: '#776331', difficulty: 'Precision', solo: 'Ant rival' },
  cuttlefish: { category: 'Camouflage', habitat: 'Coastal seabed', subjects: 'Cuttlefish', summary: 'Match the ground, stay still, then race your rival to shared shrimp.', accent: '#3e777b', difficulty: 'Tactical', solo: 'Cuttlefish rival' },
  jumpingspider: { category: 'Locomotion & silk', habitat: 'Garden canopy', subjects: 'Jumping spider', summary: 'Leap toward the summit, with a silk safety line and checkpoints along the way.', accent: '#4d713b', difficulty: 'Platforming', solo: 'Spider rival' },
  spermwhale: { category: 'Sensing & survival', habitat: 'Southern Ocean', subjects: 'Sperm whale × colossal squid', summary: 'Listen for an echo. Explore the deep. Save enough breath for the journey home.', accent: '#325b87', difficulty: 'Exploration', solo: 'Ocean survival' },
  archerfish: { category: 'Feeding & prediction', habitat: 'Mangroves', subjects: 'Competing archerfish', summary: 'Knock an insect from its perch, then reach the falling food before your rival.', accent: '#297669', difficulty: 'Aim & intercept', solo: 'Fish rival' },
  flyingfish: { category: 'Predator avoidance', habitat: 'Open ocean', subjects: 'Flying fish × tuna & seabirds', summary: 'Between sea and sky, find the open lane and keep swimming.', accent: '#347590', difficulty: 'Reaction', solo: 'Ocean survival' },
};
export const difficultyLabel = (difficulty: 'easy' | 'normal' | 'hard') => difficulty === 'normal' ? 'Medium' : difficulty === 'easy' ? 'Easy' : 'Hard';
