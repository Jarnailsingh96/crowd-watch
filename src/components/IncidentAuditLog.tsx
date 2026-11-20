import React from 'react';
import { AlertEvent } from '../types';
import { 
  History, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Flame, 
  Radio 
} from 'lucide-react';
import { playUiClick } from '../utils/audio';

interface IncidentAuditLogProps {
  alerts: AlertEvent[];
}

export const IncidentAuditLog: React.FC<IncidentAuditLogProps> = ({ alerts }) => {
  // Export CSV summary requested on Page 6
  const exportToCSV = () => {
    playUiClick();
    if (alerts.length === 0) return;

    const headers = ['Timestamp', 'Time', 'Zone', 'Status', 'Count', 'Density (ppl/m2)', 'Trend (/s)', 'Acknowledged', 'Acknowledged Time', 'Action Taken', 'Notes'];
    const rows = alerts.map(a => [
      a.timestamp,
      new Date(a.timestamp).toISOString(),
      `"${a.zoneName}"`,
      a.status,
      a.count,
      a.density,
      a.trendSlope,
      a.acknowledged ? 'YES' : 'NO',
      a.acknowledgedAt ? new Date(a.acknowledgedAt).toISOString() : 'N/A',
      `"${a.actionTaken || 'N/A'}"`,
      `"${(a.operatorNotes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crowdwatch_incident_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-2xl glass-panel border border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-800 text-cyan-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Incident & Operator Audit Trail</h3>
            <p className="text-xs text-slate-400">Immutable chronological log of all warnings, surges, and steward radio actions</p>
          </div>
        </div>

        <button
          onClick={exportToCSV}
          disabled={alerts.length === 0}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Export Audit CSV</span>
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-xs">
          No incident events recorded yet. Alerts triggered by crowd build-ups or feed disconnects will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-dark-900/80 uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-800 font-mono">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Zone</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Count</th>
                <th className="py-2.5 px-3">Density</th>
                <th className="py-2.5 px-3">Trend</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Operator Action & Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 font-sans font-medium text-white">
                    {alert.zoneName}
                  </td>
                  <td className="py-2.5 px-3">
                    {alert.status === 'RED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-800">
                        <Flame className="w-3 h-3" /> LIMIT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800">
                        <AlertTriangle className="w-3 h-3" /> WARNING
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-white font-bold">{alert.count}</td>
                  <td className="py-2.5 px-3 text-cyan-300">{alert.density} m²</td>
                  <td className="py-2.5 px-3 text-amber-300">+{alert.trendSlope}/s</td>
                  <td className="py-2.5 px-3">
                    {alert.acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] animate-pulse">
                        <Clock className="w-3.5 h-3.5" /> Unhandled
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-xs text-slate-300">
                    {alert.actionTaken ? (
                      <div className="flex flex-col">
                        <span className="font-semibold text-cyan-400">{alert.actionTaken}</span>
                        {alert.operatorNotes && (
                          <span className="text-slate-400 text-[11px] italic truncate max-w-xs">"{alert.operatorNotes}"</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
