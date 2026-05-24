import React, { useMemo } from 'react';

export type MonEspaceWorkloadCounts = {
  aFaire: number;
  enCours: number;
  enRetard: number;
  termine: number;
};

type BarRowId = 'afaire' | 'encours' | 'retard' | 'termine';

type BarRow = {
  id: BarRowId;
  label: string;
  value: number;
  gradId: string;
  colorDark: string;
};

const ROWS: Omit<BarRow, 'value'>[] = [
  {
    id: 'afaire',
    label: 'À FAIRE',
    gradId: 'ms-wl-grad-afaire',
    colorDark: '#6B7280',
  },
  {
    id: 'encours',
    label: 'EN COURS',
    gradId: 'ms-wl-grad-encours',
    colorDark: '#7C3AED',
  },
  {
    id: 'retard',
    label: 'EN RETARD',
    gradId: 'ms-wl-grad-retard',
    colorDark: '#F97316',
  },
  {
    id: 'termine',
    label: 'TERMINÉ',
    gradId: 'ms-wl-grad-termine',
    colorDark: '#10B981',
  },
];

const VALUE_KEYS: Record<BarRowId, keyof MonEspaceWorkloadCounts> = {
  afaire: 'aFaire',
  encours: 'enCours',
  retard: 'enRetard',
  termine: 'termine',
};

const CHART = {
  width: 720,
  height: 360,
  panelInset: 4,
  panelRadius: 22,
  axisX: 72,
  axisYTop: 28,
  axisYBottom: 286,
  axisXRight: 696,
  labelX: 82,
  barStart: 220,
  barMaxWidth: 440,
  barHeight: 34,
  barRadius: 16,
  rowFirstY: 78,
  rowStep: 50,
  axisStroke: 3,
};

type MonEspaceWorkloadChartProps = {
  counts: MonEspaceWorkloadCounts;
  onRowClick?: (id: BarRowId) => void;
};

function barWidth(value: number, max: number): number {
  if (value <= 0) return 0;
  const ratio = value / max;
  return Math.max(28, Math.round(ratio * CHART.barMaxWidth));
}

const MonEspaceWorkloadChart: React.FC<MonEspaceWorkloadChartProps> = ({
  counts,
  onRowClick,
}) => {
  const rows = useMemo<BarRow[]>(
    () =>
      ROWS.map((row) => ({
        ...row,
        value: counts[VALUE_KEYS[row.id]],
      })),
    [counts]
  );

  const maxValue = useMemo(
    () => Math.max(1, ...rows.map((r) => r.value)),
    [rows]
  );

  const summary = rows
    .map((r) => `${r.label} ${r.value}`)
    .join(', ');

  const panelSize = CHART.width - CHART.panelInset * 2;

  return (
    <div className="ms-workload-bar-chart" aria-label={`Workload by Status : ${summary}`}>
      <svg
        className="ms-workload-bar-chart-svg"
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <linearGradient id="ms-wl-panel-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FAF8FF" />
            <stop offset="45%" stopColor="#F5F3FF" />
            <stop offset="100%" stopColor="#FFF7ED" />
          </linearGradient>
          <linearGradient id="ms-wl-grad-afaire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E5E7EB" />
            <stop offset="55%" stopColor="#D1D5DB" />
            <stop offset="100%" stopColor="#9CA3AF" />
          </linearGradient>
          <linearGradient id="ms-wl-grad-encours" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DDD6FE" />
            <stop offset="55%" stopColor="#C4B5FD" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="ms-wl-grad-retard" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FED7AA" />
            <stop offset="55%" stopColor="#FDBA74" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          <linearGradient id="ms-wl-grad-termine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="55%" stopColor="#6EE7B7" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <filter id="ms-wl-bar-shadow" x="-10%" y="-50%" width="125%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#475569" floodOpacity="0.32" />
          </filter>
          <filter id="ms-wl-panel-shadow" x="-6%" y="-6%" width="112%" height="118%">
            <feDropShadow dx="0" dy="8" stdDeviation="14" floodColor="#7c3aed" floodOpacity="0.14" />
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.12" />
          </filter>
        </defs>

        <rect
          x={CHART.panelInset}
          y={CHART.panelInset}
          width={panelSize}
          height={CHART.height - CHART.panelInset * 2}
          rx={CHART.panelRadius}
          fill="url(#ms-wl-panel-bg)"
          filter="url(#ms-wl-panel-shadow)"
        />

        <rect
          x={CHART.panelInset + 10}
          y={CHART.panelInset + 10}
          width={panelSize - 20}
          height={CHART.height - CHART.panelInset * 2 - 20}
          rx={CHART.panelRadius - 6}
          fill="#ffffff"
          opacity="0.94"
        />

        <line
          x1={CHART.axisX}
          y1={CHART.axisYBottom}
          x2={CHART.axisX}
          y2={CHART.axisYTop}
          stroke="#A78BFA"
          strokeWidth={CHART.axisStroke}
          strokeLinecap="round"
        />
        <polygon
          points={`${CHART.axisX},${CHART.axisYTop - 10} ${CHART.axisX - 7},${CHART.axisYTop + 4} ${CHART.axisX + 7},${CHART.axisYTop + 4}`}
          fill="#8B5CF6"
        />

        <line
          x1={CHART.axisX}
          y1={CHART.axisYBottom}
          x2={CHART.axisXRight}
          y2={CHART.axisYBottom}
          stroke="#A78BFA"
          strokeWidth={CHART.axisStroke}
          strokeLinecap="round"
        />
        <polygon
          points={`${CHART.axisXRight + 10},${CHART.axisYBottom} ${CHART.axisXRight - 3},${CHART.axisYBottom - 7} ${CHART.axisXRight - 3},${CHART.axisYBottom + 7}`}
          fill="#8B5CF6"
        />

        {[0.25, 0.5, 0.75, 1].map((t) => {
          const x = CHART.barStart + CHART.barMaxWidth * t;
          return (
            <line
              key={t}
              x1={x}
              y1={CHART.axisYTop + 10}
              x2={x}
              y2={CHART.axisYBottom - 6}
              stroke="#DDD6FE"
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />
          );
        })}

        {rows.map((row, index) => {
          const cy = CHART.rowFirstY + index * CHART.rowStep;
          const w = barWidth(row.value, maxValue);
          const barY = cy - CHART.barHeight / 2;
          const clickable = onRowClick != null;

          return (
            <g
              key={row.id}
              className={`ms-workload-bar-row${clickable ? ' is-clickable' : ''}`}
              onClick={clickable ? () => onRowClick(row.id) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row.id);
                      }
                    }
                  : undefined
              }
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={`${row.label} : ${row.value}`}
            >
              <text
                x={CHART.labelX}
                y={cy + 6}
                className="ms-workload-bar-label"
                fontSize="18"
                fontWeight="700"
                fill={row.colorDark}
              >
                {row.label}
              </text>

              {w > 0 && (
                <>
                  <rect
                    x={CHART.barStart}
                    y={barY + 5}
                    width={w}
                    height={CHART.barHeight}
                    rx={CHART.barRadius}
                    fill="rgba(15,23,42,0.1)"
                  />
                  <rect
                    x={CHART.barStart}
                    y={barY}
                    width={w}
                    height={CHART.barHeight}
                    rx={CHART.barRadius}
                    fill={`url(#${row.gradId})`}
                    filter="url(#ms-wl-bar-shadow)"
                  />
                  <rect
                    x={CHART.barStart + 3}
                    y={barY + 3}
                    width={Math.max(0, w - 12)}
                    height={CHART.barHeight * 0.36}
                    rx={CHART.barRadius - 4}
                    fill="rgba(255,255,255,0.45)"
                  />
                </>
              )}

              <text
                x={CHART.barStart + Math.max(w, 6) + 18}
                y={cy + 10}
                className="ms-workload-bar-count"
                fontSize="32"
                fontWeight="800"
                fill={row.colorDark}
              >
                {row.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default MonEspaceWorkloadChart;
