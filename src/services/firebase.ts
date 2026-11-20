import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  Firestore 
} from 'firebase/firestore';
import { Zone, AlertEvent, FirebaseConnectionConfig } from '../types';

const STORAGE_KEY = 'crowdwatch_firebase_config';

// Default configuration placeholder
const defaultFirebaseConfig: FirebaseConnectionConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  isConfigured: false,
  syncLive: false
};

class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private config: FirebaseConnectionConfig = defaultFirebaseConfig;

  constructor() {
    this.loadSavedConfig();
  }

  public loadSavedConfig(): FirebaseConnectionConfig {
    if (typeof window === 'undefined') return this.config;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.config = JSON.parse(saved);
        if (this.config.apiKey && this.config.projectId) {
          this.initFirebase(this.config);
        }
      }
    } catch (e) {
      console.warn("Failed to load Firebase config from localStorage", e);
    }
    return this.config;
  }

  public saveConfig(newConfig: Partial<FirebaseConnectionConfig>): boolean {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      if (this.config.apiKey && this.config.projectId) {
        return this.initFirebase(this.config);
      }
      return true;
    } catch (e) {
      console.error("Failed to save Firebase config", e);
      return false;
    }
  }

  private initFirebase(cfg: FirebaseConnectionConfig): boolean {
    try {
      if (!getApps().length) {
        this.app = initializeApp({
          apiKey: cfg.apiKey,
          authDomain: cfg.authDomain || `${cfg.projectId}.firebaseapp.com`,
          projectId: cfg.projectId,
          storageBucket: cfg.storageBucket || `${cfg.projectId}.appspot.com`,
          messagingSenderId: cfg.messagingSenderId,
          appId: cfg.appId
        });
      } else {
        this.app = getApps()[0];
      }
      this.db = getFirestore(this.app);
      this.config.isConfigured = true;
      this.config.syncLive = true;
      console.log("Firebase initialized successfully for project:", cfg.projectId);
      return true;
    } catch (err) {
      console.error("Firebase initialization failed:", err);
      this.config.isConfigured = false;
      return false;
    }
  }

  public isConnected(): boolean {
    return Boolean(this.db && this.config.syncLive);
  }

  public getConfig(): FirebaseConnectionConfig {
    return this.config;
  }

  /**
   * Sync Zone Real-Time State to Firestore
   */
  public async syncZoneState(zone: Zone): Promise<void> {
    if (!this.db || !this.config.syncLive) {
      // Local fallback in localStorage
      this.localSaveZone(zone);
      return;
    }

    try {
      const zoneRef = doc(this.db, 'zones', zone.id);
      await setDoc(zoneRef, {
        ...zone,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.warn("Firestore syncZoneState error, fallback to local:", err);
      this.localSaveZone(zone);
    }
  }

  /**
   * Log an Alert Incident to Firestore
   */
  public async logAlertIncident(alert: AlertEvent): Promise<string> {
    if (!this.db || !this.config.syncLive) {
      this.localSaveAlert(alert);
      return alert.id;
    }

    try {
      const colRef = collection(this.db, 'incidents');
      const docRef = await addDoc(colRef, alert);
      return docRef.id;
    } catch (err) {
      console.warn("Firestore logAlertIncident error, fallback to local:", err);
      this.localSaveAlert(alert);
      return alert.id;
    }
  }

  /**
   * Operator Acknowledges Incident
   */
  public async acknowledgeAlert(
    alertId: string, 
    operatorNotes: string = "Verified on CCTV feed",
    actionTaken: AlertEvent['actionTaken'] = 'SUPERVISOR_NOTIFIED'
  ): Promise<void> {
    const timestamp = Date.now();

    if (!this.db || !this.config.syncLive) {
      this.localAcknowledgeAlert(alertId, operatorNotes, actionTaken, timestamp);
      return;
    }

    try {
      const alertRef = doc(this.db, 'incidents', alertId);
      await updateDoc(alertRef, {
        acknowledged: true,
        acknowledgedAt: timestamp,
        operatorNotes,
        actionTaken
      });
    } catch (err) {
      console.warn("Firestore acknowledgeAlert error, updating local state:", err);
      this.localAcknowledgeAlert(alertId, operatorNotes, actionTaken, timestamp);
    }
  }

  // Local Storage Fallback Handlers
  private localSaveZone(zone: Zone) {
    try {
      const key = `crowdwatch_zone_${zone.id}`;
      localStorage.setItem(key, JSON.stringify(zone));
    } catch {
      // Ignore quota errors
    }
  }

  private localSaveAlert(alert: AlertEvent) {
    try {
      const existing: AlertEvent[] = JSON.parse(localStorage.getItem('crowdwatch_alerts') || '[]');
      // Avoid duplicate alert spam for same zone within 5 seconds
      const recent = existing.find(a => a.zoneId === alert.zoneId && Math.abs(a.timestamp - alert.timestamp) < 5000);
      if (!recent) {
        existing.unshift(alert);
        localStorage.setItem('crowdwatch_alerts', JSON.stringify(existing.slice(0, 50)));
      }
    } catch {
      // Ignore
    }
  }

  private localAcknowledgeAlert(alertId: string, notes: string, action: AlertEvent['actionTaken'], time: number) {
    try {
      const existing: AlertEvent[] = JSON.parse(localStorage.getItem('crowdwatch_alerts') || '[]');
      const index = existing.findIndex(a => a.id === alertId);
      if (index !== -1) {
        existing[index].acknowledged = true;
        existing[index].acknowledgedAt = time;
        existing[index].operatorNotes = notes;
        existing[index].actionTaken = action;
        localStorage.setItem('crowdwatch_alerts', JSON.stringify(existing));
      }
    } catch {
      // Ignore
    }
  }
}

export const firebaseService = new FirebaseService();
