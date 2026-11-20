import React, { useState, useEffect } from 'react';
import { AlertEvent, Zone } from '../types';
import { 
  AlertTriangle, 
  Flame, 
  Radio, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  UserCheck, 
  ArrowRight, 
  Send,
  Megaphone,
  Volume2,
  DoorOpen,
  ShieldCheck,
  MapPin
} from 'lucide-react';
import { playRadioSquelch, playCriticalAlarm, playEarlyWarningTone, playUiClick } from '../utils/audio';

interface ActiveAlertPanelProps {
  alerts: AlertEvent[];
  zones: Zone[];
  onAcknowledgeAlert: (alertId: string, notes: string, action: AlertEvent['actionTaken']) => void;
}

export const ActiveAlertPanel: React.FC<ActiveAlertPanelProps> = ({
  alerts,
  zones,
  onAcknowledgeAlert
}) => {
  const [notes, setNotes] = useState('');
  const [actionChoice, setActionChoice] = useState<AlertEvent['actionTaken']>('SUPERVISOR_NOTIFIED');

  const unacknowledged = alerts.filter(a => !a.acknowledged);
  const activeAlert = unacknowledged[0] || null;

  const isRed = activeAlert?.status === 'RED';
  const matchingZone = activeAlert ? zones.find(z => z.id === activeAlert.zoneId) : null;
  const limitCount = matchingZone?.limitCount || 600;
  const surplusPeople = activeAlert ? Math.max(0, activeAlert.count - limitCount) : 0;

  // Trigger audio siren on critical limit breach
  useEffect(() => {
    if (activeAlert) {
      if (activeAlert.status === 'RED') {
        playCriticalAlarm();
      } else if (activeAlert.status === 'AMBER' && activeAlert.projectedSeconds !== null) {
        playEarlyWarningTone();
      }
    }
  }, [activeAlert?.id, activeAlert?.status]);

  if (!activeAlert) {
    return (
      <div className="p-4 rounded-2xl glass-panel-green border border-emerald-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-emerald-300">All Crowd Zones Nominal</h4>
            <p className="text-xs text-slate-400">Continuous 5 FPS inference active. No time-to-limit warnings triggered.</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800/50">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          RADAR CLEAR
        </div>
      </div>
    );
  }

  const handleAcknowledge = () => {
    playRadioSquelch();
    onAcknowledgeAlert(
      activeAlert.id, 
      notes || `Verified visually. Action: ${actionChoice}`, 
      actionChoice
    );
    setNotes('');
  };

  const handleTriggerAlarm = () => {
    playUiClick();
    if (isRed) {
      playCriticalAlarm();
    } else {
      playEarlyWarningTone();
    }
  };

  return (
    <div className={`p-5 rounded-2xl border transition-all duration-300 ${
      isRed ? 'glass-panel-red border-red-500/80 shadow-2xl shadow-red-950/50 animate-glow-red' : 'glass-panel-amber border-amber-500/70 animate-glow-amber'
    }`}>
      {/* Top Alert Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
        <div className="flex items-start gap-3.5">
          <div className={`p-3.5 rounded-2xl ${isRed ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' : 'bg-amber-500/20 text-amber-400'} animate-bounce`}>
            {isRed ? <Flame className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded ${
                isRed ? 'bg-red-600 text-white' : 'bg-amber-500/30 text-amber-300'
              }`}>
                {isRed ? '🚨 CRITICAL: LIMIT BREACHED' : '⚠️ PREDICTIVE EARLY WARNING'}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {new Date(activeAlert.timestamp).toLocaleTimeString()}
              </span>
              {isRed && surplusPeople > 0 && (
                <span className="text-xs font-mono bg-red-950 text-red-300 px-2 py-0.5 rounded border border-red-700 font-bold">
                  SURPLUS: +{surplusPeople} OVER CAPACITY
                </span>
              )}
            </div>

            <h3 className="text-xl font-black text-white mt-1 tracking-tight">
              {isRed 
                ? `CRITICAL OCCUPANCY BREACH at ${activeAlert.zoneName}!`
                : `INFLUX ACCUMULATION WARNING: ${activeAlert.zoneName}`
              }
            </h3>

            <p className="text-xs text-slate-200 mt-1">
              Live Headcount: <strong className="text-white font-mono text-sm">{activeAlert.count}</strong> / Approved Limit: <strong className="text-amber-400 font-mono text-sm">{limitCount}</strong> | 
              Density: <strong className="text-cyan-300 font-mono">{activeAlert.density} ppl/m²</strong> | 
              Trend Slope: <strong className="text-amber-300 font-mono">+{activeAlert.trendSlope} /sec</strong>
            </p>
          </div>
        </div>

        {/* Right Side Buttons: Countdown or Voice Dispatch Trigger */}
        <div className="flex items-center gap-2.5">
          {activeAlert.projectedSeconds !== null && !isRed && (
            <div className="flex items-center gap-3 bg-dark-950/80 px-4 py-2.5 rounded-xl border border-slate-700/80">
              <Clock className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Projected Breach In</div>
                <div className="text-lg font-bold font-mono text-amber-300">
                  ~{activeAlert.projectedSeconds} seconds
                </div>
              </div>
            </div>
          )}

          {/* Test Alarm Siren Button */}
          <button
            onClick={handleTriggerAlarm}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition"
            title="Test tactical emergency alarm siren"
          >
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Alarm Siren</span>
          </button>
        </div>
      </div>

      {/* Emergency Assets & Chokepoint Stampede Diversion Bar */}
      <div className="py-2.5 px-3.5 my-3 rounded-xl bg-dark-950/80 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[10px] uppercase font-bold text-slate-400">Tactical Life-Safety:</span>
          <span className="flex items-center gap-1.5 text-red-300">
            <Flame className="w-3.5 h-3.5 text-red-400" />
            Extinguisher: <strong>{activeAlert.zoneId === 'zone-north-gate' ? '18m (Pillar 4B)' : '14m (North Kiosk)'}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-sky-300">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            Security: <strong>{activeAlert.zoneId === 'zone-north-gate' ? '22m (Station Alpha - 4 Stewards)' : '28m (Station Bravo - 6 Stewards)'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-800/60">
          <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Stampede Diversion: <strong>{activeAlert.zoneId === 'zone-north-gate' ? 'Gate E-3 -> East Lawn (34m)' : 'Gate W-2 -> Ring Road (45m)'}</strong></span>
        </div>
      </div>

      {/* Operator SOP Checklist & Action Stations */}
      <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Recommended SOP Action Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" /> Operational Action SOP:
          </label>
          <select
            value={actionChoice}
            onChange={(e) => setActionChoice(e.target.value as AlertEvent['actionTaken'])}
            className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-cyan-500"
          >
            <option value="SUPERVISOR_NOTIFIED">1. Radio Zone Supervisor (Standard)</option>
            <option value="STEWARDS_DISPATCHED">2. Dispatch Stewards to Choke Point</option>
            <option value="GATE_HELD">3. Temporarily Hold Queue / Slow Influx</option>
            <option value="FLOW_DIVERTED">4. Divert Footfall to Secondary Plaza</option>
          </select>
        </div>

        {/* Operator Verification Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Operator Observation Notes:
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Visual confirmation of bottleneck at turnstile gate"
            className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
          />
        </div>

        {/* Acknowledge Button */}
        <div className="flex items-end">
          <button
            onClick={handleAcknowledge}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg ${
              isRed
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-900/40'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-amber-900/40'
            }`}
          >
            <Radio className="w-4 h-4 animate-bounce" />
            <span>Acknowledge & Radio Response</span>
          </button>
        </div>
      </div>
    </div>
  );
};
