// Model router: quick everyday chat → small fast model; harder questions → strongest free model.
// Like sending small parcels by bike and big ones by van.
const HARD_HINTS = [
  'explain', 'why', 'how does', 'how do', 'compare', 'difference', 'plan', 'code', 'error', 'debug', 'algorithm',
  'prove', 'solve', 'calculate', 'summar', 'step by step', 'detail',
  'eppadi', 'yen', 'enna difference', 'vilakku', 'purila', 'puriyala',
];

export function pickTier(text) {
  const t = text.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words > 25) return 'strong';
  if (HARD_HINTS.some((h) => t.includes(h))) return 'strong';
  return 'small';
}
