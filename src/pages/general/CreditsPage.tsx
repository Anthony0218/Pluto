import { ui, useUiLanguage } from '@/i18n/ui';
import InformationPage, { informationLink, informationPanel } from '@/components/App/InformationPage';
import { engineCredits, atlasCredits, assetCredits, toolCredits, learningCredits, type CreditResource } from '@/data/credits';
import dependencyCredits from '@/data/dependencyCredits.json';
import atlasVersion from '../../../public/data/geography/version.json';

function ResourceList({ title, resources }: { title: string; resources: CreditResource[] }) {
  return <section aria-label={ui(title)}>
    <h2 className="mb-4 px-1 text-xl font-black">{ui(title)}</h2>
    <div className="grid gap-4">{resources.map(item => <article key={item.name} className={informationPanel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-lg font-bold">{ui(item.name)}</h3>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">{ui(item.license)}</span>
      </div>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{ui(item.description)}</p>
      {item.detail && <p className="mt-2 break-all font-mono text-xs leading-6 text-zinc-500">{item.detail}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={item.homepage} target="_blank" rel="noreferrer" className={informationLink}>{ui('Source / project')} ↗</a>
        {item.notices && <a href={item.notices} target="_blank" rel="noreferrer" className={informationLink}>{ui('License / notices')} ↗</a>}
        {item.links?.map(link => <a key={`${link.name}-${link.href}`} href={link.href} target="_blank" rel="noreferrer" className={informationLink}>{ui(link.name)} ↗</a>)}
      </div>
    </article>)}</div>
  </section>;
}

const dependencyGroups = [
  { scope: 'runtime', title: 'Libraries & runtime dependencies' },
  { scope: 'development', title: 'Development & build tools' },
  { scope: 'transitive', title: 'Indirect dependencies' },
].map(group => ({ ...group, packages: dependencyCredits.filter(item => item.scope === group.scope) }));

function SoftwareInventory() {
  return <section className={informationPanel} aria-label={ui('Software licenses')}>
    <h2 className="text-lg font-bold">{ui('Software licenses')}</h2>
    <p className="mt-3 text-sm leading-7 text-zinc-400">{ui('The package inventory includes installed runtime, server and development dependencies, including indirect dependencies. Full license texts and copyright notices are available in their original language.')}</p>
    <a href="/licenses/third-party-notices.txt" className={`${informationLink} mt-4`} download>{ui('Download third-party notices')}</a>
    <div className="mt-6 space-y-3">{dependencyGroups.map(group => <details key={group.scope} className="rounded-xl border border-white/10 p-4">
      <summary className="cursor-pointer text-sm font-bold focus-visible:outline-2 focus-visible:outline-emerald-300">{ui(group.title)} <span className="font-mono text-zinc-400">({group.packages.length})</span></summary>
      <ul className="mt-3 divide-y divide-white/10">{group.packages.map(item => <li key={`${item.name}@${item.version}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
        <a href={item.homepage} target="_blank" rel="noreferrer" className="min-w-0 break-all text-zinc-200 underline decoration-white/20 underline-offset-4 hover:text-white">{item.name} <span className="text-zinc-500">{item.version}</span> ↗</a>
        <span className="break-words text-emerald-300">{item.license}</span>
      </li>)}</ul>
    </details>)}</div>
  </section>;
}

export default function CreditsPage() {
  useUiLanguage();
  return <InformationPage title="Credits & references" intro="Thank you to the authors and communities behind the software, engines, datasets and assets used by Pluto.">
    <SoftwareInventory />
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
    <ResourceList title="Tools & live data" resources={toolCredits} />
    <ResourceList title="Learning references" resources={learningCredits} />
    <section className={informationPanel}>
      <h2 className="text-lg font-bold">{ui('Reference material & original media')}</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{ui('Football names identify clubs and competitions without implying affiliation. Official crests, logos, trophy images and match footage are not bundled. Reference links do not grant a license to reproduce the source material.')}</p>
    </section>
    <ResourceList title="Assets & chess data" resources={assetCredits} />
    <section className={informationPanel}>
      <h2 className="text-lg font-bold">{ui('Original and generated assets')}</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{ui('Game logic, interfaces and procedural Eat It models are created for this project. Community avatar illustrations were generated with OpenAI image generation. Third-party resources retain their own licenses.')}</p>
      <a href="/licenses/eat-it-third-party.txt" target="_blank" rel="noreferrer" className={`${informationLink} mt-4`}>Eat It · {ui('License / notices')} ↗</a>
    </section>
    <section className={informationPanel}>
      <h2 className="text-lg font-bold">{ui('Image and audio provenance')}</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{ui('Card artwork and game scene images in public/images were AI-generated for this project, as confirmed by the project owner. Source and permission records for chess audio and other undocumented media remain incomplete. Generated artwork may still be subject to third-party rights.')}</p>
      <a href="/licenses/media-provenance.txt" target="_blank" rel="noreferrer" className={`${informationLink} mt-4`}>{ui('Media provenance notes')} ↗</a>
    </section>
    <footer className="pb-8 text-center text-xs leading-6 text-zinc-500">{ui('Credits and notices are updated as dependencies, data and assets change.')}</footer>
  </InformationPage>;
}
