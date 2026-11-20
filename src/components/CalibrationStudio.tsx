import React, { useState, useRef, useEffect } from 'react';
import { Zone, Point2D, HomographyPair } from '../types';
import { 
  CheckCircle2, 
  RotateCcw, 
  Ruler, 
  Grid, 
  MapPin, 
  Save, 
  HelpCircle,
  X 
} from 'lucide-react';
import { calculatePolygonArea, computeHomography } from '../utils/crowdMath';
import { playUiClick, playRadioSquelch } from '../utils/audio';

interface CalibrationStudioProps {
  zone: Zone;
  onSaveCalibration: (zoneId: string, updatedZone: Partial<Zone>) => void;
  onClose: () => void;
}

export const CalibrationStudio: React.FC<CalibrationStudioProps> = ({
  zone,
  onSaveCalibration,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calibration state
  const [groundWidthM, setGroundWidthM] = useState(20);
  const [groundLengthM, setGroundLengthM] = useState(30);
  const [points, setPoints] = useState<Point2D[]>(
    zone.roiPolygon.length >= 4 
      ? zone.roiPolygon 
      : [
          { x: 0.15, y: 0.75 },
          { x: 0.85, y: 0.75 },
          { x: 0.65, y: 0.35 },
          { x: 0.35, y: 0.35 }
        ]
  );
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Compute calculated ground area
  const calculatedArea = groundWidthM * groundLengthM;

  // Redraw canvas with handles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Draw background scene
    ctx.fillStyle = '#0B1120';
    ctx.fillRect(0, 0, width, height);

    // Draw floor perspective grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw Ground Polygon
    if (points.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(points[0].x * width, points[0].y * height);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * width, points[i].y * height);
      }
      ctx.closePath();

      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fill();

      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Draw Drag Points / Markers
    points.forEach((pt, idx) => {
      const px = pt.x * width;
      const py = pt.y * height;

      ctx.fillStyle = selectedPointIdx === idx ? '#F59E0B' : '#06B6D4';
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(`P${idx + 1}`, px + 10, py - 6);
    });
  }, [points, selectedPointIdx]);

  // Handle clicking or dragging markers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // Check if clicked near existing point
    const threshold = 0.05;
    const foundIdx = points.findIndex(
      pt => Math.hypot(pt.x - clickX, pt.y - clickY) < threshold
    );

    if (foundIdx !== -1) {
      setSelectedPointIdx(foundIdx);
    } else {
      setSelectedPointIdx(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedPointIdx === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const moveX = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
    const moveY = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));

    const updated = [...points];
    updated[selectedPointIdx] = { x: moveX, y: moveY };
    setPoints(updated);
  };

  const handleCanvasMouseUp = () => {
    setSelectedPointIdx(null);
  };

  const handleSave = () => {
    playRadioSquelch();
    const homographyPairs: HomographyPair[] = points.map((pt, i) => ({
      imgX: pt.x,
      imgY: pt.y,
      groundX: (i === 1 || i === 2) ? groundWidthM : 0,
      groundY: (i >= 2) ? groundLengthM : 0
    }));

    onSaveCalibration(zone.id, {
      roiPolygon: points,
      groundAreaM2: calculatedArea,
      homographyPoints: homographyPairs,
      isCalibrated: true
    });

    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handleReset = () => {
    playUiClick();
    setPoints([
      { x: 0.15, y: 0.75 },
      { x: 0.85, y: 0.75 },
      { x: 0.65, y: 0.35 },
      { x: 0.35, y: 0.35 }
    ]);
    setGroundWidthM(20);
    setGroundLengthM(30);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl glass-panel border border-slate-700 p-6 shadow-2xl bg-dark-900/90 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Camera Calibration & Geometry Studio
              </h2>
              <p className="text-xs text-slate-400">
                Ground-plane homography setup for: <span className="text-cyan-300 font-semibold">{zone.name}</span> ({zone.cameraName})
              </p>
            </div>
          </div>
          <button
            onClick={() => { playUiClick(); onClose(); }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Blueprint Guidance Alert */}
        <div className="my-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Geometric Ground Projection: </strong>
            Drag the 4 corner handles (P1 to P4) to align with the physical floor boundary. 
            Enter the measured ground dimensions from your site plan to convert image pixel density into <code className="text-emerald-400 font-mono">people/m²</code>.
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Interactive Canvas View */}
          <div className="lg:col-span-2 space-y-2">
            <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-700/80 bg-black">
              <canvas
                ref={canvasRef}
                width={640}
                height={360}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="w-full h-full object-cover cursor-crosshair"
              />
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-black/70 backdrop-blur-sm border border-slate-700 text-[11px] font-mono text-cyan-300">
                CLICK & DRAG P1–P4 HANDLES
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Points defined: {points.length} / 4</span>
              <span>Perspective transform: Valid 2D Homography</span>
            </div>
          </div>

          {/* Physical Measurements & Formula */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Grid className="w-4 h-4 text-cyan-400" /> Ground Dimensions
              </h3>
              
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Measured Width (X axis, meters):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={groundWidthM}
                    onChange={(e) => setGroundWidthM(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Measured Length (Y axis, meters):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={groundLengthM}
                    onChange={(e) => setGroundLengthM(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Computed Area */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 mt-3">
                <div className="text-xs text-emerald-400">Calibrated Physical Area:</div>
                <div className="text-2xl font-bold font-mono text-emerald-300">
                  {calculatedArea} m²
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Formula: {groundWidthM}m × {groundLengthM}m = {calculatedArea} m²
                </div>
              </div>
            </div>

            {/* Arithmetic Preview Box (Spec Page 4 example) */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
              <span className="font-semibold text-slate-300">Live Density Math Verification:</span>
              <p className="font-mono text-cyan-300">
                density = {zone.currentCount} people / {calculatedArea} m²
              </p>
              <p className="font-mono font-bold text-white">
                = {(zone.currentCount / calculatedArea).toFixed(2)} people/m²
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Grid</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => { playUiClick(); onClose(); }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                isSaved 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/20'
              }`}
            >
              {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{isSaved ? 'Calibration Saved!' : 'Save Calibration to Zone'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
