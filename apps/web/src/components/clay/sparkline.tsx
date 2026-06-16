/**
 * A dependency-free SVG area sparkline for the download-trend card. The prototype
 * used Chart.js on a canvas; an inline SVG renders the same shape server-side
 * with no client JS and no library. Fed the per-day install counts, it plots the
 * cumulative (running-total) curve in the ember accent, matching the design.
 */

type Props = Readonly<{
  /** Per-day counts, oldest first. */
  data: number[];
  width?: number;
  height?: number;
  /** Stable id so multiple charts on a page do not share a gradient def. */
  gradientId?: string;
}>;

/** Running total of a series, e.g. [1,0,2] -> [1,1,3]. */
function cumulative(values: number[]): number[] {
  let sum = 0;
  return values.map((value) => {
    sum += value;
    return sum;
  });
}

export function Sparkline({ data, width = 256, height = 96, gradientId = "spark" }: Props) {
  const points = cumulative(data);
  if (points.length < 2) return null;

  const max = Math.max(...points, 1);
  const stepX = width / (points.length - 1);
  // Leave 2px top/bottom padding so the stroke is not clipped.
  const y = (value: number) => height - 2 - (value / max) * (height - 4);
  const coords = points.map((value, index) => [index * stepX, y(value)] as const);

  const line = coords
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="Install trend"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand, #f2542d)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-brand, #f2542d)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-brand, #f2542d)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
