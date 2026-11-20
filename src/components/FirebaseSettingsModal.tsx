import React, { useState } from 'react';
import { FirebaseConnectionConfig } from '../types';
import { firebaseService } from '../services/firebase';
import { 
  Flame, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  X, 
  Database, 
  ExternalLink 
} from 'lucide-react';
import { playUiClick, playRadioSquelch } from '../utils/audio';

interface FirebaseSettingsModalProps {
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const FirebaseSettingsModal: React.FC<FirebaseSettingsModalProps> = ({
  onClose,
  onConfigUpdated
}) => {
  const currentConfig = firebaseService.getConfig();
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [projectId, setProjectId] = useState(currentConfig.projectId || '');
  const [authDomain, setAuthDomain] = useState(currentConfig.authDomain || '');
  const [statusMessage, setStatusMessage] = useState<{ text: string; success: boolean } | null>(null);

  const handleSave = () => {
    playRadioSquelch();
    const success = firebaseService.saveConfig({
      apiKey,
      projectId,
      authDomain: authDomain || (projectId ? `${projectId}.firebaseapp.com` : '')
    });

    if (success) {
      setStatusMessage({ text: 'Firebase Configuration Saved & Activated!', success: true });
      onConfigUpdated();
      setTimeout(() => {
        onClose();
      }, 900);
    } else {
      setStatusMessage({ text: 'Failed to initialize Firebase with provided credentials', success: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-2xl glass-panel border border-slate-700 p-6 shadow-2xl bg-dark-900/95 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Firebase Cloud Backend</h3>
              <p className="text-xs text-slate-400">Sync live crowd counts and audit logs to Firestore</p>
            </div>
          </div>
          <button
            onClick={() => { playUiClick(); onClose(); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connection Status Pill */}
        <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
          firebaseService.isConnected() 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
        }`}>
          {firebaseService.isConnected() ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Connected to Firestore ({firebaseService.getConfig().projectId})</span>
            </>
          ) : (
            <>
              <Database className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Running in Zero-Lag Local Edge Mode. Paste credentials to link live cloud.</span>
            </>
          )}
        </div>

        {/* Form Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Project ID:</label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="e.g. crowdwatch-fest-ops"
              className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Web API Key:</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Auth Domain (optional):</label>
            <input
              type="text"
              value={authDomain}
              onChange={(e) => setAuthDomain(e.target.value)}
              placeholder="project-id.firebaseapp.com"
              className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {statusMessage && (
          <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
            statusMessage.success ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
          }`}>
            {statusMessage.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
          <button
            onClick={() => { playUiClick(); onClose(); }}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20"
          >
            <Save className="w-4 h-4" />
            <span>Save & Connect</span>
          </button>
        </div>
      </div>
    </div>
  );
};
