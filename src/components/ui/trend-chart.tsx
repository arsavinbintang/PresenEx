export interface TrendPoint {
  label: string;
  value: number | null;
}

export function TrendChart({
  points,
  height = 120,
}: {
  points: TrendPoint[];
  height?: number;
}) {
  const width = 320;
  const gap = 10;
  const barWidth = Math.max(
    6,
    (width - gap * (points.length + 1)) / Math.max(points.length, 1),
  );

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height + 22}`}
        className="h-auto w-full"
        role="img"
        aria-label="Grafik tren kehadiran"
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - (tick / 100) * height;
          return (
            <line
              key={tick}
              x1="0"
              x2={width}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={tick === 0 ? undefined : "3 4"}
            />
          );
        })}

        {points.map((point, index) => {
          const x = gap + index * (barWidth + gap);
          const ratio = point.value === null ? 0 : Math.max(0, Math.min(100, point.value));
          const barHeight = (ratio / 100) * height;
          return (
            <g key={`${point.label}-${index}`}>
              <rect
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={Math.max(barHeight, point.value === null ? 0 : 2)}
                rx="3"
                fill="var(--accent)"
                opacity={point.value === null ? 0.15 : 0.85}
              />
              {point.value === null ? (
                <text
                  x={x + barWidth / 2}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize="8"
                  fill="var(--muted)"
                >
                  –
                </text>
              ) : null}
              <text
                x={x + barWidth / 2}
                y={height + 15}
                textAnchor="middle"
                fontSize="8"
                fill="var(--muted)"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
