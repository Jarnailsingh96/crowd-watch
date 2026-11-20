export type ZoneStatus = 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN';

export type CameraHealth = 'ONLINE' | 'DEGRADED' | 'DISCONNECTED';

export interface Point2D {
  x: number;
  y: number;
}

export interface HomographyPair {
  imgX: number;
  imgY: number;
  groundX: number;
  groundY: number;
}

export interface Zone {
  id: string;
  name: string;
  cameraId: string;
  cameraName: string;
  location: string;
  currentCount: number;
  groundAreaM2: number;
  density: number; // people / m2
  trendSlope: number; // people / sec (positive = accumulating, negative = dispersing)
  projectedCount60s: number;
  secondsToLimit: number | null; // null if stable/falling
  status: ZoneStatus;
  limitCount: number;
  warningLeadTimeSeconds: number; // e.g. 60s
  lastFrameTimestamp: number;
  cameraHealth: CameraHealth;
  processingFps: number;
  resolution: string;
  roiPolygon: Point2D[];
  homographyPoints: HomographyPair[];
  isCalibrated: boolean;
  densityModel: 'CSRNet-Dilated-CNN' | 'P2PNet-PointLocalizer';
}

export interface AlertEvent {
  id: string;
  zoneId: string;
  zoneName: string;
  status: ZoneStatus;
  timestamp: number;
  count: number;
  density: number;
  trendSlope: number;
  projectedSeconds: number | null;
  message: string;
  acknowledged: boolean;
  acknowledgedAt?: number;
  operatorNotes?: string;
  actionTaken?: 'STEWARDS_DISPATCHED' | 'GATE_HELD' | 'FLOW_DIVERTED' | 'SUPERVISOR_NOTIFIED';
}

export interface CameraStreamConfig {
  id: string;
  name: string;
  zoneName: string;
  type: 'SIMULATED_CROWD' | 'WEBCAM' | 'CUSTOM_VIDEO';
  presetScenario: 'NORTH_GATE_RISING' | 'FOOD_COURT_STABLE' | 'MAIN_STAGE_HIGH_DENSITY';
  videoUrl?: string;
  isConnected: boolean;
  simulatedBaselineCount: number;
  volatility: number;
  activeSource?: 'SYNTHETIC' | 'WEBCAM' | 'LOCAL_VIDEO' | 'NETWORK_STREAM';
}

export interface BenchmarkReport {
  timestamp: number;
  systemHardware: {
    platform: string;
    runtime: string;
    engine: string;
    inferenceAccelerator: string;
  };
  metrics: {
    simultaneousFeeds: number;
    avgFpsCamera1: number;
    avgFpsCamera2: number;
    totalInferencesPerSec: number;
    wapeErrorPercent: number; // Target: < 20%
    wapeSparseDensity: number;
    wapeDenseDensity: number;
    samplesEvaluated: number;
    leadTimeDeliveredSeconds: number;
  };
  passCriteria: {
    dualFeedsOnline: boolean;
    fpsTargetMet: boolean; // >= 5 fps per camera
    wapeTargetMet: boolean; // <= 20%
    failSafeAlertMet: boolean; // disconnect => UNKNOWN (never green)
  };
}

export interface FirebaseConnectionConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  isConfigured: boolean;
  syncLive: boolean;
}
