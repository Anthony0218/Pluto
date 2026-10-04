import { ui, useUiLanguage } from '@/i18n/ui';
import InformationPage, { informationLink, informationPanel } from '@/components/App/InformationPage';
import { engineCredits, atlasCredits, assetCredits, type CreditResource } from '@/data/credits';
import atlasVersion from '../../../public/data/geography/version.json';

function ResourceList({ title, resources }: { title: string; resources: CreditResource[] }) {
  return <section aria-label={ui(title)}>
    <h2 className="mb-4 px-1 text-xl font-black">{ui(title)}</h2>
    <div className="grid gap-4">{resources.map(item => <article key={item.name} className={informationPanel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 text-lg font-bold">{ui(item.name)}</h3>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">{ui(item.license)}</span>
      </div>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{ui(item.description)}</p>
      {item.detail && <p className="mt-2 break-all font-mono text-xs leading-6 text-zinc-500">{item.detail}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={item.homepage} target="_blank" rel="noreferrer" className={informationLink}>{ui('Source / project')} ↗</a>
        {item.notices && <a href={item.notices} target="_blank" rel="noreferrer" className={informationLink}>{ui('License / notices')} ↗</a>}
      </div>
    </article>)}</div>
  </section>;
}

export default function CreditsPage() {
  useUiLanguage();
  return <InformationPage title="Credits & references" intro="Thank you to the authors and communities behind the software, engines, datasets and assets used by Pluto.">
    <section className={informationPanel}>
      <h2 className="text-lg font-bold">{ui('Software licenses')}</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{ui('Full license texts and copyright notices are available in their original language.')}</p>
      <a href="/licenses/third-party-notices.txt" className={`${informationLink} mt-4`} download>{ui('Download third-party notices')}</a>
    </section>
    <ResourceList title="Chess & Go engines" resources={engineCredits} />
    <section className={informationPanel}>
      <h2 className="text-lg font-bold">Atlas Arena · {ui('Dataset')}</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{ui('Atlas Arena uses a bundled snapshot. Source records are selected and normalized for quizzes; observation years remain attached to statistics. Multiplayer rooms pin their dataset version.')}</p>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div><dt className="text-zinc-500">{ui('Dataset version')}</dt><dd className="mt-1 font-mono text-emerald-300">{atlasVersion.atlasDataVersion}</dd></div>
        <div><dt className="text-zinc-500">{ui('Source snapshot (UTC)')}</dt><dd className="mt-1 font-mono text-zinc-300">{atlasVersion.synchronizedAt}</dd></div>
      </dl>
    </section>
    <ResourceList title="Atlas Arena data sources" resources={atlasCredits} />
    <ResourceList title="Assets & chess data" resources={assetCredits} />
    <footer className="pb-8 text-center text-xs leading-6 text-zinc-500">{ui('Credits and notices are updated as dependencies, data and assets change.')}</footer>
  </InformationPage>;
}
