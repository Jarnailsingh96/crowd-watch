import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface DetectedPerson {
  bbox: [number, number, number, number]; // [x, y, width, height]
  score: number;
  centerX: number;
  centerY: number;
}

export interface DetectionResult {
  peopleCount: number;
  detectedPeople: DetectedPerson[];
  densityScore: number;
  inferenceTimeMs: number;
}

class AiDetectorService {
  private model: cocoSsd.ObjectDetection | null = null;
  private isLoading = false;
  private isReady = false;

  public async init(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    try {
      // Ensure WebGL backend is initialized for hardware-accelerated GPU inference
      await tf.ready();
      console.log('TensorFlow.js Backend:', tf.getBackend());
      
      // Load COCO-SSD model (lite mobilenet v2 backend for real-time 5-10 FPS performance)
      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2'
      });
      this.isReady = true;
      this.isLoading = false;
      console.log('AI Crowd Detection Model (COCO-SSD) loaded successfully!');
      return true;
    } catch (err) {
      console.error('Failed to load TensorFlow.js model:', err);
      this.isLoading = false;
      return false;
    }
  }

  public isModelLoaded(): boolean {
    return this.isReady;
  }

  /**
   * Run real neural network person detection on a HTMLVideoElement or HTMLCanvasElement
   */
  public async detectPeople(
    element: HTMLVideoElement | HTMLCanvasElement,
    minConfidence: number = 0.35
  ): Promise<DetectionResult> {
    const startTime = performance.now();

    if (!this.model || !this.isReady) {
      // Lazy load model if not yet ready
      await this.init();
      if (!this.model) {
        return { peopleCount: 0, detectedPeople: [], densityScore: 0, inferenceTimeMs: 0 };
      }
    }

    try {
      const predictions = await this.model.detect(element, 100, minConfidence);
      const personPredictions = predictions.filter(p => p.class === 'person');

      const width = element instanceof HTMLVideoElement ? (element.videoWidth || 640) : element.width;
      const height = element instanceof HTMLVideoElement ? (element.videoHeight || 360) : element.height;

      const detectedPeople: DetectedPerson[] = personPredictions.map(p => {
        const [x, y, w, h] = p.bbox;
        return {
          bbox: p.bbox,
          score: p.score,
          centerX: (x + w / 2) / width,
          centerY: (y + h / 2) / height
        };
      });

      const inferenceTimeMs = Math.round(performance.now() - startTime);

      return {
        peopleCount: detectedPeople.length,
        detectedPeople,
        densityScore: detectedPeople.length > 0 ? Number((detectedPeople.length / 50).toFixed(2)) : 0,
        inferenceTimeMs
      };
    } catch (err) {
      console.warn('Inference error on frame:', err);
      return { peopleCount: 0, detectedPeople: [], densityScore: 0, inferenceTimeMs: 0 };
    }
  }
}

export const aiDetectorService = new AiDetectorService();
