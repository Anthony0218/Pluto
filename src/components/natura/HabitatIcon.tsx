import { Bird, Bug, Fish, Waves } from 'lucide-react';
import type { ScenarioId } from '../../games/natura/naturaData';
export default function HabitatIcon({ id }: { id: ScenarioId }) {
  const Icon = id === 'meadow' ? Bird : ['flyingfish', 'archerfish'].includes(id) ? Fish : ['cuttlefish', 'coconut', 'spermwhale'].includes(id) ? Waves : Bug;
  return <Icon aria-hidden="true" strokeWidth={1.5} />;
}
