import { imprintDetails } from '@/data/imprint';
import { ui } from '@/i18n/ui';
import { informationLink, informationPanel } from './InformationPage';

export default function Imprint() {
  return <>
    <div className="grid gap-4 sm:grid-cols-2">
      {imprintDetails.map(section => <section key={section.title} className={informationPanel}>
        <h2 className="text-lg font-bold">{ui(section.title)}</h2>
        <div className="mt-3 space-y-2 break-words text-sm leading-7">
          {section.values.length ? section.values.map((value, index) => <p key={index} className="whitespace-pre-line text-zinc-300">{value}</p>) : section.placeholders.map(placeholder => <p key={placeholder} className="text-amber-200/80">[{ui(placeholder)}]</p>)}
        </div>
      </section>)}
    </div>
    <section className={informationPanel}>
      <h2 className="text-lg font-bold">{ui('Information requirements')}</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{ui('The fields follow the general German provider information requirements. Additional details depend on the operator, activity and applicable law.')}</p>
      <a className={`${informationLink} mt-4`} href="https://www.gesetze-im-internet.de/ddg/__5.html" target="_blank" rel="noreferrer">{ui('Reference')}: § 5 DDG ↗</a>
    </section>
  </>;
}
