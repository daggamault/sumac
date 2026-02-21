export const qp = (
  q: Record<string, string | string[]>,
  key: string,
  fallback: number
) => {
  const v = q[key];
  if (!v) return fallback;
  const n = Number.parseInt(Array.isArray(v) ? v[0] : v, 10);
  return Number.isNaN(n) ? fallback : n;
};
