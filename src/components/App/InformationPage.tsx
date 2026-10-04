import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '@/i18n/ui';

export const informationPanel = 'rounded-3xl border border-white/10 bg-zinc-900/65 p-6 sm:p-8';
export const informationLink = 'inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300';

export default function InformationPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <main className="min-h-[var(--app-height)] px-4 py-8 text-zinc-100 sm:px-6">
    <div className="mx-auto max-w-5xl">
      <header className={informationPanel}>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">{ui('About this project')}</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{ui(title)}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{ui(intro)}</p>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label={ui('About this project')}>
          <Link to="/" className={informationLink}>{ui('← Back to home')}</Link>
          <Link to="/credits" className={informationLink}>{ui('Credits')}</Link>
          <Link to="/imprint" className={informationLink}>{ui('Imprint')}</Link>
        </nav>
      </header>
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  </main>;
}
