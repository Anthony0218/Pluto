import type { CSSProperties, ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import * as m from "motion/react-m";
import { toneOf, type ToneName } from "./tones";

export type DemoTab = { id: string; label: string; content: ReactNode };

/** Tabs for a section's demos. Only the selected demo is mounted, and it eases in when selected. */
export default function DemoTabs({ tabs, tone, label }: { tabs: DemoTab[]; tone: ToneName; label: string }) {
  const colors = toneOf(tone);
  return <Tabs.Root className="demo-tabs" defaultValue={tabs[0].id} style={{ "--demo-accent": colors.glow } as CSSProperties}>
    <Tabs.List className="demo-tab-list" aria-label={label} activateOnFocus>
      {tabs.map(tab => <Tabs.Tab key={tab.id} value={tab.id} className="demo-tab">{tab.label}</Tabs.Tab>)}
      <Tabs.Indicator className="demo-tab-indicator" />
    </Tabs.List>
    {tabs.map(tab => <Tabs.Panel key={tab.id} value={tab.id} className="demo-tab-panel">
      <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>{tab.content}</m.div>
    </Tabs.Panel>)}
  </Tabs.Root>;
}
