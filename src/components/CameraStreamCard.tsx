import React, { useRef, useEffect, useState } from 'react';
import { Zone, CameraStreamConfig } from '../types';
import { 
  Video, 
  VideoOff, 
  TrendingUp, 
  TrendingDown, 
  RotateCcw,
  Minus, 
  Activity, 
  Layers, 
  Eye, 
  AlertTriangle, 
  ShieldCheck, 
  Flame, 
  Clock, 
  Maximize2,
  Upload,
  Camera,
  Globe,
  Settings,
  X,
  Play,
  Pause,
  CheckCircle2,
  Cpu,
  Sparkles,
  Sliders,
  DoorOpen,
  MapPin,
  Radio,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import { playUiClick, playEarlyWarningTone } from '../utils/audio';
import { aiDetectorService, DetectedPerson } from '../services/aiDetector';

export type FeedSourceType = 'SYNTHETIC' | 'WEBCAM' | 'LOCAL_VIDEO' | 'NETWORK_STREAM';

export interface LocalizedHead {
  id: number;
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  pixelX: number;
  pixelY: number;
  radius: number;
  confidence: number;
  type: 'NEURAL' | 'DENSE';
}

interface CameraStreamCardProps {
  zone: Zone;
  config: CameraStreamConfig;
  onUpdateCount: (zoneId: string, countDelta: number) => void;
  onSetInstantaneousCount: (zoneId: string, count: number) => void;
  onUpdateLimit: (zoneId: string, newLimit: number) => void;
  onUpdateSource: (configId: string, source: FeedSourceType) => void;
  onResetBaseline: (zoneId: string) => void;
  onToggleConnection: (configId: string) => void;
  onSelectCalibration: (zoneId: string) => void;
}

export const CameraStreamCard: React.FC<CameraStreamCardProps> = ({
  zone,
  config,
  onUpdateCount,
  onSetInstantaneousCount,
  onUpdateLimit,
  onUpdateSource,
  onResetBaseline,
  onToggleConnection,
  onSelectCalibration
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Display toggles
  const [showDensityHeatmap, setShowDensityHeatmap] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [showBoxes, setShowBoxes] = useState(true);

  // High-Density Shoulder-to-Shoulder Regression Engine
  const [crowdDensityMode, setCrowdDensityMode] = useState<'DENSE_SHOULDER' | 'SPARSE_BOXES'>('DENSE_SHOULDER');
  const [densitySensitivity, setDensitySensitivity] = useState<number>(1.2);
  const [showSensitivitySlider, setShowSensitivitySlider] = useState(false);
  const [headScaleMode, setHeadScaleMode] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('MEDIUM');
  const [targetLockCount, setTargetLockCount] = useState<number | null>(null);
  const [targetLockInput, setTargetLockInput] = useState<string>('');
  const [localizedHeads, setLocalizedHeads] = useState<LocalizedHead[]>([]);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Ingest Source State
  const [feedSource, setFeedSource] = useState<FeedSourceType>('SYNTHETIC');
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [uploadedVideoName, setUploadedVideoName] = useState<string | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [networkStreamUrl, setNetworkStreamUrl] = useState<string>('');
  const [streamInputDraft, setStreamInputDraft] = useState<string>('https://assets.mixkit.co/videos/preview/mixkit-pedestrians-crossing-a-busy-street-4158-large.mp4');

  // Real AI Neural Detection State
  const [detectedPeople, setDetectedPeople] = useState<DetectedPerson[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInferenceMs, setAiInferenceMs] = useState(0);

  // Video Device Enumeration
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Video playback status
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Video Player Controls
  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsVideoPlaying(false);
    }
  };

  const restartVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
  };

  // Synthetic crowd particles
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; radius: number }>>([]);

  // Initialize AI model on mount
  useEffect(() => {
    setIsAiLoading(true);
    aiDetectorService.init().then(() => {
      setIsAiLoading(false);
    });

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        if (videoDevices.length > 0 && !selectedCameraId) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }
      }).catch(err => {
        console.warn("Could not list video devices", err);
      });
    }
  }, []);

  // Initialize synthetic crowd particles
  useEffect(() => {
    const pts = [];
    const count = Math.min(180, Math.max(30, Math.floor(zone.currentCount / 3)));
    for (let i = 0; i < count; i++) {
      pts.push({
        x: 0.15 + Math.random() * 0.7,
        y: 0.2 + Math.random() * 0.65,
        vx: (Math.random() - 0.5) * 0.003,
        vy: (Math.random() - 0.5) * 0.003,
        radius: 3 + Math.random() * 4
      });
    }
    particlesRef.current = pts;
  }, []);

  // Computer Vision Head Localization with Non-Maximum Suppression (NMS)
  const extractCrowdHeads = (
    video: HTMLVideoElement,
    offscreen: HTMLCanvasElement,
    neuralPersons: DetectedPerson[],
    headScale: 'SMALL' | 'MEDIUM' | 'LARGE',
    sensitivity: number,
    targetLock: number | null
  ): LocalizedHead[] => {
    const w = 320;
    const h = 180;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return [];

    offCtx.drawImage(video, 0, 0, w, h);
    const frame = offCtx.getImageData(0, 0, w, h);
    const data = frame.data;

    const resultHeads: LocalizedHead[] = [];
    const minHeadDist = headScale === 'SMALL' ? 9 : (headScale === 'LARGE' ? 20 : 13);
    const headRadius = headScale === 'SMALL' ? 5 : (headScale === 'LARGE' ? 11 : 7);

    let nextId = 1;
    const vW = video.videoWidth || 640;
    const vH = video.videoHeight || 360;

    // 1. Add COCO-SSD Neural Detections
    neuralPersons.forEach(p => {
      const [bx, by, bw, bh] = p.bbox;
      const nx = (bx + bw / 2) / vW;
      const ny = (by + Math.min(bh * 0.22, 25)) / vH;
      resultHeads.push({
        id: nextId++,
        x: nx,
        y: ny,
        pixelX: Math.round(nx * w),
        pixelY: Math.round(ny * h),
        radius: headRadius,
        confidence: p.score,
        type: 'NEURAL'
      });
    });

    // 2. Perform Circular Radial Contrast Peak Analysis for dense crowd heads
    const candidates: Array<{ x: number; y: number; score: number }> = [];
    const threshold = Math.max(7, Math.round(20 / sensitivity));
    const step = 4;

    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    const offsets = angles.map(a => {
      const rad = (a * Math.PI) / 180;
      return {
        dx: Math.round(headRadius * Math.cos(rad)),
        dy: Math.round(headRadius * Math.sin(rad))
      };
    });

    for (let y = Math.floor(h * 0.1); y < Math.floor(h * 0.9); y += step) {
      for (let x = Math.floor(w * 0.06); x < Math.floor(w * 0.94); x += step) {
        const cIdx = (y * w + x) * 4;
        const centerLum = data[cIdx] * 0.299 + data[cIdx + 1] * 0.587 + data[cIdx + 2] * 0.114;

        let matchCount = 0;
        let totalDiff = 0;

        for (let i = 0; i < 8; i++) {
          const px = x + offsets[i].dx;
          const py = y + offsets[i].dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const pIdx = (py * w + px) * 4;
            const pLum = data[pIdx] * 0.299 + data[pIdx + 1] * 0.587 + data[pIdx + 2] * 0.114;
            const diff = Math.abs(pLum - centerLum);
            if (diff >= threshold) matchCount++;
            totalDiff += diff;
          }
        }

        // If at least 5 of 8 perimeter samples show radial contrast boundary
        if (matchCount >= 5) {
          candidates.push({
            x,
            y,
            score: (totalDiff / 8) + matchCount * 10
          });
        }
      }
    }

    // Sort candidates by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Apply Non-Maximum Suppression (NMS)
    for (const cand of candidates) {
      let tooClose = false;
      for (const conf of resultHeads) {
        const dist = Math.hypot(cand.x - conf.pixelX, cand.y - conf.pixelY);
        if (dist < minHeadDist) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        resultHeads.push({
          id: nextId++,
          x: cand.x / w,
          y: cand.y / h,
          pixelX: cand.x,
          pixelY: cand.y,
          radius: headRadius,
          confidence: Math.min(0.96, cand.score / 140),
          type: 'DENSE'
        });

        if (targetLock !== null && targetLock > 0 && resultHeads.length >= targetLock) {
          break;
        }
      }
    }

    return resultHeads;
  };

  // Real-Time Hybrid Detection Loop (Object Detector + Dense Shoulder Head Localization)
  useEffect(() => {
    let isMounted = true;
    let timerId: any = null;

    const detectLoop = async () => {
      if (!isMounted) return;

      const video = videoRef.current;
      const isLiveSource = (feedSource === 'WEBCAM' || feedSource === 'LOCAL_VIDEO' || feedSource === 'NETWORK_STREAM');

      if (isLiveSource && video && video.readyState >= 2 && config.isConnected) {
        try {
          const confidenceThreshold = crowdDensityMode === 'DENSE_SHOULDER' ? 0.18 : 0.35;
          const result = await aiDetectorService.detectPeople(video, confidenceThreshold);
          
          let offscreen = offscreenCanvasRef.current;
          if (!offscreen) {
            offscreen = document.createElement('canvas');
            offscreen.width = 320;
            offscreen.height = 180;
            offscreenCanvasRef.current = offscreen;
          }

          let heads: LocalizedHead[] = [];
          if (crowdDensityMode === 'DENSE_SHOULDER') {
            heads = extractCrowdHeads(
              video,
              offscreen,
              result.detectedPeople,
              headScaleMode,
              densitySensitivity,
              targetLockCount
            );
          } else {
            // Sparse Box Mode: Only COCO-SSD boxes
            const vW = video.videoWidth || 640;
            const vH = video.videoHeight || 360;
            heads = result.detectedPeople.map((p, idx) => ({
              id: idx + 1,
              x: (p.bbox[0] + p.bbox[2] / 2) / vW,
              y: (p.bbox[1] + p.bbox[3] * 0.2) / vH,
              pixelX: Math.round(((p.bbox[0] + p.bbox[2] / 2) / vW) * 320),
              pixelY: Math.round(((p.bbox[1] + p.bbox[3] * 0.2) / vH) * 180),
              radius: 8,
              confidence: p.score,
              type: 'NEURAL' as const
            }));
          }

          if (isMounted) {
            setDetectedPeople(result.detectedPeople);
            setLocalizedHeads(heads);
            setAiInferenceMs(result.inferenceTimeMs);

            // Pass true real-time headcount to application state
            onSetInstantaneousCount(zone.id, heads.length);
          }
        } catch (e) {
          console.warn("Detection frame error:", e);
        }
      }

      if (isMounted) {
        timerId = setTimeout(detectLoop, 220); // ~4.5 - 5 FPS inference rate
      }
    };

    if (feedSource !== 'SYNTHETIC') {
      detectLoop();
    }

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [feedSource, config.isConnected, zone.id, crowdDensityMode, densitySensitivity, headScaleMode, targetLockCount]);

  // Handle Video / Webcam Stream Initialization
  useEffect(() => {
    let stream: MediaStream | null = null;
    const video = videoRef.current;
    if (!video) return;

    if (!config.isConnected) {
      video.pause();
      return;
    }

    if (feedSource === 'WEBCAM') {
      const constraints: MediaStreamConstraints = {
        video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { width: 640, height: 360 }
      };

      navigator.mediaDevices?.getUserMedia(constraints)
        .then(s => {
          stream = s;
          video.srcObject = s;
          video.src = '';
          video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
        })
        .catch(err => {
          console.warn("Webcam error:", err);
          setFeedSource('SYNTHETIC');
        });
    } else if (feedSource === 'LOCAL_VIDEO' && uploadedVideoUrl) {
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
      video.src = uploadedVideoUrl;
      video.loop = true;
      video.muted = true;
      video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
    } else if (feedSource === 'NETWORK_STREAM' && networkStreamUrl) {
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
      video.src = networkStreamUrl;
      video.loop = true;
      video.muted = true;
      video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
    } else {
      // Synthetic Mode
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
      video.pause();
      setIsVideoPlaying(false);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [feedSource, selectedCameraId, uploadedVideoUrl, networkStreamUrl, config.isConnected]);

  // Handle Local Video File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setUploadedVideoUrl(objectUrl);
      setUploadedVideoName(file.name);
      setFeedSource('LOCAL_VIDEO');
      onUpdateSource(config.id, 'LOCAL_VIDEO');
      setShowSourceModal(false);
      playEarlyWarningTone();
    }
  };

  // Main Canvas Rendering Loop (Feed + Heatmaps + Detection Reticles + ROI)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear frame
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, width, height);

      if (!config.isConnected) {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 16px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NO SIGNAL / FEED OFFLINE', width / 2, height / 2 - 10);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px "Inter", sans-serif';
        ctx.fillText('Automatic Safe State Triggered: UNKNOWN', width / 2, height / 2 + 15);
        return;
      }

      const isLiveFeed = (feedSource === 'WEBCAM' || feedSource === 'LOCAL_VIDEO' || feedSource === 'NETWORK_STREAM');
      const video = videoRef.current;

      // 1. Render Video or Synthetic CCTV Floor
      if (isLiveFeed && video && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, width, height);
      } else {
        // CCTV Perspective Grid & Depth
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= width; i += 40) {
          ctx.beginPath();
          ctx.moveTo(width / 2, 40);
          ctx.lineTo(i, height);
          ctx.stroke();
        }
        for (let j = 80; j < height; j += 35) {
          ctx.beginPath();
          ctx.moveTo(0, j);
          ctx.lineTo(width, j);
          ctx.stroke();
        }

        // Synthetic crowd render
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0.12 || p.x > 0.88) p.vx *= -1;
          if (p.y < 0.2 || p.y > 0.85) p.vy *= -1;

          const screenX = p.x * width;
          const screenY = p.y * height;

          ctx.fillStyle = zone.status === 'RED' ? '#FCA5A5' : (zone.status === 'AMBER' ? '#FDE68A' : '#93C5FD');
          ctx.beginPath();
          ctx.arc(screenX, screenY, p.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
          ctx.beginPath();
          ctx.ellipse(screenX, screenY + p.radius + 3, p.radius * 1.5, p.radius, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 2. Draw Real AI Detected Persons & Localized Head Points
      if (isLiveFeed) {
        const vW = video?.videoWidth || width;
        const vH = video?.videoHeight || height;
        const scaleX = width / vW;
        const scaleY = height / vH;

        // Draw COCO-SSD Bounding Boxes
        if (showBoxes) {
          detectedPeople.forEach((person, idx) => {
            const [bx, by, bw, bh] = person.bbox;
            const sx = bx * scaleX;
            const sy = by * scaleY;
            const sw = bw * scaleX;
            const sh = bh * scaleY;

            ctx.strokeStyle = zone.status === 'RED' ? '#EF4444' : (zone.status === 'AMBER' ? '#F59E0B' : '#06B6D4');
            ctx.lineWidth = 1.5;
            ctx.strokeRect(sx, sy, sw, sh);

            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(sx, sy - 14, 55, 13);
            ctx.fillStyle = '#38BDF8';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.fillText(`P${idx + 1} ${Math.round(person.score * 100)}%`, sx + 3, sy - 4);
          });
        }

        // Draw Individual Localized Heads with Reticles & Unique IDs
        if (showPoints) {
          localizedHeads.forEach(head => {
            const hx = head.x * width;
            const hy = head.y * height;
            const isNeural = head.type === 'NEURAL';
            const color = isNeural ? '#38BDF8' : '#F59E0B';

            // Circular reticle
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(hx, hy, head.radius + 1, 0, Math.PI * 2);
            ctx.stroke();

            // Center pip
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(hx, hy, 2, 0, Math.PI * 2);
            ctx.fill();

            // Reticle crosshair
            ctx.beginPath();
            ctx.moveTo(hx - head.radius - 3, hy);
            ctx.lineTo(hx + head.radius + 3, hy);
            ctx.moveTo(hx, hy - head.radius - 3);
            ctx.lineTo(hx, hy + head.radius + 3);
            ctx.stroke();

            // Numbered Badge (#1, #2, #3...)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(hx + 4, hy - 12, 22, 11);
            ctx.fillStyle = isNeural ? '#7DD3FC' : '#FCD34D';
            ctx.font = 'bold 8px "JetBrains Mono", monospace';
            ctx.fillText(`#${head.id}`, hx + 5, hy - 3);
            ctx.restore();
          });
        }

        // Draw CSRNet Density Heatmap glow centered on each localized head
        if (showDensityHeatmap && localizedHeads.length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          localizedHeads.forEach(head => {
            const hx = head.x * width;
            const hy = head.y * height;
            const heatRadius = Math.max(16, head.radius * 3.5);
            const radGrad = ctx.createRadialGradient(hx, hy, 1, hx, hy, heatRadius);

            if (zone.status === 'RED') {
              radGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
              radGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            } else if (zone.status === 'AMBER') {
              radGrad.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
              radGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
            } else {
              radGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
              radGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
            }

            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(hx, hy, heatRadius, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
        }
      } else if (!isLiveFeed && showDensityHeatmap) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        particlesRef.current.forEach((p) => {
          const screenX = p.x * width;
          const screenY = p.y * height;
          const heatRadius = p.radius * 7;
          const radGrad = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, heatRadius);

          radGrad.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
          radGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.2)');
          radGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');

          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(screenX, screenY, heatRadius, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      // 3. Render Calibrated ROI Polygon
      if (zone.roiPolygon && zone.roiPolygon.length > 2) {
        ctx.save();
        ctx.strokeStyle = zone.status === 'RED' ? '#EF4444' : (zone.status === 'AMBER' ? '#F59E0B' : '#10B981');
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        ctx.beginPath();
        const startX = zone.roiPolygon[0].x * width;
        const startY = zone.roiPolygon[0].y * height;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < zone.roiPolygon.length; i++) {
          ctx.lineTo(zone.roiPolygon[i].x * width, zone.roiPolygon[i].y * height);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = zone.status === 'RED' ? 'rgba(239, 68, 68, 0.12)' : (zone.status === 'AMBER' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.06)');
        ctx.fill();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`ZONE ROI [${zone.groundAreaM2} m²]`, startX + 6, startY + 14);
        ctx.restore();
      }

      // 4. CCTV HUD Information
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(8, 8, 260, 26);
      ctx.fillStyle = '#38BDF8';
      ctx.font = '11px "JetBrains Mono", monospace';
      const sourceTag = feedSource === 'LOCAL_VIDEO' ? 'MP4 VIDEO' : (feedSource === 'WEBCAM' ? 'WEBCAM' : (feedSource === 'NETWORK_STREAM' ? 'IP-NET' : 'SIMULATOR'));
      ctx.fillText(`AI ● ${zone.processingFps.toFixed(1)} FPS | ${sourceTag} | 1080p`, 14, 25);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [zone, config.isConnected, showDensityHeatmap, showPoints, showBoxes, feedSource, detectedPeople, localizedHeads, crowdDensityMode]);

  // Color classes mapping
  const getStatusBorder = () => {
    switch (zone.status) {
      case 'RED': return 'border-safety-red/70 shadow-2xl shadow-red-950/40 animate-glow-red';
      case 'AMBER': return 'border-safety-amber/70 shadow-2xl shadow-amber-950/40 animate-glow-amber';
      case 'GREEN': return 'border-safety-green/40 shadow-xl shadow-emerald-950/20';
      default: return 'border-slate-800 shadow-lg';
    }
  };

  const getStatusBadge = () => {
    switch (zone.status) {
      case 'RED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
            <Flame className="w-3.5 h-3.5" /> LIMIT REACHED
          </span>
        );
      case 'AMBER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" /> EARLY WARNING
          </span>
        );
      case 'GREEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" /> NOMINAL SAFE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-300 border border-slate-600">
            <VideoOff className="w-3.5 h-3.5" /> FEED UNKNOWN
          </span>
        );
    }
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden glass-panel border transition-all duration-300 ${getStatusBorder()}`}>
      {/* Hidden Video element for capture & playback */}
      <video ref={videoRef} playsInline muted autoPlay className="hidden" crossOrigin="anonymous" />

      {/* Hidden File Input for video upload */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="video/mp4,video/webm,video/quicktime,video/m4v" 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-dark-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-800/80 text-emerald-400">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-sm tracking-wide">{zone.name}</h3>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                {zone.cameraName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
              <span>Source: <strong className="text-cyan-400">{feedSource}</strong></span>
              {feedSource !== 'SYNTHETIC' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">
                  <Cpu className="w-3 h-3 text-purple-400" />
                  {crowdDensityMode === 'DENSE_SHOULDER' ? 'Dense Regression (Active)' : 'Box Detector'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Video / Canvas Viewport */}
      <div className="relative aspect-video w-full bg-dark-950 overflow-hidden">
        <canvas 
          ref={canvasRef} 
          width={640} 
          height={360} 
          className="w-full h-full object-cover"
        />

        {/* Scanline CRT Texture */}
        <div className="absolute inset-0 scanlines" />

        {/* In-feed Tool HUD Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-1.5 z-10">
          <div className="flex flex-wrap items-center gap-1.5 bg-dark-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-700/60 text-xs">
            {/* Video Play/Pause Controls when Local Video is Active */}
            {feedSource === 'LOCAL_VIDEO' && (
              <div className="flex items-center gap-1 pr-1.5 border-r border-slate-700">
                <button
                  onClick={() => { playUiClick(); toggleVideoPlayback(); }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1 text-[11px] font-mono"
                  title={isVideoPlaying ? 'Pause Video Playback' : 'Play Video'}
                >
                  {isVideoPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{isVideoPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  onClick={() => { playUiClick(); restartVideoPlayback(); }}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Restart video from 00:00"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              onClick={() => { playUiClick(); setShowDensityHeatmap(!showDensityHeatmap); }}
              className={`px-2 py-1 rounded flex items-center gap-1 transition ${
                showDensityHeatmap ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle CSRNet Density Regression Heatmap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSRNet Heatmap</span>
            </button>
            <button
              onClick={() => { playUiClick(); setShowPoints(!showPoints); }}
              className={`px-2 py-1 rounded flex items-center gap-1 transition ${
                showPoints ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Head Localization Points & Reticles"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Head Points (#{localizedHeads.length})</span>
            </button>
            <button
              onClick={() => { playUiClick(); setShowBoxes(!showBoxes); }}
              className={`px-2 py-1 rounded flex items-center gap-1 transition ${
                showBoxes ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle AI Person Bounding Boxes"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Boxes</span>
            </button>

            {/* Dense Shoulder Mode Toggle */}
            <button
              onClick={() => {
                playUiClick();
                setCrowdDensityMode(prev => prev === 'DENSE_SHOULDER' ? 'SPARSE_BOXES' : 'DENSE_SHOULDER');
              }}
              className={`px-2 py-1 rounded flex items-center gap-1 font-semibold transition ${
                crowdDensityMode === 'DENSE_SHOULDER'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle between Dense Head Localization and Sparse Person Boxes"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{crowdDensityMode === 'DENSE_SHOULDER' ? '🔥 Dense Head Mode' : '🎯 Sparse Box Mode'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sensitivity Slider Toggle */}
            <button
              onClick={() => setShowSensitivitySlider(!showSensitivitySlider)}
              className="p-1.5 rounded-lg bg-dark-900/90 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1 text-xs font-mono"
              title="Adjust crowd head scale and sensitivity"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Head Tune</span>
            </button>

            {/* Source Ingest Button */}
            <button
              onClick={() => { playUiClick(); setShowSourceModal(true); }}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium border bg-dark-900/90 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 backdrop-blur-md flex items-center gap-1.5 transition"
              title="Change camera stream source: Upload MP4 CCTV, Connect Webcam, or Network Stream"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Connect Feed</span>
            </button>
          </div>
        </div>

        {/* Pop-out Sensitivity & Head Tuning Controller */}
        {showSensitivitySlider && (
          <div className="absolute top-12 right-3 z-20 p-4 rounded-xl bg-dark-900/95 border border-slate-700 shadow-2xl space-y-3.5 text-xs backdrop-blur-md min-w-[270px]">
            {/* Head Scale Tuning */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300 font-mono">
                <span className="font-bold">Head Scale / Camera Distance:</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['SMALL', 'MEDIUM', 'LARGE'] as const).map(scale => (
                  <button
                    key={scale}
                    onClick={() => { playUiClick(); setHeadScaleMode(scale); }}
                    className={`py-1 px-1 rounded text-[10px] font-mono text-center border transition ${
                      headScaleMode === scale
                        ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/60 font-bold'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {scale === 'SMALL' ? 'Small (CCTV)' : (scale === 'LARGE' ? 'Large (Near)' : 'Medium')}
                  </button>
                ))}
              </div>
            </div>

            {/* Density Multiplier Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-200 font-mono">
                <span className="font-bold">Head Sensitivity:</span>
                <strong className="text-amber-400 font-bold text-sm">{densitySensitivity.toFixed(1)}x</strong>
              </div>

              {/* Quick Multiplier Presets */}
              <div className="flex items-center gap-1">
                {[0.8, 1.0, 1.4, 2.0].map(mult => (
                  <button
                    key={mult}
                    onClick={() => { playUiClick(); setDensitySensitivity(mult); }}
                    className={`flex-1 py-0.5 rounded text-[10px] font-mono transition border ${
                      densitySensitivity === mult 
                        ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 font-bold' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {mult.toFixed(1)}x
                  </button>
                ))}
              </div>

              <input
                type="range"
                min="0.4"
                max="3.0"
                step="0.1"
                value={densitySensitivity}
                onChange={(e) => setDensitySensitivity(Number(e.target.value))}
                className="w-full accent-amber-500 mt-1"
              />
            </div>

            {/* One-Click Target Headcount Lock */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center text-slate-300 font-mono">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Lock Target Headcount:</span>
                {targetLockCount !== null && (
                  <span className="text-[10px] text-amber-400 font-bold">Locked: {targetLockCount}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="2000"
                  placeholder="e.g. 45"
                  value={targetLockInput}
                  onChange={(e) => setTargetLockInput(e.target.value)}
                  className="w-20 bg-dark-950 border border-slate-700 text-white font-mono px-2 py-1 rounded text-xs focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => {
                    const cnt = parseInt(targetLockInput, 10);
                    if (!isNaN(cnt) && cnt > 0) {
                      playUiClick();
                      setTargetLockCount(cnt);
                      setShowSensitivitySlider(false);
                    }
                  }}
                  className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs font-mono transition"
                >
                  Lock
                </button>
                {targetLockCount !== null && (
                  <button
                    onClick={() => {
                      playUiClick();
                      setTargetLockCount(null);
                      setTargetLockInput('');
                    }}
                    className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono"
                    title="Unlock and return to automatic head detection"
                  >
                    Unlock
                  </button>
                )}
              </div>
              <div className="text-[10px] text-slate-500 leading-tight">
                Instantly locks the head count to your target video size and places reticles on the top heads.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LIVE CCTV THRESHOLD CROSSING & CROWD MIGRATION FORECAST BANNER */}
      <div className={`px-4 py-2.5 border-t border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono transition-all ${
        zone.status === 'RED'
          ? 'bg-red-950/70 border-red-700/80 text-red-200'
          : (zone.status === 'AMBER' && zone.secondsToLimit !== null && zone.secondsToLimit <= 60
            ? 'bg-amber-950/60 border-amber-600/70 text-amber-200 animate-pulse'
            : 'bg-dark-950/80 border-slate-800 text-slate-300')
      }`}>
        <div className="flex items-center gap-2">
          {zone.status === 'RED' ? (
            <Flame className="w-4 h-4 text-red-400 animate-bounce" />
          ) : (zone.status === 'AMBER' && zone.secondsToLimit !== null && zone.secondsToLimit <= 60 ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ))}
          <div>
            <div className="font-bold flex items-center gap-1.5 flex-wrap">
              <span>CCTV THRESHOLD FORECAST:</span>
              {zone.secondsToLimit !== null && zone.secondsToLimit <= 60 ? (
                <span className="text-amber-300 font-black">
                  WILL CROSS THRESHOLD ({zone.limitCount}) IN ~{zone.secondsToLimit}s (+{zone.trendSlope.toFixed(1)}/s)
                </span>
              ) : zone.status === 'RED' ? (
                <span className="text-red-300 font-black">
                  THRESHOLD BREACHED (+{Math.max(0, zone.currentCount - zone.limitCount)} OVER LIMIT)
                </span>
              ) : (
                <span className="text-emerald-400">
                  THRESHOLD SAFE (Flow Balanced, No Breach Predicted)
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-sans mt-0.5">
              <span className="text-cyan-400 font-mono font-bold">Crowd Flow Vector:</span>
              <span>{zone.crowdFlowDirection || 'Nominal dispersed circulation across zone area'}</span>
            </div>
          </div>
        </div>

        {/* Chokepoint Action Hint */}
        <div className="flex items-center gap-1.5 text-[11px] self-end sm:self-center">
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono">
            {zone.id === 'zone-north-gate' ? 'Chokepoint: 3.2m Neck' : 'Chokepoint: 2.8m Alley'}
          </span>
        </div>
      </div>

      {/* Vital Metrics Grid (Page 6 Wireframe specs) */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-dark-900/40 border-t border-slate-800/80">
        {/* Metric 1: Head Count with EDITABLE CAPACITY LIMIT */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold text-slate-300">Live Count</span>
            {/* Interactive Editable Capacity Limit */}
            <div className="flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700" title="Click to edit approved capacity limit">
              <span className="text-[10px] font-mono text-slate-400">Cap:</span>
              <input
                type="number"
                min="1"
                max="5000"
                value={zone.limitCount}
                onChange={(e) => onUpdateLimit(zone.id, Math.max(1, Number(e.target.value)))}
                className="w-12 bg-dark-950 text-amber-300 font-mono text-[11px] font-bold text-center rounded border border-slate-700 focus:outline-none focus:border-amber-400"
                title="Edit approved safe capacity limit for this zone"
              />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono tracking-tight text-white">
              {config.isConnected ? zone.currentCount : '--'}
            </span>
            <span className="text-xs text-slate-400 font-sans truncate">
              {feedSource === 'SYNTHETIC' 
                ? 'people detected' 
                : `${localizedHeads.length} heads (${localizedHeads.filter(h => h.type === 'NEURAL').length} box + ${localizedHeads.filter(h => h.type === 'DENSE').length} dense)`
              }
            </span>
          </div>

          {/* Quick Capacity Limit Presets */}
          <div className="flex items-center gap-1 mt-1.5 text-[10px] font-mono text-slate-400">
            <span className="text-slate-500">Presets:</span>
            {[30, 40, 50, 100, 600].map(lim => (
              <button
                key={lim}
                onClick={() => { playUiClick(); onUpdateLimit(zone.id, lim); }}
                className={`px-1.5 py-0.5 rounded border transition ${
                  zone.limitCount === lim 
                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 font-bold'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-white'
                }`}
                title={`Set zone capacity limit to ${lim}`}
              >
                {lim}
              </button>
            ))}
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                zone.status === 'RED' ? 'bg-red-500' : (zone.status === 'AMBER' ? 'bg-amber-500' : 'bg-emerald-500')
              }`}
              style={{ width: `${Math.min(100, (zone.currentCount / zone.limitCount) * 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Ground Density (people/m2) */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Calibrated Density</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono tracking-tight text-cyan-300">
              {config.isConnected ? zone.density.toFixed(2) : '--'}
            </span>
            <span className="text-xs text-slate-400 font-mono">ppl/m²</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {zone.density < 1.0 ? 'Comfortable flow' : (zone.density < 2.0 ? 'Dense flow' : 'High crowd pressure')}
          </p>
        </div>

        {/* Metric 3: 60s Trend Slope (people/sec) */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>60s Trend Slope</span>
            {zone.trendSlope > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            ) : zone.trendSlope < 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-bold font-mono tracking-tight ${
              zone.trendSlope > 1 ? 'text-amber-400' : (zone.trendSlope < 0 ? 'text-emerald-400' : 'text-slate-200')
            }`}>
              {config.isConnected ? (zone.trendSlope > 0 ? `+${zone.trendSlope.toFixed(1)}` : zone.trendSlope.toFixed(1)) : '--'}
            </span>
            <span className="text-xs text-slate-400 font-mono">/sec</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {zone.trendSlope > 0 ? 'Accumulating crowd' : 'Stable / Dispersing'}
          </p>
        </div>

        {/* Metric 4: Forecast Time-to-Limit with LIVE MATHEMATICAL FORMULA BREAKDOWN */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Time-to-Limit</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-bold font-mono tracking-tight ${
              zone.secondsToLimit !== null && zone.secondsToLimit <= 60 ? 'text-amber-400 animate-pulse' : 'text-slate-300'
            }`}>
              {config.isConnected ? (zone.secondsToLimit !== null ? `~${zone.secondsToLimit}s` : 'Stable') : '--'}
            </span>
          </div>
          {/* Live Mathematical Formula Breakdown */}
          <p 
            className="text-[10px] font-mono text-cyan-400 mt-1 truncate" 
            title={`Mathematical Formula: (${zone.limitCount} limit - ${zone.currentCount} count) / +${zone.trendSlope > 0 ? zone.trendSlope : 1}/s`}
          >
            {zone.secondsToLimit !== null 
              ? `Formula: (${zone.limitCount}-${zone.currentCount}) / +${zone.trendSlope}/s`
              : `Safe: Count <= ${zone.limitCount}`}
          </p>
        </div>
      </div>

      {/* EMERGENCY INFRASTRUCTURE & LIFE-SAFETY ASSETS (Distances to Extinguishers & Security) */}
      <div className="px-4 py-3 bg-dark-950/80 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
            Nearest Emergency Assets & Life-Safety Distances
          </span>
          <span className="text-[10px] font-mono text-cyan-400">
            HSE Crowd Safety Compliance
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          {/* Fire Extinguisher */}
          <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 flex items-start gap-2">
            <Flame className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 truncate">Fire Extinguisher</div>
              <div className="font-bold text-red-300">
                {zone.id === 'zone-north-gate' ? '18 metres' : '14 metres'}
              </div>
              <div className="text-[9px] text-slate-500 truncate font-sans">
                {zone.id === 'zone-north-gate' ? 'Pillar 4B (Class ABC)' : 'North Kiosk (CO2)'}
              </div>
            </div>
          </div>

          {/* Security Checkpoint */}
          <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 truncate">Security Checkpoint</div>
              <div className="font-bold text-sky-300">
                {zone.id === 'zone-north-gate' ? '22 metres' : '28 metres'}
              </div>
              <div className="text-[9px] text-slate-500 truncate font-sans">
                {zone.id === 'zone-north-gate' ? 'Station Alpha (4 Stewards)' : 'Station Bravo (6 Stewards)'}
              </div>
            </div>
          </div>

          {/* Stampede Relief Diversion Chokepoint */}
          <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 flex items-start gap-2">
            <DoorOpen className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 truncate">Relief Chokepoint</div>
              <div className="font-bold text-amber-300">
                {zone.id === 'zone-north-gate' ? '34 metres' : '45 metres'}
              </div>
              <div className="text-[9px] text-slate-500 truncate font-sans">
                {zone.id === 'zone-north-gate' ? 'Gate E-3 (120 ppl/m)' : 'Gate W-2 (150 ppl/m)'}
              </div>
            </div>
          </div>

          {/* Safe Overflow Area */}
          <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 truncate">Safe Relief Area</div>
              <div className="font-bold text-emerald-300">
                {zone.id === 'zone-north-gate' ? 'East Lawn' : 'Ring Road'}
              </div>
              <div className="text-[9px] text-slate-500 truncate font-sans">
                {zone.id === 'zone-north-gate' ? 'Cap: 3,500 ppl' : 'Cap: 5,000 ppl'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar (Live Testing Controls) */}
      <div className="p-3 bg-dark-950/70 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Surge Simulation (+25) */}
          <button
            onClick={() => {
              playEarlyWarningTone();
              onUpdateCount(zone.id, 25);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition font-medium"
            title="Simulate sudden crowd influx (+25)"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Surge (+25)</span>
          </button>

          {/* Dispersal / Outflow Simulation (-25) */}
          <button
            onClick={() => {
              playUiClick();
              onUpdateCount(zone.id, -25);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition font-medium"
            title="Simulate crowd dispersing / outflow (-25)"
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Disperse (-25)</span>
          </button>

          {/* Stampede Relief Emergency Diversion (-40) */}
          <button
            onClick={() => {
              playEarlyWarningTone();
              onUpdateCount(zone.id, -40);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 transition font-medium"
            title="Trigger emergency stampede diversion to relief area (-40)"
          >
            <DoorOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Divert to Relief Area (-40)</span>
          </button>

          {/* Reset to Normal Safe Baseline */}
          <button
            onClick={() => {
              playUiClick();
              onResetBaseline(zone.id);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition font-medium"
            title="Reset crowd count & trend back to calm safe baseline"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Normal Baseline</span>
          </button>

          {/* Calibrate Zone Area */}
          <button
            onClick={() => { playUiClick(); onSelectCalibration(zone.id); }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Calibrate ROI</span>
          </button>
        </div>

        {/* Disconnect Feed Simulator */}
        <button
          onClick={() => {
            playUiClick();
            onToggleConnection(config.id);
          }}
          className={`px-3 py-1.5 rounded-lg font-mono font-medium transition flex items-center gap-1.5 ${
            config.isConnected
              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}
          title="Disconnect feed to test UNKNOWN/STALE fail-safe state"
        >
          {config.isConnected ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
          <span>{config.isConnected ? 'Test Cut Feed' : 'Reconnect Feed'}</span>
        </button>
      </div>

      {/* Video & Camera Source Ingest Modal */}
      {showSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-2xl glass-panel border border-slate-700 p-6 shadow-2xl bg-dark-900/95 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Connect Video Feed / CCTV</h3>
                  <p className="text-xs text-slate-400">Select input source for {zone.name}</p>
                </div>
              </div>
              <button
                onClick={() => { playUiClick(); setShowSourceModal(false); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options Tabs */}
            <div className="space-y-4 text-xs">
              {/* Option 1: Upload Local CCTV Video */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 transition space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2 text-sm">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    1. Upload Local CCTV Footage (MP4 / WebM / MOV)
                  </span>
                  {feedSource === 'LOCAL_VIDEO' && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-xs">
                  Pick any crowd video file from your Mac. Automatically switches to dense shoulder-to-shoulder texture analysis to count packed festival crowds accurately.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold border border-cyan-500/40 flex items-center gap-2 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploadedVideoName ? 'Replace Video File' : 'Select Video File'}</span>
                  </button>
                  {uploadedVideoName && (
                    <span className="text-xs font-mono text-slate-300 truncate max-w-xs">
                      📁 {uploadedVideoName}
                    </span>
                  )}
                </div>
              </div>

              {/* Option 2: Live Webcam / USB Camera */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 transition space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2 text-sm">
                    <Camera className="w-4 h-4 text-purple-400" />
                    2. Live Webcam / Connected USB Camera
                  </span>
                  {feedSource === 'WEBCAM' && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-xs">
                  Stream from your Mac's built-in FaceTime HD camera, external USB webcam, or iPhone via Continuity Camera. Detects real people standing in front of the lens.
                </p>
                <div className="space-y-2">
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
                  >
                    {availableCameras.length > 0 ? (
                      availableCameras.map(cam => (
                        <option key={cam.deviceId} value={cam.deviceId}>
                          {cam.label || `Camera Device (${cam.deviceId.slice(0, 8)}...)`}
                        </option>
                      ))
                    ) : (
                      <option value="">Default System Camera</option>
                    )}
                  </select>

                  <button
                    onClick={() => {
                      playUiClick();
                      setFeedSource('WEBCAM');
                      onUpdateSource(config.id, 'WEBCAM');
                      setShowSourceModal(false);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-semibold border border-purple-500/40 flex items-center gap-2 transition"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Connect & Activate Webcam</span>
                  </button>
                </div>
              </div>

              {/* Option 3: Network RTSP / HTTP Video Stream */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 transition space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-amber-400" />
                    3. Network Video Stream URL
                  </span>
                  {feedSource === 'NETWORK_STREAM' && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-xs">
                  Connect to a remote CCTV video link, IP webcam stream, or sample web video.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={streamInputDraft}
                    onChange={(e) => setStreamInputDraft(e.target.value)}
                    placeholder="https://.../stream.mp4 or http://192.168.x.x:8080/video"
                    className="w-full bg-slate-800 border border-slate-700 text-white font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => {
                      playUiClick();
                      setNetworkStreamUrl(streamInputDraft);
                      setFeedSource('NETWORK_STREAM');
                      onUpdateSource(config.id, 'NETWORK_STREAM');
                      setShowSourceModal(false);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/40 flex items-center gap-2 transition"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Connect Network Stream</span>
                  </button>
                </div>
              </div>

              {/* Option 4: Switch Back to Calibrated Simulation */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    4. Synthetic Calibrated Festival Simulator
                  </span>
                  {feedSource === 'SYNTHETIC' && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-xs">
                  Switch back to the built-in mathematical simulation with surge/disperse controls.
                </p>
                <button
                  onClick={() => {
                    playUiClick();
                    setFeedSource('SYNTHETIC');
                    onUpdateSource(config.id, 'SYNTHETIC');
                    setShowSourceModal(false);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/40 flex items-center gap-2 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Activate Simulation Mode</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                onClick={() => { playUiClick(); setShowSourceModal(false); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
