import FootballTournaments from '@/components/learning/FootballTournaments';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronRight, List, Search, Shield, Trophy, Users } from 'lucide-react';
import HubLayout from '@/components/learning/HubLayout';
import FootballLab, { HonoursExplorer } from '@/components/learning/FootballLab';
import { footballCategories, footballStatsRoute, footballTopicRoute, footballTopics, resolveFootballTopic, type FootballCategoryId, type FootballTopic } from '@/data/footballReference';
import { footballEdition } from '@/data/footballLearning';
import { ui, useUiLanguage } from '@/i18n/ui';
import NotFoundPage from '@/pages/general/NotFoundPage';
import '@/components/learning/subjectLessons.css';
import './footballReference.css';

const categoryIcons = { rules: Shield, positions: Users, tactics: List };
function StatsBox() {
  return <Link className="fr-stats-box" to={footballStatsRoute}><span className="fr-stats-icon"><Trophy size={30} aria-hidden /></span><div><p className="lt-eyebrow">{ui('Clubs and national teams')}</p><h2>{ui('Football stats')}</h2><p>{ui('Explore club trophies, six domestic leagues and cups, European competitions, and World Cup winners.')}</p><span className="lt-text-link">{ui('Open football stats')}<ArrowRight size={17} aria-hidden /></span></div></Link>;
}
function CategoryNav({ current }: { current?: string }) {
  return <nav className="fr-category-nav" aria-label={ui('Football categories')}><Link to="/learn/football" aria-current={current ? undefined : 'page'}>{ui('All categories')}</Link>{footballCategories.map(category => <Link key={category.id} to={`/learn/football/${category.id}`} aria-current={current === category.id ? 'page' : undefined}>{ui(category.title)}</Link>)}<Link to={footballStatsRoute} aria-current={current === 'stats' ? 'page' : undefined}><Trophy size={16} aria-hidden />{ui('Football stats')}</Link></nav>;
}
function TopicList({ topics, selected, compact = false }: { topics: FootballTopic[]; selected?: string; compact?: boolean }) {
  return <ul className={`fr-topic-list ${compact ? 'fr-topic-list-compact' : ''}`}>{topics.map(topic => <li key={topic.id}><Link to={footballTopicRoute(topic)} aria-current={selected === topic.id ? 'page' : undefined}><span>{topic.law && <small className="fr-law-number">{ui('Law')} {topic.law}</small>}<strong>{ui(topic.title)}</strong>{!compact && <small>{ui(topic.summary)}</small>}</span><ChevronRight size={18} aria-hidden /></Link></li>)}</ul>;
}
function CategoryList({ categoryId }: { categoryId: FootballCategoryId }) {
  const [query, setQuery] = useState('');
  const normalize = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim();
  const topics = footballTopics.filter(topic => topic.categoryId === categoryId && normalize([ui(topic.title), ui(topic.summary), ...topic.elements.map(ui)].join(' ')).includes(normalize(query)));
  return <section className="lt-panel"><div className="fr-list-heading"><h2>{ui('Choose what to have explained')}</h2><label className="fr-search"><Search size={17} aria-hidden /><input type="search" aria-label={ui('Search topics in this category')} placeholder={ui('Search topics in this category')} value={query} onChange={event => setQuery(event.target.value)} /></label></div>{topics.length ? <TopicList topics={topics} /> : <p role="status">{ui('No matching topics. Try another search.')}</p>}</section>;
}
function TopicExplanation({ topic }: { topic: FootballTopic }) {
  return <div className="fr-detail-grid"><article className="lt-panel fr-explanation"><p className="lt-eyebrow">{ui('Explanation')}{topic.law && ` · ${ui('Law')} ${topic.law}`}</p><h2>{ui(topic.title)}</h2>{topic.paragraphs.map((paragraph, index) => <p key={index}>{ui(paragraph)}</p>)}<section className="fr-elements"><h3>{ui('Elements covered')}</h3><ul>{topic.elements.map(element => <li key={element}>{ui(element)}</li>)}</ul></section>{topic.lab && <FootballLab key={topic.id} topic={topic.lab.topic} tactics={topic.lab.tactics} />}{topic.law && <p className="sl-source">{footballEdition} · <a href={`https://www.theifab.com/laws/latest/${topic.lawSlug}/`} target="_blank" rel="noreferrer">{ui('Full law, procedures, and exceptions')}<ArrowRight size={13} aria-hidden /></a></p>}<Link className="lt-text-link" to={`/learn/football/${topic.categoryId}`}>{ui('Back to category')}<ArrowRight size={16} aria-hidden /></Link></article><aside className="lt-panel fr-topic-index"><h2>{ui('Topics in this category')}</h2><TopicList topics={footballTopics.filter(item => item.categoryId === topic.categoryId)} selected={topic.id} compact /></aside></div>;
}
export default function FootballReferencePage() {
  useUiLanguage();
  const { pathId, lessonId } = useParams();
  const categoryId = pathId === 'positions-tactics' ? 'tactics' : pathId;
  const resolved = lessonId && pathId ? resolveFootballTopic(pathId, lessonId) : undefined;
  if (resolved?.categoryId === 'stats') return <Navigate to={footballStatsRoute} replace />;
  if (lessonId && !resolved) return <NotFoundPage />;
  const topic = resolved as FootballTopic | undefined;
  if (topic && footballTopicRoute(topic) !== `/learn/football/${pathId}/${lessonId}`) return <Navigate to={footballTopicRoute(topic)} replace />;
  if (pathId === 'positions-tactics' && !lessonId) return <Navigate to="/learn/football/tactics" replace />;
  const category = footballCategories.find(item => item.id === categoryId);
  if (categoryId && categoryId !== 'stats' && !category) return <NotFoundPage />;
  if (categoryId === 'stats' && lessonId) return <NotFoundPage />;
  const title = topic?.title ?? category?.title ?? (categoryId === 'stats' ? 'Football stats' : 'Football');
  const description = topic?.summary ?? category?.description ?? (categoryId === 'stats' ? 'Club honours and World Cup winners, with dated records and sources.' : 'Choose a category, then open any explanation that interests you.');
  const breadcrumbs = [{ title: 'Learn', route: '/learn' }, { title: 'Football', ...(pathId ? { route: '/learn/football' } : {}) }, ...(pathId ? [{ title: category?.title ?? 'Football stats', ...(topic ? { route: `/learn/football/${categoryId}` } : {}) }] : []), ...(topic ? [{ title: topic.title }] : [])];
  return <HubLayout eyebrow="Football reference" title={title} description={description} breadcrumbs={breadcrumbs}><CategoryNav current={categoryId} />{categoryId === 'stats' ? <><FootballTournaments /><details><summary>{ui('Club honours and national team records')}</summary><HonoursExplorer /></details></> : <>{!categoryId && <FootballTournaments />}<div className={categoryId ? 'fr-page-workspace' : undefined}><div>{topic ? <TopicExplanation topic={topic} /> : category ? <>{categoryId === 'rules' && <p className="fr-edition">{footballEdition} · {ui('All 17 laws are listed. Open a law for its explanation, elements, and official reference.')}</p>}<CategoryList key={category.id} categoryId={category.id} /></> : <section className="lt-section" aria-labelledby="football-categories-title"><div className="lt-section-heading"><h2 id="football-categories-title">{ui('Football categories')}</h2></div><div className="fr-categories">{footballCategories.map(item => { const Icon = categoryIcons[item.id]; return <Link key={item.id} className="lt-path-card" to={`/learn/football/${item.id}`}><Icon size={25} aria-hidden /><h3>{ui(item.title)}</h3><p>{ui(item.description)}</p><span className="lt-text-link">{ui('Browse explanations')}<ArrowRight size={16} aria-hidden /></span></Link>; })}</div></section>}</div>{categoryId && <aside><StatsBox /></aside>}</div></>}</HubLayout>;
}
