import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { championshipEditions, chronologicalGoals, footballTournaments, footballFlags, previousChampionship } from '@/data/footballTournaments';
import type { ChampionshipEdition, FootballTournament, TournamentFinal } from '@/data/footballTournaments';
import { Field } from '@/components/tools/LifeToolParts';
import ToolTabs from '@/components/tools/ToolTabs';
import { ui } from '@/i18n/ui';

function Team({ name, national }: { name?: string; national: boolean }) {
  return <span className="fr-team">{name && national && footballFlags[name] && <img src={`/flags/4x3/${footballFlags[name]}.svg`} width="24" height="18" alt="" />}{ui(name ?? 'Unavailable')}</span>;
}

function Final({ final, tournament, year }: { final?: TournamentFinal; tournament: FootballTournament; year: number }) {
  return <article className="fr-final">
    <h2>{ui(tournament.name)} · {year}</h2>
    {!final ? <p role="status">{ui('Final match details are unavailable for this year in the current dataset.')}</p> : <>
      <div className="fr-final-score"><Team name={final.teams[0]} national={tournament.national} /><strong>{final.score.join('–')}</strong><Team name={final.teams[1]} national={tournament.national} /></div>
      {final.extraTime && <p>{ui('After extra time')}</p>}
      {final.penalties && <p className="fr-penalties"><strong>{ui('Penalty shootout')}: {final.penalties.join('–')}</strong> · {ui(final.teams[final.penalties[0] > final.penalties[1] ? 0 : 1])} {ui('won on penalties')}</p>}
      <p>{final.date ?? ui('Date unavailable')}{final.venue && ` · ${final.venue}`}</p>
      <h3>{ui('Goals')}</h3>
      {final.goals?.length ? <>
        <div className="fr-timeline-teams" aria-hidden="true"><Team name={final.teams[0]} national={tournament.national} /><Team name={final.teams[1]} national={tournament.national} /></div>
        <ol className="fr-goal-timeline">{chronologicalGoals(final.goals).map((goal, index) => {
          const side = goal.team === final.teams[0] ? 'left' : goal.team === final.teams[1] ? 'right' : 'unknown';
          return <li className={`fr-goal fr-goal--${side}`} key={index}>
            <span className="fr-goal-minute">{goal.minute ? `${goal.minute.replace(/[′']$/, '')}′` : ui('Minute unavailable')}</span>
            <div className="fr-goal-scorer"><strong>{goal.player || ui('Goalscorer unavailable')}</strong><small>{ui(goal.team)}{goal.kind && ` · ${ui(goal.kind === 'own-goal' ? 'Own goal' : 'Penalty')}`}</small></div>
          </li>;
        })}</ol>
      </> : <p>{ui(final.score[0] + final.score[1] === 0 ? 'No goals in regulation or extra time.' : 'Goalscorer and minute data are unavailable.')}</p>}
      <a className="lt-text-link" href={final.source} target="_blank" rel="noreferrer">{ui('Match source')}</a>
    </>}
  </article>;
}

function ChampionshipHistory({ editions, tournament, finalLink }: { editions: ChampionshipEdition[]; tournament: FootballTournament; finalLink: (year: number) => string }) {
  return <div className="sl-table-wrap fr-history"><table className="sl-table">
    <caption>{ui('Championship history')} · {ui(tournament.name)}</caption>
    <thead><tr><th scope="col">{ui('Year')}</th><th scope="col">{ui('Winner')}</th><th scope="col">{ui('Runner-up')}</th><th scope="col">{ui('Score')}</th><th scope="col">{ui('Final')}</th></tr></thead>
    <tbody>{editions.map(edition => {
      // History columns are winner then runner-up; the final's team order can differ.
      const winnerFirst = edition.final?.teams[0] === edition.winner;
      const score = edition.final && (winnerFirst ? edition.final.score : [...edition.final.score].reverse());
      const penalties = edition.final?.penalties && (winnerFirst ? edition.final.penalties : [...edition.final.penalties].reverse());
      return <tr key={edition.year}>
      <th scope="row">{edition.year}</th><td><Team name={edition.winner} national={tournament.national} /></td><td><Team name={edition.runnerUp} national={tournament.national} /></td>
      <td>{edition.final ? <>{score?.join('–')}{edition.final.extraTime && <small>{ui('After extra time')}</small>}{penalties && <small>{ui('Penalty shootout')}: {penalties.join('–')}</small>}</> : ui('Unavailable')}</td>
      <td><Link className="lt-text-link fr-view-final" to={finalLink(edition.year)} aria-label={`${ui('View Final')} · ${ui(tournament.name)} · ${edition.year}`}>{ui('View Final')}</Link></td>
    </tr>;
    })}</tbody>
  </table></div>;
}

export default function FootballTournaments() {
  const [params, setParams] = useSearchParams();
  const tournament = footballTournaments.find(t => t.id === params.get('competition')) ?? footballTournaments[0];
  const editions = championshipEditions(tournament);
  const years = editions.map(edition => edition.year);
  const tab = params.get('tab') === 'finals' ? 'Finals' : 'Overview';
  const year = params.get('year') === 'all' ? 'all' : years.includes(Number(params.get('year'))) ? Number(params.get('year')) : years[0];
  // Opening a final keeps the overview year (including All). Older tab=finals&year URLs still resolve.
  const finalYear = years.includes(Number(params.get('finalYear'))) ? Number(params.get('finalYear')) : year === 'all' ? undefined : year;
  const panel = useRef<HTMLDivElement>(null);
  const previousView = useRef({ tab, finalYear });
  useEffect(() => {
    const previous = previousView.current;
    previousView.current = { tab, finalYear };
    // A link from a distant history row should reveal and announce its final.
    // Ordinary year/query changes in the overview retain their scroll position.
    if (tab === 'Finals' && finalYear !== undefined && (previous.tab !== tab || previous.finalYear !== finalYear)) {
      panel.current?.focus({ preventScroll: true });
      panel.current?.scrollIntoView({ block: 'start' });
    }
  }, [tab, finalYear]);
  const selected = editions.find(edition => edition.year === year);
  const previous = typeof year === 'number' ? previousChampionship(tournament, year) : undefined;
  const nextParams = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => value === null ? next.delete(key) : next.set(key, value));
    return next;
  };
  const change = (values: Record<string, string | null>) => setParams(nextParams(values));
  const finalLink = (editionYear: number) => `?${nextParams({ competition: tournament.id, year: String(year), tab: 'finals', finalYear: String(editionYear) })}`;
  const history = <ChampionshipHistory editions={editions} tournament={tournament} finalLink={finalLink} />;
  return <section className="pt-workbench" aria-label={ui('Football tournaments')}>
    <div className="life-workspace fr-tournament-workspace"><div>
      <div className="pt-inputs"><Field label="Tournament"><select value={tournament.id} onChange={e => change({ competition: e.target.value, year: null, finalYear: null })}>{footballTournaments.map(t => <option key={t.id} value={t.id}>{ui(t.name)}</option>)}</select></Field>
        <Field label="Year"><select value={tab === 'Finals' && finalYear !== undefined ? finalYear : year} onChange={e => change(e.target.value === 'all' ? { year: 'all', finalYear: null } : tab === 'Finals' ? { finalYear: e.target.value } : { year: e.target.value, finalYear: null })}><option value="all">{ui('All')}</option>{years.map(editionYear => <option key={editionYear} value={editionYear}>{editionYear}</option>)}</select></Field></div>
      <ToolTabs tabs={['Overview', 'Finals'] as const} value={tab} onChange={value => change({ tab: value.toLowerCase() })} label="Tournament sections" panelId="football-tournament-panel" />
      <div ref={panel} id="football-tournament-panel" role="tabpanel" aria-label={ui(tab)} tabIndex={0}>
        {tab === 'Finals' && finalYear !== undefined ? <Final final={editions.find(edition => edition.year === finalYear)?.final} tournament={tournament} year={finalYear} /> : <>
          <h2>{ui(tournament.name)} · {year === 'all' ? ui('All') : year}</h2>
          {selected && <><div className="fr-champion-summary">
            <div className="pt-result"><p>{ui('Winner')}</p><strong><Team name={selected.winner} national={tournament.national} /></strong></div>
            <div className="pt-result"><p>{ui('Runner-up')}</p><strong><Team name={selected.runnerUp} national={tournament.national} /></strong></div>
            <div className="pt-result"><p>{ui('Previous Champion')}</p><strong><Team name={previous?.winner} national={tournament.national} /></strong>{previous && <p>{previous.year}</p>}{!previous && <p>{ui('No earlier edition in the current dataset.')}</p>}</div>
          </div><Link className="lt-text-link fr-view-final" to={finalLink(selected.year)} aria-label={`${ui('View Final')} · ${ui(tournament.name)} · ${selected.year}`}>{ui('View Final')} · {selected.year}</Link></>}
          {year === 'all' && history}
          <p className="lt-storage-note">{ui(tournament.coverage)}</p>
        </>}
      </div>
    </div><aside className="fr-tournament-stats"><h2>{ui('Stats')}</h2><p>{ui(tournament.name)}</p><dl><div><dt>{ui('Recorded editions')}</dt><dd>{years.length}</dd></div><div><dt>{ui('Different winners')}</dt><dd>{tournament.winners.length}</dd></div><div><dt>{ui('Detailed finals')}</dt><dd>{tournament.finals.length}</dd></div></dl><p className="lt-storage-note">{ui(tournament.coverage)}</p><a className="lt-text-link" href={tournament.source} target="_blank" rel="noreferrer">{ui('Competition source')}</a><p className="lt-storage-note">{ui('Historical snapshots; live results and missing editions are not fetched automatically.')}</p></aside></div>
  </section>;
}
