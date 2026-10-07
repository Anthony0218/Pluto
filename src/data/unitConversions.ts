// Definitions from NIST SP 811. US liquid units and international inch/pound.
export type UnitGroup = 'Length' | 'Mass' | 'Temperature' | 'Speed' | 'Area' | 'Volume' | 'Data size';
export type Unit = { id: string; group: UnitGroup; symbol: string; factor: number; offset?: number };
const unit = (group: UnitGroup, id: string, symbol: string, factor: number, offset = 0): Unit => ({ group, id, symbol, factor, offset });
export const units: Unit[] = [
  unit('Length', 'm', 'm', 1), unit('Length', 'km', 'km', 1000), unit('Length', 'cm', 'cm', .01), unit('Length', 'mm', 'mm', .001), unit('Length', 'in', 'in', .0254), unit('Length', 'ft', 'ft', .3048), unit('Length', 'yd', 'yd', .9144), unit('Length', 'mi', 'mi', 1609.344),
  unit('Mass', 'kg', 'kg', 1), unit('Mass', 'g', 'g', .001), unit('Mass', 'mg', 'mg', .000001), unit('Mass', 'lb', 'lb', .45359237), unit('Mass', 'oz', 'oz', .45359237 / 16),
  unit('Temperature', 'C', '°C', 1, 273.15), unit('Temperature', 'F', '°F', 5 / 9, 273.15 - 32 * 5 / 9), unit('Temperature', 'K', 'K', 1),
  unit('Speed', 'ms', 'm/s', 1), unit('Speed', 'kmh', 'km/h', 1 / 3.6), unit('Speed', 'mph', 'mph', .44704), unit('Speed', 'kn', 'kn', 1852 / 3600),
  unit('Area', 'm2', 'm²', 1), unit('Area', 'km2', 'km²', 1e6), unit('Area', 'cm2', 'cm²', .0001), unit('Area', 'ha', 'ha', 10000), unit('Area', 'acre', 'acre', 4046.8564224), unit('Area', 'ft2', 'ft²', .3048 ** 2),
  unit('Volume', 'L', 'L', 1), unit('Volume', 'ml', 'mL', .001), unit('Volume', 'm3', 'm³', 1000), unit('Volume', 'USgal', 'US gal', 3.785411784), unit('Volume', 'USfloz', 'US fl oz', 3.785411784 / 128),
  unit('Data size', 'B', 'B', 1), unit('Data size', 'bit', 'bit', 1 / 8), unit('Data size', 'kB', 'kB', 1000), unit('Data size', 'MB', 'MB', 1e6), unit('Data size', 'GB', 'GB', 1e9), unit('Data size', 'KiB', 'KiB', 1024), unit('Data size', 'MiB', 'MiB', 1024 ** 2), unit('Data size', 'GiB', 'GiB', 1024 ** 3),
];
export const unitGroups = [...new Set(units.map(item => item.group))];
export function convertUnit(value: number, fromId: string, toId: string): number | null {
  const from = units.find(item => item.id === fromId), to = units.find(item => item.id === toId);
  if (!from || !to || from.group !== to.group || !Number.isFinite(value)) return null;
  const base = value * from.factor + (from.offset ?? 0);
  if (from.group === 'Temperature' ? base < -1e-10 : value < 0) return null;
  const result = ((from.group === 'Temperature' ? Math.max(0, base) : base) - (to.offset ?? 0)) / to.factor;
  return Number.isFinite(result) ? result : null;
}
