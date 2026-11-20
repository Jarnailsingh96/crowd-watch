import React, { useRef, useEffect } from 'react';
import { Zone } from '../types';
import { MapPin, Navigation, Compass, Layers, ShieldCheck, Flame, AlertTriangle } from 'lucide-react';

interface FestivalGodViewMapProps {
  zones: Zone[];
  onSelectZone?: (zoneId: string) => void;
}

export const FestivalGodViewMap: React.FC<FestivalGodViewMapProps> = ({
  zones,
  onSelectZone
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const northZone = zones.find(z => z.id === 'zone-north-gate') || zones[0];
  const foodZone = zones.find(z => z.id === 'zone-food-court') || zones[1];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const render = () => {
      offset += 0.8;
      const w = canvas.width;
      const h = canvas.height;

      // Dark tactical blueprint background
      ctx.fillStyle = '#060A12';
      ctx.fillRect(0, 0, w, h);

      // Subtle tactical grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Evacuation / Flow Pathways (Vector arrows)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -offset;

      // North Gate to Food Court path
      ctx.beginPath();
      ctx.moveTo(140, 100);
      ctx.bezierCurveTo(240, 100, 240, 140, 340, 140);
      ctx.stroke();

      // Food Court to Main Stage path
      ctx.beginPath();
      ctx.moveTo(420, 140);
      ctx.bezierCurveTo(490, 140, 500, 90, 560, 90);
      ctx.stroke();

      // Emergency Relief Diversion path
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(140, 120);
      ctx.bezierCurveTo(200, 190, 480, 190, 560, 120);
      ctx.stroke();

      ctx.setLineDash([]); // Reset line dash

      // Helper function to render a zone station
      const drawZoneStation = (
        x: number, 
        y: number, 
        radius: number, 
        zone: Zone | undefined, 
        label: string, 
        code: string
      ) => {
        if (!zone) return;
        const isRed = zone.status === 'RED';
        const isAmber = zone.status === 'AMBER';
        const isUnknown = zone.status === 'UNKNOWN';

        const strokeColor = isRed ? '#EF4444' : (isAmber ? '#F59E0B' : (isUnknown ? '#64748B' : '#10B981'));
        const fillColor = isRed ? 'rgba(239, 68, 68, 0.15)' : (isAmber ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.12)');

        // Pulsing radar glow
        const pulse = (Math.sin(offset * 0.08) + 1) * 0.5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius + (isRed ? pulse * 14 : pulse * 6), 0, Math.PI * 2);
        ctx.fillStyle = isRed ? 'rgba(239, 68, 68, 0.25)' : (isAmber ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)');
        ctx.fill();
        ctx.restore();

        // Zone base footprint
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Target reticle
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - radius - 6, y);
        ctx.lineTo(x + radius + 6, y);
        ctx.moveTo(x, y - radius - 6);
        ctx.lineTo(x, y + radius + 6);
        ctx.stroke();

        // Station labels
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(code, x, y - radius - 8);

        ctx.font = '10px "Inter", sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(label, x, y + radius + 14);

        // Occupancy tag
        ctx.fillStyle = isRed ? '#F87171' : (isAmber ? '#FCD34D' : '#6EE7B7');
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(`${zone.currentCount} / ${zone.limitCount} ppl`, x, y + 4);
      };

      // Draw Zone A: North Gate Turnstiles
      drawZoneStation(120, 105, 34, northZone, 'Primary Ingress', 'ZONE A: NORTH GATE');

      // Draw Zone B: Central Plaza & Food Court
      drawZoneStation(380, 140, 30, foodZone, 'Food Concessions', 'ZONE B: FOOD COURT');

      // Draw Relief Zone C: Main Stage Arena
      const mockMainStage: Zone = {
        ...foodZone,
        id: 'mock-main-stage',
        currentCount: 850,
        limitCount: 2000,
        status: 'GREEN'
      };
      drawZoneStation(620, 95, 42, mockMainStage, 'Stage Arena (Relief)', 'ZONE C: MAIN STAGE');

      // Map HUD Info
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(8, 8, 200, 24);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(8, 8, 200, 24);
      ctx.fillStyle = '#38BDF8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('FESTIVAL GOD-VIEW RADAR ● LIVE', 14, 24);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [zones]);

  return (
    <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden shadow-xl">
      <div className="p-3.5 bg-dark-900/70 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Festival Site 2D God-View Mini-Map
            </h3>
            <p className="text-[11px] text-slate-400">
              Live spatial crowd pressure, ingress corridors, and emergency diversion routing.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Safe
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Early Warning
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" /> Limit Breach
          </span>
        </div>
      </div>

      <div className="relative aspect-[21/9] sm:aspect-[24/8] w-full bg-dark-950">
        <canvas
          ref={canvasRef}
          width={740}
          height={220}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};
