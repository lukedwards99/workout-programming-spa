export function formatCount(n: number): string {
  return n.toLocaleString();
}

export function formatVolume(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}

export function formatAverage(n: number | null): string {
  if (n === null) return '\u2014';
  return n.toFixed(1);
}

export function formatPercentage(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
