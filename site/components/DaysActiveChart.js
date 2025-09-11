import React, { useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const DaysActiveChart = ({ data = [] }) => {
  const canvasRef = useRef(null);
  const chartInstance = useRef(null);
  
  const chartData = {
    labels: data.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }),
    datasets: [
      {
        label: 'Hours Spent',
        data: data.map(item => item.hours),
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 14,
          },
        },
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            const index = context[0].dataIndex;
            const date = new Date(data[index].date);
            return date.toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
          },
          label: function(context) {
            return `Hours: ${context.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
          font: {
            size: 14,
          },
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Hours Spent',
          font: {
            size: 14,
          },
        },
        beginAtZero: true,
      },
    },
  };

  // Initialize chart
  useEffect(() => {
    if (canvasRef.current && !chartInstance.current) {
      const ctx = canvasRef.current.getContext('2d');
      chartInstance.current = new ChartJS(ctx, {
        type: 'bar',
        data: chartData,
        options: options,
      });
    }

    // Update chart when data changes
    if (chartInstance.current) {
      chartInstance.current.data = chartData;
      chartInstance.current.update();
    }

    // Cleanup chart on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data]);

  return (
    <div style={{ width: '100%', marginTop: '20px', backgroundColor: '#f5f5f5', border: '1px solid #333', borderRadius: '8px', padding: '20px' }}>
      <h3 style={{ margin: '0 0 20px 0', textAlign: 'center', color: '#333' }}>
        Total Hours Spent Per Day
      </h3>
      <div style={{ height: '200px' }}>
        <canvas ref={canvasRef} />
      </div>
      {data.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          No daysActive data available.
        </div>
      )}
    </div>
  );
};

export default DaysActiveChart;
