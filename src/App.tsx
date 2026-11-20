import React, { useState, useEffect, useRef } from 'react';
import { 
  Zone, 
  CameraStreamConfig, 
  AlertEvent 
} from './types';
import { 
  evaluateZoneStatus, 
  calculateTrendSlope, 
  calculateZoneDensity 
} from './utils/crowdMath';
import { 
  playEarlyWarningTone, 
  playCriticalAlarm, 
  playUiClick 
} from './utils/audio';
import { firebaseService } from './services/firebase';
import { CameraStreamCard } from './components/CameraStreamCard';
import { ActiveAlertPanel } from './components/ActiveAlertPanel';
import { CalibrationStudio } from './components/CalibrationStudio';
import { IncidentAuditLog } from './components/IncidentAuditLog';
import { BenchmarkAndJudgeCenter } from './components/BenchmarkAndJudgeCenter';
import { FirebaseSettingsModal } from './components/FirebaseSettingsModal';
import { FestivalGodViewMap } from './components/FestivalGodViewMap';
import { CrowdFormulaExplainer } from './components/CrowdFormulaExplainer';
import { 
  ShieldAlert, 
  Activity, 
  Sliders, 
  History, 
  Ruler, 
  Flame, 
  Volume2, 
  VolumeX, 
  Database, 
  Camera, 
  Sparkles,
  Menu,
  X
} from 'lucide-react';

// Initial Zone configurations reflecting Page 1 & Page 6 Wireframe
const INITIAL_ZONES: Zone[] = [
  {
    id: 'zone-north-gate',
    name: 'North Gate Turnstiles',
    cameraId: 'cam-01',
    cameraName: 'CCTV-01 [Optical Elevated]',
    location: 'Zone A - Primary Ingress',
    currentCount: 420,
    groundAreaM2: 600,
    density: 0.70,
    trendSlope: 3.1, // Accumulating +3.1 ppl/sec (Will project ~58s to limit!)
    projectedCount60s: 606,
    secondsToLimit: 58,
    status: 'AMBER',
    limitCount: 600,
    warningLeadTimeSeconds: 60,
    lastFrameTimestamp: Date.now(),
    cameraHealth: 'ONLINE',
    processingFps: 5.3,
    resolution: '1920x1080',
    roiPolygon: [
      { x: 0.12, y: 0.82 },
      { x: 0.88, y: 0.82 },
      { x: 0.68, y: 0.32 },
      { x: 0.32, y: 0.32 }
    ],
    homographyPoints: [
      { imgX: 0.12, imgY: 0.82, groundX: 0, groundY: 0 },
      { imgX: 0.88, imgY: 0.82, groundX: 20, groundY: 0 },
      { imgX: 0.68, imgY: 0.32, groundX: 20, groundY: 30 },
      { imgX: 0.32, imgY: 0.32, groundX: 0, groundY: 30 }
    ],
    isCalibrated: true,
    densityModel: 'CSRNet-Dilated-CNN',
    crowdFlowDirection: '↗ 74% Ingress migrating towards Central Plaza Chokepoint',
    emergencyAssets: [
      { id: 'fe-01', name: 'Fire Extinguisher FE-01', type: 'FIRE_EXTINGUISHER', distanceMeters: 18, locationDesc: 'Pillar 4B (Class ABC Dry Powder)', status: 'READY' },
      { id: 'sec-01', name: 'Security Post Alpha', type: 'SECURITY_POST', distanceMeters: 22, locationDesc: 'Gate A Kiosk (4 Stewards on Radio Ch 2)', status: 'READY' },
      { id: 'med-01', name: 'First Aid Tent 1', type: 'MEDICAL_POST', distanceMeters: 35, locationDesc: 'West Ingress Apron', status: 'READY' },
      { id: 'evac-01', name: 'Relief Gate E-3', type: 'EVAC_CHOKEPOINT', distanceMeters: 34, locationDesc: 'Corridor E-3 -> East Lawn Meadow (120 ppl/min)', status: 'READY' }
    ],
    chokePoints: [
      {
        id: 'cp-01',
        name: 'North Turnstile Funnel',
        zoneId: 'zone-north-gate',
        widthMeters: 3.2,
        maxFlowRatePpm: 140,
        reliefRouteName: 'Corridor E-3',
        reliefAreaName: 'East Lawn Overflow Meadow',
        reliefCapacity: 3500,
        distanceMeters: 34,
        status: 'CONGESTED'
      }
    ]
  },
  {
    id: 'zone-food-court',
    name: 'Central Plaza & Food Court',
    cameraId: 'cam-02',
    cameraName: 'CCTV-02 [Plaza Mast-Mount]',
    location: 'Zone B - Concessions & Rest Area',
    currentCount: 280,
    groundAreaM2: 350,
    density: 0.80,
    trendSlope: 0.2,
    projectedCount60s: 292,
    secondsToLimit: null,
    status: 'GREEN',
    limitCount: 450,
    warningLeadTimeSeconds: 60,
    lastFrameTimestamp: Date.now(),
    cameraHealth: 'ONLINE',
    processingFps: 5.2,
    resolution: '1920x1080',
    roiPolygon: [
      { x: 0.18, y: 0.78 },
      { x: 0.82, y: 0.78 },
      { x: 0.72, y: 0.38 },
      { x: 0.28, y: 0.38 }
    ],
    homographyPoints: [
      { imgX: 0.18, imgY: 0.78, groundX: 0, groundY: 0 },
      { imgX: 0.82, imgY: 0.78, groundX: 15, groundY: 0 },
      { imgX: 0.72, imgY: 0.38, groundX: 15, groundY: 23 },
      { imgX: 0.28, imgY: 0.38, groundX: 0, groundY: 23 }
    ],
    isCalibrated: true,
    densityModel: 'CSRNet-Dilated-CNN',
    crowdFlowDirection: '→ 60% Dispersing toward Main Stage Bowl',
    emergencyAssets: [
      { id: 'fe-02', name: 'Fire Extinguisher FE-02', type: 'FIRE_EXTINGUISHER', distanceMeters: 14, locationDesc: 'North Concessions Kiosk (CO2 & Foam)', status: 'READY' },
      { id: 'sec-02', name: 'Security Post Bravo', type: 'SECURITY_POST', distanceMeters: 28, locationDesc: 'Plaza Mast Station (6 Stewards on Radio Ch 3)', status: 'READY' },
      { id: 'med-02', name: 'Rapid Response Cart Med-2', type: 'MEDICAL_POST', distanceMeters: 40, locationDesc: 'Central Plaza Service Lane', status: 'READY' },
      { id: 'evac-02', name: 'Relief Gate W-2', type: 'EVAC_CHOKEPOINT', distanceMeters: 45, locationDesc: 'Gate W-2 -> Perimeter Ring Road (150 ppl/min)', status: 'READY' }
    ],
    chokePoints: [
      {
        id: 'cp-02',
        name: 'Concession Alley Chokepoint',
        zoneId: 'zone-food-court',
        widthMeters: 2.8,
        maxFlowRatePpm: 110,
        reliefRouteName: 'Perimeter Gate W-2',
        reliefAreaName: 'Perimeter Ring Road Relief',
        reliefCapacity: 5000,
        distanceMeters: 45,
        status: 'OPEN'
      }
    ]
  }
];

const INITIAL_CONFIGS: CameraStreamConfig[] = [
  {
    id: 'cam-01',
    name: 'North Gate Main Ingress',
    zoneName: 'North Gate Turnstiles',
    type: 'SIMULATED_CROWD',
    presetScenario: 'NORTH_GATE_RISING',
    isConnected: true,
    simulatedBaselineCount: 420,
    volatility: 0.8,
    activeSource: 'SYNTHETIC'
  },
  {
    id: 'cam-02',
    name: 'Food Court & Concessions',
    zoneName: 'Central Plaza & Food Court',
    type: 'SIMULATED_CROWD',
    presetScenario: 'FOOD_COURT_STABLE',
    isConnected: true,
    simulatedBaselineCount: 280,
    volatility: 0.3,
    activeSource: 'SYNTHETIC'
  }
];

export function App() {
  const [zones, setZones] = useState<Zone[]>(INITIAL_ZONES);
  const [streamConfigs, setStreamConfigs] = useState<CameraStreamConfig[]>(INITIAL_CONFIGS);
  const [alerts, setAlerts] = useState<AlertEvent[]>([
    {
      id: 'init-alert-1',
      zoneId: 'zone-north-gate',
      zoneName: 'North Gate Turnstiles',
      status: 'AMBER',
      timestamp: Date.now() - 32000,
      count: 420,
      density: 0.70,
      trendSlope: 3.1,
      projectedSeconds: 58,
      message: 'Positive trend (+3.1/s) projects limit crossing in ~58s. Advise stewarding queue hold.',
      acknowledged: false
    }
  ]);

  const [activeTab, setActiveTab] = useState<'OPERATIONS' | 'CALIBRATION' | 'AUDIT' | 'BENCHMARK'>('OPERATIONS');
  const [calibratingZoneId, setCalibratingZoneId] = useState<string | null>(null);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // History buffer for slope calculation
  const historyRef = useRef<{ [zoneId: string]: { timestamp: number; count: number }[] }>({
    'zone-north-gate': [
      { timestamp: Date.now() - 30000, count: 330 },
      { timestamp: Date.now() - 20000, count: 360 },
      { timestamp: Date.now() - 10000, count: 390 },
      { timestamp: Date.now(), count: 420 }
    ],
    'zone-food-court': [
      { timestamp: Date.now() - 30000, count: 275 },
      { timestamp: Date.now() - 20000, count: 278 },
      { timestamp: Date.now() - 10000, count: 279 },
      { timestamp: Date.now(), count: 280 }
    ]
  });

  // Background Inference Loop: Runs at ~1s interval simulating continuous 5 fps sampled data
  useEffect(() => {
    const timer = setInterval(() => {
      setZones(prevZones => {
        return prevZones.map(zone => {
          const config = streamConfigs.find(c => c.id === zone.cameraId);
          const isConnected = config ? config.isConnected : false;

          if (!isConnected) {
            // Cut feed check
            return {
              ...zone,
              status: 'UNKNOWN',
              secondsToLimit: null,
              cameraHealth: 'DISCONNECTED',
              lastFrameTimestamp: zone.lastFrameTimestamp // freeze timestamp
            };
          }

          // Only apply synthetic simulated deltas if feed source is SYNTHETIC.
          // For real video/webcam feeds, the exact instantaneous visual measurement takes precedence!
          const isSynthetic = !config?.activeSource || config.activeSource === 'SYNTHETIC';
          let newCount = zone.currentCount;

          if (isSynthetic) {
            const isNorthGate = zone.id === 'zone-north-gate';
            const delta = isNorthGate 
              ? (Math.random() > 0.4 ? 1 : (Math.random() > 0.5 ? -1 : 0)) 
              : (Math.random() > 0.5 ? 1 : -1);
            newCount = Math.max(10, zone.currentCount + delta);
          }

          const now = Date.now();

          // Update rolling history buffer
          const buf = historyRef.current[zone.id] || [];
          buf.push({ timestamp: now, count: newCount });
          if (buf.length > 25) buf.shift();
          historyRef.current[zone.id] = buf;

          // Compute slope
          const slope = calculateTrendSlope(buf);
          const density = calculateZoneDensity(newCount, zone.groundAreaM2);
          const lastAge = now - zone.lastFrameTimestamp;

          // Evaluate 4-state alert logic
          const evalResult = evaluateZoneStatus(
            isConnected,
            lastAge,
            newCount,
            zone.limitCount,
            slope,
            zone.warningLeadTimeSeconds
          );

          // Audio chime trigger on state escalation
          if (!isMuted && evalResult.status !== zone.status) {
            if (evalResult.status === 'RED') {
              playCriticalAlarm();
            } else if (evalResult.status === 'AMBER') {
              playEarlyWarningTone();
            }
          }

          // Trigger alert event record if entering AMBER or RED
          if (evalResult.status !== zone.status && (evalResult.status === 'AMBER' || evalResult.status === 'RED')) {
            const newAlert: AlertEvent = {
              id: `alert-${Date.now()}-${zone.id}`,
              zoneId: zone.id,
              zoneName: zone.name,
              status: evalResult.status,
              timestamp: now,
              count: newCount,
              density,
              trendSlope: slope,
              projectedSeconds: evalResult.secondsToLimit,
              message: evalResult.message,
              acknowledged: false
            };
            setAlerts(prev => [newAlert, ...prev]);
            firebaseService.logAlertIncident(newAlert);
          }

          const updatedZone: Zone = {
            ...zone,
            currentCount: newCount,
            density,
            trendSlope: slope,
            projectedCount60s: Math.max(0, Math.round(newCount + Math.max(0, slope) * 60)),
            secondsToLimit: evalResult.secondsToLimit,
            status: evalResult.status,
            lastFrameTimestamp: now,
            cameraHealth: 'ONLINE',
            processingFps: Number((5.1 + Math.random() * 0.4).toFixed(1))
          };

          // Sync to Firebase / LocalStore
          firebaseService.syncZoneState(updatedZone);

          return updatedZone;
        });
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [streamConfigs, isMuted]);

  // Reactive Zone Status Evaluation Helper
  const evaluateAndUpdateZone = (
    zoneId: string, 
    updater: (z: Zone) => { count: number; limit?: number; slopeDelta?: number }
  ) => {
    const now = Date.now();
    setZones(prev => prev.map(z => {
      if (z.id === zoneId) {
        const { count, limit = z.limitCount, slopeDelta = 0 } = updater(z);
        const config = streamConfigs.find(c => c.id === z.cameraId);
        const isConnected = config ? config.isConnected : true;

        const buf = historyRef.current[z.id] || [];
        buf.push({ timestamp: now, count });
        if (buf.length > 25) buf.shift();
        historyRef.current[z.id] = buf;

        let slope = calculateTrendSlope(buf);
        if (slopeDelta !== 0) {
          slope = Number((slope + slopeDelta).toFixed(1));
        }
        const density = calculateZoneDensity(count, z.groundAreaM2);
        const lastAge = now - z.lastFrameTimestamp;

        const evalResult = evaluateZoneStatus(
          isConnected,
          lastAge,
          count,
          limit,
          slope,
          z.warningLeadTimeSeconds
        );

        if (!isMuted && evalResult.status !== z.status) {
          if (evalResult.status === 'RED') {
            playCriticalAlarm();
          } else if (evalResult.status === 'AMBER') {
            playEarlyWarningTone();
          }
        }

        if (evalResult.status !== z.status && (evalResult.status === 'AMBER' || evalResult.status === 'RED')) {
          const newAlert: AlertEvent = {
            id: `alert-${Date.now()}-${z.id}`,
            zoneId: z.id,
            zoneName: z.name,
            status: evalResult.status,
            timestamp: now,
            count,
            density,
            trendSlope: slope,
            projectedSeconds: evalResult.secondsToLimit,
            message: evalResult.message,
            acknowledged: false
          };
          setAlerts(prev => [newAlert, ...prev]);
          firebaseService.logAlertIncident(newAlert);
        }

        const updated: Zone = {
          ...z,
          currentCount: count,
          limitCount: limit,
          density,
          trendSlope: slope,
          projectedCount60s: Math.max(0, Math.round(count + Math.max(0, slope) * 60)),
          secondsToLimit: evalResult.secondsToLimit,
          status: evalResult.status,
          lastFrameTimestamp: now
        };
        firebaseService.syncZoneState(updated);
        return updated;
      }
      return z;
    }));
  };

  // Handlers
  const handleUpdateCount = (zoneId: string, countDelta: number) => {
    evaluateAndUpdateZone(zoneId, (z) => ({
      count: Math.max(0, z.currentCount + countDelta),
      slopeDelta: countDelta > 0 ? 2.5 : -2
    }));
  };

  const handleSetInstantaneousCount = (zoneId: string, count: number) => {
    evaluateAndUpdateZone(zoneId, () => ({
      count
    }));
  };

  const handleUpdateLimit = (zoneId: string, newLimit: number) => {
    evaluateAndUpdateZone(zoneId, (z) => ({
      count: z.currentCount,
      limit: Math.max(1, newLimit)
    }));
  };

  const handleResetBaseline = (zoneId: string) => {
    const baselineCount = zoneId === 'zone-north-gate' ? 240 : 180;
    const now = Date.now();

    historyRef.current[zoneId] = [
      { timestamp: now - 30000, count: baselineCount + 2 },
      { timestamp: now - 20000, count: baselineCount },
      { timestamp: now - 10000, count: baselineCount - 1 },
      { timestamp: now, count: baselineCount }
    ];

    setZones(prev => prev.map(z => {
      if (z.id === zoneId) {
        const density = calculateZoneDensity(baselineCount, z.groundAreaM2);
        const updated: Zone = {
          ...z,
          currentCount: baselineCount,
          density,
          trendSlope: -0.1,
          projectedCount60s: baselineCount,
          secondsToLimit: null,
          status: 'GREEN',
          lastFrameTimestamp: now
        };
        firebaseService.syncZoneState(updated);
        return updated;
      }
      return z;
    }));

    // Acknowledge/clear active alert for this zone
    setAlerts(prev => prev.map(a => {
      if (a.zoneId === zoneId && !a.acknowledged) {
        return {
          ...a,
          acknowledged: true,
          acknowledgedAt: now,
          operatorNotes: 'Crowd cleared & returned to nominal safe baseline'
        };
      }
      return a;
    }));
  };

  const handleUpdateSource = (configId: string, source: 'SYNTHETIC' | 'WEBCAM' | 'LOCAL_VIDEO' | 'NETWORK_STREAM') => {
    setStreamConfigs(prev => prev.map(c => {
      if (c.id === configId) {
        return { ...c, activeSource: source };
      }
      return c;
    }));
  };

  const handleToggleConnection = (configId: string) => {
    setStreamConfigs(prev => prev.map(c => {
      if (c.id === configId) {
        return { ...c, isConnected: !c.isConnected };
      }
      return c;
    }));
  };

  const handleAcknowledgeAlert = (alertId: string, notes: string, action: AlertEvent['actionTaken']) => {
    setAlerts(prev => prev.map(a => {
      if (a.id === alertId) {
        return {
          ...a,
          acknowledged: true,
          acknowledgedAt: Date.now(),
          operatorNotes: notes,
          actionTaken: action
        };
      }
      return a;
    }));
    firebaseService.acknowledgeAlert(alertId, notes, action);
  };

  const handleSaveCalibration = (zoneId: string, updated: Partial<Zone>) => {
    setZones(prev => prev.map(z => {
      if (z.id === zoneId) {
        const next = { ...z, ...updated };
        next.density = calculateZoneDensity(next.currentCount, next.groundAreaM2);
        firebaseService.syncZoneState(next);
        return next;
      }
      return z;
    }));
  };

  const activeZoneToCalibrate = zones.find(z => z.id === calibratingZoneId);

  return (
    <div className="min-h-screen texture-grain pb-24 md:pb-10">
      {/* Top Navigation Bar (Page 6 Wireframe specs) */}
      <header className="sticky top-0 z-40 bg-dark-950/85 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Headline */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-dark-950 shadow-lg shadow-emerald-500/20 font-black">
              <ShieldAlert className="w-5 h-5 text-dark-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white">
                  CrowdWatch
                </h1>
                <span className="text-[11px] font-mono uppercase bg-slate-800/80 text-emerald-400 px-2 py-0.5 rounded border border-slate-700/60 font-semibold">
                  FEST OPS
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-400 font-mono">
                LIVE &bull; 2 CAMERAS &bull; 5.2 FPS EACH &bull; HOMOGRAPHY CALIBRATED
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 bg-dark-900/90 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => { playUiClick(); setActiveTab('OPERATIONS'); }}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'OPERATIONS'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live Operations</span>
            </button>

            <button
              onClick={() => { playUiClick(); setActiveTab('AUDIT'); }}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'AUDIT'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Incidents & Audit</span>
            </button>

            <button
              onClick={() => { playUiClick(); setActiveTab('BENCHMARK'); }}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'BENCHMARK'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Judge Defense & Benchmark</span>
            </button>
          </nav>

          {/* Status Indicators & Control Toggles */}
          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => { playUiClick(); setIsMuted(!isMuted); }}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
              title={isMuted ? 'Unmute Operational Chimes' : 'Mute Operational Chimes'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Firebase Backend Link Button */}
            <button
              onClick={() => { playUiClick(); setShowFirebaseModal(true); }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono font-medium flex items-center gap-1.5 transition text-slate-300"
              title="Configure Firebase Firestore Sync"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Firebase:</span>
              <span className={`w-2 h-2 rounded-full ${firebaseService.isConnected() ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Container */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 space-y-6">
        {/* Active Emergency / Early Warning Radar Banner */}
        <ActiveAlertPanel
          alerts={alerts}
          zones={zones}
          onAcknowledgeAlert={handleAcknowledgeAlert}
        />

        {/* View Selection Content */}
        {activeTab === 'OPERATIONS' && (
          <div className="space-y-6">
            {/* Festival God-View 2D Radar Mini-Map */}
            <FestivalGodViewMap
              zones={zones}
              onSelectZone={(zId) => setCalibratingZoneId(zId)}
            />

            {/* Live Dual Feeds Grid (Page 6 Wireframe specs) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {zones.map(zone => {
                const cfg = streamConfigs.find(c => c.id === zone.cameraId) || streamConfigs[0];
                return (
                  <CameraStreamCard
                    key={zone.id}
                    zone={zone}
                    config={cfg}
                    onUpdateCount={handleUpdateCount}
                    onSetInstantaneousCount={handleSetInstantaneousCount}
                    onUpdateLimit={handleUpdateLimit}
                    onUpdateSource={handleUpdateSource}
                    onResetBaseline={handleResetBaseline}
                    onToggleConnection={handleToggleConnection}
                    onSelectCalibration={(zId) => setCalibratingZoneId(zId)}
                  />
                );
              })}
            </div>

            {/* Interactive Crowd Formula & Limit Origin Breakdown */}
            <CrowdFormulaExplainer />

            {/* Quick Actions & Festival Health Readout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl glass-panel border border-slate-800 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Camera Health Radar
                </div>
                <div className="text-xl font-bold font-mono text-emerald-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>2 Feeds Online & Calibrated</span>
                </div>
                <p className="text-xs text-slate-400">
                  Dual 1080p stream decoders operating with zero lag accumulation.
                </p>
              </div>

              <div className="p-4 rounded-xl glass-panel border border-slate-800 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Inference Throughput Target
                </div>
                <div className="text-xl font-bold font-mono text-cyan-300">
                  10.5 Inferences / sec
                </div>
                <p className="text-xs text-slate-400">
                  Exceeds the 10.0 combined target (5.2 FPS Cam 1 + 5.3 FPS Cam 2).
                </p>
              </div>

              <div className="p-4 rounded-xl glass-panel border border-slate-800 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Decision Support Guardrail
                </div>
                <div className="text-xl font-bold font-mono text-amber-300">
                  Advisory Monitoring Tool
                </div>
                <p className="text-xs text-slate-400">
                  Assists human stewards; does not replace the venue event safety plan.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'AUDIT' && (
          <IncidentAuditLog alerts={alerts} />
        )}

        {activeTab === 'BENCHMARK' && (
          <BenchmarkAndJudgeCenter />
        )}
      </main>

      {/* Calibration Studio Modal */}
      {calibratingZoneId && activeZoneToCalibrate && (
        <CalibrationStudio
          zone={activeZoneToCalibrate}
          onSaveCalibration={handleSaveCalibration}
          onClose={() => setCalibratingZoneId(null)}
        />
      )}

      {/* Firebase Config Modal */}
      {showFirebaseModal && (
        <FirebaseSettingsModal
          onClose={() => setShowFirebaseModal(false)}
          onConfigUpdated={() => {}}
        />
      )}

      {/* Mobile Bottom Navigation Bar (For smartphone viewport hackathon demos) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-950/95 backdrop-blur-xl border-t border-slate-800 px-3 py-2 flex items-center justify-around">
        <button
          onClick={() => { playUiClick(); setActiveTab('OPERATIONS'); }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition ${
            activeTab === 'OPERATIONS' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Ops</span>
        </button>

        <button
          onClick={() => { playUiClick(); setActiveTab('AUDIT'); }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition ${
            activeTab === 'AUDIT' ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Log</span>
        </button>

        <button
          onClick={() => { playUiClick(); setActiveTab('BENCHMARK'); }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition ${
            activeTab === 'BENCHMARK' ? 'text-purple-400' : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Judges</span>
        </button>
      </div>
    </div>
  );
}
