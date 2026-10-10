import { createClient } from 'jsr:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!, anonKey = Deno.env.get('SUPABASE_ANON_KEY')!, openaiKey = Deno.env.get('OPENAI_API_KEY');
const cors = { 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200, origin = '*') => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Access-Control-Allow-Origin': origin, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' } });
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000 ? Math.round(value * 100) / 100 : undefined;

Deno.serve(async request => {
  const origin = request.headers.get('Origin') ?? '*';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405, origin);
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!token) return reply({ error: 'Sign in required' }, 401, origin);
    const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user } } = await client.auth.getUser(token);
    if (!user) return reply({ error: 'Sign in required' }, 401, origin);
    const raw = await request.text();
    if (raw.length > 4_100_000) return reply({ error: 'Image is too large' }, 413, origin);
    const body = JSON.parse(raw) as { image?: unknown };
    if (typeof body.image !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/i.test(body.image) || body.image.length > 4_000_000) return reply({ error: 'Invalid image' }, 400, origin);
    if (!openaiKey) return reply({ error: 'Nutrition scan is not configured' }, 503, origin);
    const upstream = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: Deno.env.get('NUTRITION_SCAN_MODEL') ?? 'gpt-4.1-mini', max_output_tokens: 240, instructions: 'Read a photographed food nutrition label. Return only JSON with name, energy, protein, carbs, fat and fiber. Each nutrient is the numeric value per 100 g or 100 ml; use null when unreadable. Never invent values.', input: [{ role: 'user', content: [{ type: 'input_text', text: 'Extract the nutrition label.' }, { type: 'input_image', image_url: body.image, detail: 'high' }] }] }), signal: AbortSignal.timeout(20000) });
    if (!upstream.ok) return reply({ error: 'Nutrition recognition unavailable' }, 503, origin);
    const response = await upstream.json() as { status?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const output = (Array.isArray(response.output) ? response.output : [])
      .filter(item => item.type === 'message' && Array.isArray(item.content))
      .flatMap(item => item.content!)
      .filter(part => part.type === 'output_text' && typeof part.text === 'string')
      .map(part => part.text).join('');
    if (!output || response.status === 'incomplete') return reply({ error: 'Nutrition recognition unavailable' }, 503, origin);
    const parsed = JSON.parse(output.trim().replace(/^```json\s*|\s*```$/g, '')) as Record<string, unknown>;
    const name = typeof parsed.name === 'string' ? parsed.name.trim().slice(0, 100) : '';
    return reply({ food: { name, energy: numeric(parsed.energy), protein: numeric(parsed.protein), carbs: numeric(parsed.carbs), fat: numeric(parsed.fat), fiber: numeric(parsed.fiber) } }, 200, origin);
  } catch {
    return reply({ error: 'Nutrition recognition unavailable' }, 503, request.headers.get('Origin') ?? '*');
  }
});
