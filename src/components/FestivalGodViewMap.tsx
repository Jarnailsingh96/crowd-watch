import React, { useRef, useEffect, useState } from 'react';
import { Zone } from '../types';
import { 
  Compass, 
  Flame, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowUpRight, 
  MapPin, 
  DoorOpen, 
  Cross, 
  Radio,
  Layers,
  Sparkles
} from 'lucide-react';

interface FestivalGodViewMapProps {
  zones: Zone[];
  onSelectZone?: (zoneId: string) => void;
}

export const FestivalGodViewMap: React.FC<FestivalGodViewMapProps> = ({
  zones,
  onSelectZone
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeLayer, setActiveLayer] = useState<'ALL' | 'CHOKEPOINTS' | 'EMERGENCY_ASSETS'>('ALL');
  const [selectedPin, setSelectedPin] = useState<string | null>(null);

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
      offset += 0.7;
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

      // 1. Primary Ingress / Normal Flow Pathways (Dashed cyan)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -offset;

      // North Gate to Food Court path
      ctx.beginPath();
      ctx.moveTo(130, 95);
      ctx.bezierCurveTo(230, 95, 230, 135, 330, 135);
      ctx.stroke();

      // Food Court to Main Stage path
      ctx.beginPath();
      ctx.moveTo(410, 135);
      ctx.bezierCurveTo(480, 135, 490, 85, 550, 85);
      ctx.stroke();

      // 2. STAMPEDE RELIEF DIVERSION CORRIDORS (Animated Amber / Neon Orange)
      if (activeLayer === 'ALL' || activeLayer === 'CHOKEPOINTS') {
        // Relief Route Alpha: North Gate Ingress -> East Lawn Overflow Meadow
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -offset * 1.5;
        ctx.beginPath();
        ctx.moveTo(130, 115);
        ctx.bezierCurveTo(170, 175, 260, 185, 320, 185);
        ctx.stroke();

        // Arrow head towards East Lawn
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(320, 185, 4, 0, Math.PI * 2);
        ctx.fill();

        // Relief Route Bravo: Food Court Chokepoint -> West Perimeter Ring Road
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
        ctx.beginPath();
        ctx.moveTo(370, 155);
        ctx.bezierCurveTo(420, 195, 520, 195, 600, 150);
        ctx.stroke();

        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(600, 150, 4, 0, Math.PI * 2);
        ctx.fill();
      }

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
        const fillColor = isRed ? 'rgba(239, 68, 68, 0.18)' : (isAmber ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.12)');

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
        ctx.moveTo(x - radius - 5, y);
        ctx.lineTo(x + radius + 5, y);
        ctx.moveTo(x, y - radius - 5);
        ctx.lineTo(x, y + radius + 5);
        ctx.stroke();

        // Station labels
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(code, x, y - radius - 7);

        ctx.font = '9px "Inter", sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(label, x, y + radius + 12);

        // Occupancy tag
        ctx.fillStyle = isRed ? '#F87171' : (isAmber ? '#FCD34D' : '#6EE7B7');
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(`${zone.currentCount} / ${zone.limitCount} ppl`, x, y + 4);
      };

      // Draw Zone A: North Gate Turnstiles
      drawZoneStation(115, 95, 32, northZone, 'Primary Ingress', 'ZONE A: NORTH GATE');

      // Draw Zone B: Central Plaza & Food Court
      drawZoneStation(370, 135, 28, foodZone, 'Food Concessions', 'ZONE B: FOOD COURT');

      // Draw Relief Zone C: Main Stage Arena
      const mockMainStage: Zone = {
        ...foodZone,
        id: 'mock-main-stage',
        currentCount: 850,
        limitCount: 2000,
        status: 'GREEN'
      };
      drawZoneStation(610, 85, 40, mockMainStage, 'Stage Arena (Relief)', 'ZONE C: MAIN STAGE');

      // 3. RENDER CRITICAL CHOKEPOINTS & RELIEF RESERVES
      if (activeLayer === 'ALL' || activeLayer === 'CHOKEPOINTS') {
        // Chokepoint 1 Marker (Near North Gate)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.fillRect(165, 82, 36, 26);
        ctx.strokeRect(165, 82, 36, 26);
        ctx.fillStyle = '#FCA5A5';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CHOKE-1', 183, 93);
        ctx.fillText('3.2m Neck', 183, 103);

        // Stampede Relief Meadow Zone
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.5;
        ctx.fillRect(290, 170, 110, 36);
        ctx.strokeRect(290, 170, 110, 36);
        ctx.fillStyle = '#6EE7B7';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillText('STAMPEDE RELIEF LAWN', 345, 184);
        ctx.fillStyle = '#A7F3D0';
        ctx.font = '7px "Inter", sans-serif';
        ctx.fillText('Cap: 3,500 ppl (Open Meadow)', 345, 196);

        // Chokepoint 2 Marker (Between Plaza & Concession)
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.fillRect(425, 122, 38, 26);
        ctx.strokeRect(425, 122, 38, 26);
        ctx.fillStyle = '#FDE68A';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillText('CHOKE-2', 444, 133);
        ctx.fillText('2.8m Funnel', 444, 143);
      }

      // 4. RENDER EMERGENCY ASSETS (Fire Extinguishers & Security Checkpoints with Distances)
      if (activeLayer === 'ALL' || activeLayer === 'EMERGENCY_ASSETS') {
        // Fire Extinguisher 1 (Zone A - 18m)
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(85, 60, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#FCA5A5';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('🧯 FE-01: 18m', 95, 63);

        // Security Checkpoint Alpha (Zone A - 22m)
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(115, 145, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#BAE6FD';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillText('🛡️ SEC-Alpha: 22m', 125, 148);

        // Emergency Relief Gate E-3 (Zone A - 34m)
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(160, 160, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#FCD34D';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillText('🚪 GATE-E3: 34m (Relief)', 170, 163);

        // Fire Extinguisher 2 (Zone B - 14m)
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(340, 95, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#FCA5A5';
        ctx.fillText('🧯 FE-02: 14m', 350, 98);

        // Security Checkpoint Bravo (Zone B - 28m)
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(430, 90, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#BAE6FD';
        ctx.fillText('🛡️ SEC-Bravo: 28m', 440, 93);
      }

      // Map HUD Tactical Header
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(8, 8, 250, 22);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(8, 8, 250, 22);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('FESTIVAL RADAR ● SPATIAL EVAC & CHOKEPOINT', 14, 22);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [zones, activeLayer]);

  return (
    <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden shadow-xl">
      {/* Top Header with Layer Filter Buttons */}
      <div className="p-3.5 bg-dark-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              Festival Site 2D God-View Map
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Evac & Chokepoint Active
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Real-time stampede diversion routing, chokepoint management, and distances to emergency assets.
            </p>
          </div>
        </div>

        {/* Tactical Layer Filter Switches */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveLayer('ALL')}
            className={`px-2.5 py-1 rounded-lg transition ${
              activeLayer === 'ALL' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Overlays
          </button>
          <button
            onClick={() => setActiveLayer('CHOKEPOINTS')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
              activeLayer === 'CHOKEPOINTS' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DoorOpen className="w-3 h-3" />
            Chokepoints & Relief
          </button>
          <button
            onClick={() => setActiveLayer('EMERGENCY_ASSETS')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
              activeLayer === 'EMERGENCY_ASSETS' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            Fire & Security
          </button>
        </div>
      </div>

      {/* Canvas Radar Map */}
      <div className="relative aspect-[21/9] sm:aspect-[24/8] w-full bg-dark-950">
        <canvas
          ref={canvasRef}
          width={740}
          height={220}
          className="w-full h-full object-cover"
        />
      </div>

      {/* TACTICAL EVACUATION & CHOKEPOINT DISPATCH MATRIX */}
      <div className="p-3.5 bg-dark-900/90 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Zone A Tactical Breakdown */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sky-400 font-mono flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              Zone A: North Gate Turnstiles
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Bottleneck Chokepoint: 3.2m
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">🧯 Nearest Extinguisher</span>
              <strong className="text-red-400">18 metres</strong>
              <p className="text-[9px] text-slate-400">Pillar 4B (Class ABC)</p>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">🛡️ Security Checkpoint</span>
              <strong className="text-sky-300">22 metres</strong>
              <p className="text-[9px] text-slate-400">Station Alpha (4 Stewards)</p>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/50 text-[11px]">
            <span className="text-amber-300 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
              Stampede Relief Diversion Path:
            </span>
            <p className="text-slate-300 mt-0.5 text-[10px]">
              If turnstile chokepoint congests, open <strong>Corridor E-3 (34m away)</strong> to move crowd directly into <strong>East Lawn Meadow (Cap: 3,500 ppl)</strong>.
            </p>
          </div>
        </div>

        {/* Zone B Tactical Breakdown */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 font-mono flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              Zone B: Central Plaza & Food Court
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Concession Neck: 2.8m
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">🧯 Nearest Extinguisher</span>
              <strong className="text-red-400">14 metres</strong>
              <p className="text-[9px] text-slate-400">North Kiosk (CO2 & Foam)</p>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">🛡️ Security Checkpoint</span>
              <strong className="text-sky-300">28 metres</strong>
              <p className="text-[9px] text-slate-400">Station Bravo (6 Stewards)</p>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-[11px]">
            <span className="text-emerald-300 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              Stampede Relief Diversion Path:
            </span>
            <p className="text-slate-300 mt-0.5 text-[10px]">
              If plaza congests, activate <strong>Perimeter Relief Gate W-2 (45m away)</strong> to evacuate crowd toward <strong>West Perimeter Ring Road (Cap: 5,000 ppl)</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};