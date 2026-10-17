'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatDate, formatNumber } from '@/lib/format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/**
 * Weight progression line chart. Data comes straight from the API
 * (`/api/stats/:handle` → weightHistory), never from hardcoded values.
 */
export default function WeightChart({ history = [], height = 260 }) {
  const chartData = useMemo(() => {
    const points = [...history]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((entry) => ({
        x: formatDate(entry.date, { year: '2-digit' }),
        y: Number(entry.weight),
      }));

    const first = points[0]?.y;
    const last = points[points.length - 1]?.y;
    const delta = first !== undefined && last !== undefined ? last - first : 0;

    return {
      labels: points.map((point) => point.x),
      datasets: [
        {
          label: 'Weight (kg)',
          data: points.map((point) => point.y),
          borderColor: '#111310',
          backgroundColor: 'rgba(215, 242, 75, 0.28)',
          pointBackgroundColor: '#d7f24b',
          pointBorderColor: '#111310',
          pointBorderWidth: 1.5,
          pointRadius: history.length > 18 ? 0 : 4,
          pointHoverRadius: 6,
          borderWidth: 2.5,
          tension: 0.3,
          fill: true,
        },
      ],
      delta,
    };
  }, [history]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111310',
        titleColor: '#f4f4ef',
        bodyColor: '#d7f24b',
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (item) => `${formatNumber(item.parsed.y, 1)} kg`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: '#e2e2d9' },
        ticks: {
          color: '#5a5f54',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          font: { size: 11 },
        },
      },
      y: {
        grid: { color: '#eeeee8' },
        border: { display: false },
        ticks: {
          color: '#5a5f54',
          font: { size: 11 },
          callback: (value) => `${value}kg`,
        },
      },
    },
  };

  if (history.length < 2) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-surface-sunken p-6 text-center">
        <p className="text-sm font-medium text-ink">Not enough weight history</p>
        <p className="max-w-xs text-xs text-ink-soft">
          Log at least two weigh-ins to see the progression chart.
        </p>
      </div>
    );
  }

  const delta = chartData.delta;
  const summary =
    Math.abs(delta) < 0.05
      ? 'Weight held steady'
      : `${Math.abs(delta).toFixed(1)} kg ${delta < 0 ? 'down' : 'up'} since first entry`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="tnum text-lg font-semibold sm:text-xl">
          {formatNumber(history[history.length - 1]?.weight, 1)} kg
        </p>
        <p className="text-xs text-ink-soft">{summary}</p>
      </div>
      <div style={{ height }} className="w-full">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}