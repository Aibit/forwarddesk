/** Approximate [lat, lon] for the parser's known locations (for the PDF route map). */
export const COORDS: Record<string, [number, number]> = {
  Shanghai: [31.23, 121.47],
  'Shanghai (Yangshan)': [30.62, 122.06],
  'Shanghai (Waigaoqiao)': [31.36, 121.6],
  'Shanghai (PVG)': [31.14, 121.81],
  Ningbo: [29.87, 121.55],
  Shenzhen: [22.54, 114.06],
  Qingdao: [36.07, 120.38],
  Barcelona: [41.35, 2.16],
  'Barcelona (BCN)': [41.3, 2.08],
  Valencia: [39.45, -0.32],
  Algeciras: [36.13, -5.45],
  Bilbao: [43.35, -3.05],
  'Madrid (MAD)': [40.47, -3.56],
  Rotterdam: [51.95, 4.14],
  Hamburg: [53.54, 9.97],
  Antwerp: [51.26, 4.4],
  Dubai: [25.2, 55.27],
  'Dubai (DXB)': [25.25, 55.36],
  'Jebel Ali': [25.01, 55.06],
  'Abu Dhabi': [24.45, 54.38],
  Sharjah: [25.35, 55.39],
  Riyadh: [24.71, 46.68],
  Jeddah: [21.49, 39.19],
  Dammam: [26.43, 50.1],
  Singapore: [1.26, 103.82],
  'Nhava Sheva': [18.95, 72.95],
  Casablanca: [33.6, -7.62],
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Points along the great circle from a to b, as [lat, lon]. */
export function greatCircle(a: [number, number], b: [number, number], n = 64): [number, number][] {
  const [la1, lo1, la2, lo2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
  if (d < 1e-6) return [a, b];
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);
    out.push([deg(Math.atan2(z, Math.sqrt(x * x + y * y))), deg(Math.atan2(y, x))]);
  }
  return out;
}
