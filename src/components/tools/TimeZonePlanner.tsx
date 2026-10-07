import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { useAtlasData } from '@/games/atlas/useAtlasData';
import { useLifeTools } from '@/hooks/useLifeTools';
import { useToolClock } from '@/hooks/useToolClock';
import { validZone } from '@/data/lifeTools';
import locations from '@/data/timeZoneLocations.json';
import { Field, StorageNote } from './LifeToolParts';
import { ui } from '@/i18n/ui';
function Planner() {
  const { state, save, remove, sessionOnly, loading } = useLifeTools();
  const { data, error } = useAtlasData();
  const [params, setParams] = useSearchParams();
  const selected = validZone(params.get('zone')) ? params.get('zone')! : state.zones[0]?.zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const setSelected = (zone: string) => { const next = new URLSearchParams(params); next.set('zone', zone); setParams(next, { replace: true }); };
  const [message, setMessage] = useState(''), [zoom, setZoom] = useState(1);
  const now = useToolClock(true);
  const map = useMemo(() => {
    if (!data) return null;
    const topology = data.topology as Topology<{ countries: GeometryCollection }>;
    const countries = feature(topology, topology.objects.countries) as unknown as FeatureCollection;
    const projection = geoEqualEarth().fitExtent([[10, 10], [950, 490]], countries);
    return { outline: geoPath(projection)(countries), pins: locations.filter(l => validZone(l.zone)).map(l => ({ ...l, point: projection(l.coordinates as [number, number])! })) };
  }, [data]);
  const clock = (zone: string) => new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  const date = (zone: string) => new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric' }).format(now);
  const center = map?.pins.find(pin => pin.zone === selected)?.point ?? [480, 250], width = 960 / zoom, height = 500 / zoom;
  const viewBox = `${Math.max(0, Math.min(960 - width, center[0] - width / 2))} ${Math.max(0, Math.min(500 - height, center[1] - height / 2))} ${width} ${height}`;
  const saved = state.zones.some(z => z.zone === selected);
  return <section className="pt-workbench" aria-label={ui('Time-Zone Planner')}><div className="life-workspace"><div>
    <p>{ui('Click a location on the map to see its local time.')}</p>
    {map ? <svg className="life-zone-map" viewBox={viewBox} role="group" aria-label={ui('Time zone locations on the world map')}><path d={map.outline ?? ''} fill="#293653" stroke="#7689ac" strokeWidth=".5" />{map.pins.map(pin => <g key={pin.zone} role="button" tabIndex={0} aria-label={pin.zone.replaceAll('_', ' ')} aria-pressed={selected === pin.zone} onClick={() => setSelected(pin.zone)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(pin.zone); } }}><title>{pin.zone.replaceAll('_', ' ')}</title><circle cx={pin.point[0]} cy={pin.point[1]} r={(selected === pin.zone ? 7 : 4) / zoom} fill={selected === pin.zone ? '#fef3c7' : '#b6a6f2'} stroke="#111b31" strokeWidth={1 / zoom} /></g>)}</svg> : <p role="status">{error ? ui(error) : ui('Loading map…')}</p>}
    {map && <div className="pt-actions"><button className="lt-button" type="button" disabled={zoom >= 8} onClick={() => setZoom(Math.min(8, zoom * 2))}>{ui('Zoom in')}</button><button className="lt-button" type="button" disabled={zoom <= 1} onClick={() => setZoom(Math.max(1, zoom / 2))}>{ui('Zoom out')}</button></div>}
    <details><summary>{ui('Select a time zone with the keyboard')}</summary><Field label="Time zone"><select value={selected} onChange={e => setSelected(e.target.value)}>{[...new Set([selected, ...locations.map(l => l.zone), 'UTC'])].filter(validZone).sort().map(zone => <option key={zone}>{zone}</option>)}</select></Field></details>
    <p className="lt-storage-note">{ui('Map pins represent IANA locations, not time zone boundaries. Times include daylight-saving changes.')}</p>
  </div><aside><h2>{ui('Selected time zone')}</h2><div className="pt-result"><strong>{selected.replaceAll('_', ' ')}</strong><output className="pt-output">{clock(selected)}</output><p>{date(selected)}</p><button type="button" className="lt-button primary" disabled={loading || saved} onClick={() => setMessage(save('zones', { id: crypto.randomUUID(), zone: selected, from: '09:00', to: '17:00' }) ? 'Saved.' : 'Could not save. Check the inputs or storage limits.')}>{ui(saved ? 'Saved' : 'Save time zone')}</button></div>
    <h2>{ui('Saved time zones')}</h2>{!state.zones.length && <p>{ui('Select a location to save your first time zone.')}</p>}<ul className="life-list life-zone-list">{state.zones.map(zone => <li className="life-row" key={zone.id}><div><button type="button" className="lt-text-link" aria-pressed={selected === zone.zone} onClick={() => setSelected(zone.zone)}>{zone.zone.replaceAll('_', ' ')}</button><strong className="life-clock">{clock(zone.zone)}</strong><small>{date(zone.zone)}</small></div><button className="lt-text-link" type="button" disabled={loading} aria-label={`${ui('Remove')} ${zone.zone}`} onClick={() => remove('zones', zone.id)}>{ui('Remove')}</button></li>)}</ul><p role="status">{ui(message)}</p><StorageNote sessionOnly={sessionOnly} />
  </aside></div></section>;
}
export default function TimeZonePlanner() { const { account } = useLifeTools(); return <Planner key={account} />; }
