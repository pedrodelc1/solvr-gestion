import { useEffect, useRef } from 'react';
import { formatCurrency } from '../../lib/utils.js';

export function ChartCategorias({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;
    const canvas = canvasRef.current;
    const dpr  = window.devicePixelRatio || 1;
    const W    = canvas.parentElement.clientWidth - 32;
    const barH = 30, gap = 10, padL = 108, padR = 16, padT = 8, padB = 8;
    const H    = data.length * (barH + gap) + padT + padB - gap;

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    ctx.fillStyle = isDark ? '#161616' : '#f5f5f5';
    ctx.fillRect(0, 0, W, H);

    const maxVal = Math.max(...data.map(d => d.total), 1);
    const barW   = W - padL - padR;

    data.forEach((d, i) => {
      const y      = padT + i * (barH + gap);
      const filled = (d.total / maxVal) * barW;

      // Track
      ctx.fillStyle = isDark ? '#242424' : '#e0e0e0';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(padL, y, barW, barH, 4);
      else ctx.rect(padL, y, barW, barH);
      ctx.fill();

      // Fill
      if (filled > 2) {
        ctx.fillStyle = isDark ? '#f0f0f0' : '#0a0a0a';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(padL, y, filled, barH, 4);
        else ctx.rect(padL, y, filled, barH);
        ctx.fill();
      }

      // Label
      ctx.fillStyle = isDark ? '#aaa' : '#555';
      ctx.font = `500 13px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.cat, padL - 8, y + barH / 2);

      // Value
      const tx = padL + filled + 6;
      if (tx + 70 < W) {
        ctx.fillStyle = isDark ? '#f0f0f0' : '#0a0a0a';
        ctx.font = `600 12px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(formatCurrency(d.total), tx, y + barH / 2);
      } else {
        ctx.fillStyle = isDark ? '#aaa' : '#555';
        ctx.font = `600 12px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(formatCurrency(d.total), padL + filled - 4, y + barH / 2);
      }
    });
  }, [data]);

  return (
    <div className="chart-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
