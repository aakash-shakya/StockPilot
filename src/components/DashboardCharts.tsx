import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface StockHealthChartProps {
  critical: number
  warning: number
  good: number
}

export function StockHealthChart({ critical, warning, good }: StockHealthChartProps) {
  const data = {
    labels: ['Critical', 'Warning', 'Healthy'],
    datasets: [
      {
        data: [critical, warning, good],
        backgroundColor: ['#dc2626', '#d97706', '#059669'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8,
          font: { family: 'DM Sans', size: 12 },
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { family: 'Sora', size: 13 },
        bodyFont: { family: 'DM Sans', size: 12 },
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
      },
    },
  }

  return (
    <div className="h-52">
      <Doughnut data={data} options={options} />
    </div>
  )
}

interface ProductValueChartProps {
  products: Array<{ name: string; valueCents: number }>
}

export function ProductValueChart({ products }: ProductValueChartProps) {
  const top8 = products.slice(0, 8)

  const data = {
    labels: top8.map((p) => p.name.length > 18 ? p.name.slice(0, 16) + '...' : p.name),
    datasets: [
      {
        data: top8.map((p) => p.valueCents / 100),
        backgroundColor: '#0891b2',
        borderRadius: 4,
        barThickness: 16,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { family: 'Sora', size: 13 },
        bodyFont: { family: 'DM Sans', size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: { parsed: { x: number | null } }) => ` $${(ctx.parsed.x ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { family: 'DM Sans', size: 11 },
          color: '#64748b',
        },
      },
    },
  }

  return (
    <div className="h-52">
      <Bar data={data} options={options} />
    </div>
  )
}
