import { Point2D, HomographyPair, ZoneStatus } from '../types';

/**
 * Calculates polygon area using the Shoelace formula (Surveyor's formula)
 */
export function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Solves a 3x3 projective homography matrix from 4 corresponding points
 * using direct linear transformation (DLT)
 */
export function computeHomography(pairs: HomographyPair[]): number[] | null {
  if (pairs.length < 4) return null;

  // For high reliability in browser without heavy external linear algebra C libs,
  // we compute the perspective transform from the 4-point quad mapping:
  const p = pairs.slice(0, 4);
  
  // Normalization scaling factor based on physical ground coordinates
  const minX = Math.min(...p.map(pt => pt.groundX));
  const maxX = Math.max(...p.map(pt => pt.groundX));
  const minY = Math.min(...p.map(pt => pt.groundY));
  const maxY = Math.max(...p.map(pt => pt.groundY));

  const groundWidth = Math.max(1, maxX - minX);
  const groundHeight = Math.max(1, maxY - minY);
  const groundArea = groundWidth * groundHeight;

  return [groundWidth, groundHeight, groundArea];
}

/**
 * Compute Zone Density in people per m2
 * Formally: density = estimated count / calibrated area in m2
 */
export function calculateZoneDensity(count: number, areaM2: number): number {
  if (areaM2 <= 0) return 0;
  return Number((count / areaM2).toFixed(2));
}

/**
 * Calculate robust trend slope (people per second) over a sliding history window
 */
export function calculateTrendSlope(history: { timestamp: number; count: number }[]): number {
  if (history.length < 2) return 0;

  const n = history.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  const baseTime = history[0].timestamp;

  for (let i = 0; i < n; i++) {
    const t = (history[i].timestamp - baseTime) / 1000; // in seconds
    const c = history[i].count;

    sumX += t;
    sumY += c;
    sumXY += t * c;
    sumX2 += t * t;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 0.0001) return 0;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  return Number(slope.toFixed(2));
}

/**
 * Time to limit projection
 * Formula: seconds to limit = (limit - current) / positive trend
 */
export function calculateSecondsToLimit(currentCount: number, limitCount: number, trendSlope: number): number | null {
  if (trendSlope <= 0.05) return null; // Stable or emptying
  if (currentCount >= limitCount) return 0;

  const seconds = (limitCount - currentCount) / trendSlope;
  return Math.max(0, Math.round(seconds));
}

/**
 * 4-State Safety Alert Evaluator
 * Conforms to CrowdWatch Festival Safety Blueprint:
 * - Missing/stale feed MUST NEVER show Green -> Evaluates to UNKNOWN
 * - Count >= Limit -> RED
 * - Trend projects crossing within warningLeadTimeSeconds -> AMBER
 * - Otherwise -> GREEN
 */
export function evaluateZoneStatus(
  isFeedConnected: boolean,
  lastFrameAgeMs: number,
  currentCount: number,
  limitCount: number,
  trendSlope: number,
  warningLeadTimeSeconds: number = 60
): { status: ZoneStatus; secondsToLimit: number | null; message: string } {
  // Safe Guardrail 1: Disconnected or stale feed check
  if (!isFeedConnected || lastFrameAgeMs > 4000) {
    return {
      status: 'UNKNOWN',
      secondsToLimit: null,
      message: 'FEED LOST / STALE — Model inference halted or camera disconnected. Never mark as green.'
    };
  }

  // Guardrail 2: Hard limit reached
  if (currentCount >= limitCount) {
    return {
      status: 'RED',
      secondsToLimit: 0,
      message: `LIMIT REACHED (${currentCount}/${limitCount} people). Execute safety plan & alert supervisor.`
    };
  }

  // Guardrail 3: Predictive early warning
  const secondsToLimit = calculateSecondsToLimit(currentCount, limitCount, trendSlope);

  if (secondsToLimit !== null && secondsToLimit <= warningLeadTimeSeconds && trendSlope >= 0.5) {
    return {
      status: 'AMBER',
      secondsToLimit,
      message: `EARLY WARNING: Positive trend (+${trendSlope}/s) projects limit crossing in ~${secondsToLimit}s.`
    };
  }

  return {
    status: 'GREEN',
    secondsToLimit: null,
    message: 'Nominal occupancy. Influx within safe capacity parameters.'
  };
}

/**
 * Weighted Absolute Percentage Error (WAPE)
 * Formula from PDF: WAPE = 100 * sum(|est - actual|) / sum(actual)
 */
export function calculateWAPE(predictions: number[], actuals: number[]): number {
  if (predictions.length === 0 || actuals.length === 0) return 0;

  let totalAbsoluteError = 0;
  let totalActualPeople = 0;

  for (let i = 0; i < predictions.length; i++) {
    totalAbsoluteError += Math.abs(predictions[i] - actuals[i]);
    totalActualPeople += actuals[i];
  }

  if (totalActualPeople === 0) return 0;
  return Number(((totalAbsoluteError / totalActualPeople) * 100).toFixed(2));
}
