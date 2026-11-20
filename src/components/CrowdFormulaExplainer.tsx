import React, { useState } from 'react';
import { 
  Calculator, 
  HelpCircle, 
  BookOpen, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  CheckCircle,
  FileText
} from 'lucide-react';
import { playUiClick } from '../utils/audio';

export const CrowdFormulaExplainer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Interactive formula sandbox state
  const [calcLimit, setCalcLimit] = useState(50);
  const [calcCurrent, setCalcCurrent] = useState(38);
  const [calcSlope, setCalcSlope] = useState(2.0);

  // Compute live sandbox formula
  const calcSurplus = calcCurrent >= calcLimit ? calcCurrent - calcLimit : 0;
  const calcSecondsToLimit = calcSlope > 0 && calcCurrent < calcLimit
    ? Math.max(0, Math.round((calcLimit - calcCurrent) / calcSlope))
    : (calcCurrent >= calcLimit ? 0 : null);

  const calcState = calcCurrent >= calcLimit 
    ? 'RED (Limit Breached)' 
    : (calcSecondsToLimit !== null && calcSecondsToLimit <= 60 
        ? 'AMBER (Early Warning)' 
        : 'GREEN (Safe)');

  return (
    <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden shadow-xl">
      <div 
        onClick={() => { playUiClick(); setIsOpen(!isOpen); }}
        className="p-4 bg-dark-900/80 hover:bg-dark-800/80 transition cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Crowd Safety Formulas & Limit Origin Breakdown
              </h3>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
                UK HSE Blueprint Compliant
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Why 600 was the initial default, exact mathematical formulas, and live interactive playground.
            </p>
          </div>
        </div>

        <button 
          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          aria-label="Toggle formulas"
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="p-5 border-t border-slate-800 space-y-6 bg-dark-950/60">
          {/* Section 1: Where did 600 come from? */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
              <BookOpen className="w-4 h-4" />
              <span>Where did the "600 Limit" come from?</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The number <strong>600</strong> came directly from <strong>Pages 4 and 5 of the PDF blueprint</strong> (<code className="text-cyan-300">Crownd_Mnagement_system_working_explain</code>):
            </p>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li><strong>Page 4, Line 217:</strong> <em>"Example: if a zone is 600 m² and the model estimates 420 people inside it, density is 420 / 600 = 0.70 people/m²."</em></li>
              <li><strong>Page 5, Line 270:</strong> <em>"Illustrative forecast: the event lead sets a hypothetical North Gate limit of 600 people... The warning should appear before the current count reaches 600."</em></li>
            </ul>
            <p className="text-xs text-emerald-400 font-semibold mt-2">
              ✓ In this updated version, you are <strong>100% free to edit the limit</strong> on every card (e.g. set it to 30 or 40 to match your test video)!
            </p>
          </div>

          {/* Section 2: The 3 Core Mathematical Formulas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Formula 1 */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">1. Ground Density</span>
              <div className="p-2 rounded bg-dark-950 font-mono text-xs text-white text-center border border-slate-800">
                Density = Headcount / Area (m²)
              </div>
              <p className="text-[11px] text-slate-400">
                Calibrated by 4-point homography so camera perspective distortion does not skew crowd pressure.
              </p>
            </div>

            {/* Formula 2 */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">2. Influx Trend Velocity</span>
              <div className="p-2 rounded bg-dark-950 font-mono text-xs text-white text-center border border-slate-800">
                Slope = ΔPeople / ΔSeconds
              </div>
              <p className="text-[11px] text-slate-400">
                Calculated over a sliding 30-60 second window via least-squares linear regression to filter random noise.
              </p>
            </div>

            {/* Formula 3 */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-mono text-purple-400 uppercase font-bold">3. Time-to-Limit Projection</span>
              <div className="p-2 rounded bg-dark-950 font-mono text-xs text-white text-center border border-slate-800">
                Time = (Limit - Count) / Slope
              </div>
              <p className="text-[11px] text-slate-400">
                If Time ≤ 60 seconds, raises predictive <strong>Amber Early Warning</strong> before bottleneck crush occurs.
              </p>
            </div>
          </div>

          {/* Section 3: Interactive Live Formula Sandbox */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono font-bold uppercase tracking-wider">
                <Sliders className="w-4 h-4" />
                <span>Interactive Live Formula Sandbox</span>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                calcState.startsWith('RED') 
                  ? 'bg-red-500/20 text-red-300 border-red-500/40' 
                  : (calcState.startsWith('AMBER') ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40')
              }`}>
                State: {calcState}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              {/* Slider 1: Approved Limit */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Capacity Limit:</span>
                  <strong className="text-white">{calcLimit}</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="5"
                  value={calcLimit}
                  onChange={(e) => setCalcLimit(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Slider 2: Current Count */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Live Headcount:</span>
                  <strong className="text-white">{calcCurrent}</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="1"
                  value={calcCurrent}
                  onChange={(e) => setCalcCurrent(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              {/* Slider 3: Arrival Velocity */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Arrival Slope:</span>
                  <strong className="text-white">+{calcSlope.toFixed(1)}/s</strong>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="10.0"
                  step="0.2"
                  value={calcSlope}
                  onChange={(e) => setCalcSlope(Number(e.target.value))}
                  className="w-full accent-purple-400"
                />
              </div>
            </div>

            {/* Sandbox Result Output */}
            <div className="p-3 rounded-lg bg-dark-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-slate-400">
                Calculation: ({calcLimit} limit - {calcCurrent} count) / +{calcSlope.toFixed(1)}/s =
              </span>
              <span className="text-sm font-bold text-white">
                {calcCurrent >= calcLimit 
                  ? <span className="text-red-400">🚨 BREACHED (+{calcSurplus} OVER)</span>
                  : <span className="text-amber-300">⏱️ {calcSecondsToLimit} seconds until breach</span>
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
