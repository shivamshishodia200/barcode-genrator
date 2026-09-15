import React, { useState, useEffect } from 'react';
import { SerialReservation } from '../../types';
import { AtomicSerialReservationService } from '../../services/serializationEngine';
import { X, AlertTriangle, CheckCircle2, RotateCcw, RefreshCw, Eye, ShieldAlert, FileText } from 'lucide-react';

interface SerializationRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReprintReservation?: (reservation: SerialReservation) => void;
  onReprintRemaining?: (reservation: SerialReservation) => void;
  onRefreshAppState?: () => void;
}

export const SerializationRecoveryModal: React.FC<SerializationRecoveryModalProps> = ({
  isOpen,
  onClose,
  onReprintReservation,
  onReprintRemaining,
  onRefreshAppState,
}) => {
  const [orphans, setOrphans] = useState<SerialReservation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedOrphan, setSelectedOrphan] = useState<SerialReservation | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const fetchOrphans = async () => {
    setLoading(true);
    try {
      const list = await AtomicSerialReservationService.getPendingOrphanReservations();
      setOrphans(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOrphans();
      setActionSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRollback = async (reservation: SerialReservation) => {
    const confirmed = window.confirm(
      `Rollback Serial Reservation:\n\nRange: ${reservation.startValue} -> ${reservation.endValue} (${reservation.count} items)\nJob ID: ${reservation.jobId}\n\nRolling back will release these serial numbers without consuming them.\nAre you sure?`
    );
    if (!confirmed) return;

    await AtomicSerialReservationService.resolveOrphan(
      reservation.id,
      'rollback',
      'Operator confirmed rollback from Recovery Center'
    );
    setActionSuccessMessage(`Reservation ${reservation.id} rolled back successfully.`);
    fetchOrphans();
    if (onRefreshAppState) onRefreshAppState();
  };

  const handleMarkPrinted = async (reservation: SerialReservation) => {
    const confirmed = window.confirm(
      `Mark as Printed:\n\nRange: ${reservation.startValue} -> ${reservation.endValue} (${reservation.count} items)\n\nThis will advance the persistent counter to ${reservation.endValue} and mark the range as consumed.\nConfirm?`
    );
    if (!confirmed) return;

    await AtomicSerialReservationService.resolveOrphan(
      reservation.id,
      'mark_printed',
      'Operator confirmed mark as printed from Recovery Center'
    );
    setActionSuccessMessage(`Reservation ${reservation.id} marked as committed.`);
    fetchOrphans();
    if (onRefreshAppState) onRefreshAppState();
  };

  const handleResumeReprint = (reservation: SerialReservation) => {
    if (onReprintReservation) {
      onReprintReservation(reservation);
      onClose();
    } else {
      alert(`Reprint Remaining requested for reservation range ${reservation.startValue} -> ${reservation.endValue}.`);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans select-none animate-in fade-in duration-100">
      <div
        className="w-[820px] max-w-full bg-white rounded-xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-300" />
            <div>
              <span className="font-bold text-[13.5px]">Serialization Recovery Center</span>
              <p className="text-[10.5px] text-amber-200">
                Crash & Unresolved Serial Range Reconciliation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-6 flex items-center justify-center hover:bg-white/20 text-white rounded cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Message Banner */}
        {actionSuccessMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-emerald-800 flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-[11.5px] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Unresolved Serialization Reservations Detected</span>
            </div>
            <p>
              These serial ranges were reserved for printing but did not receive a final completion confirmation (e.g. application restart, spooler timeout, or power interruption).
            </p>
            <p className="text-[11px] text-amber-800">
              Review each reservation below to either <strong>Rollback</strong> (reuse numbers), <strong>Mark as Printed</strong> (commit numbers), or <strong>Resume / Reprint</strong>.
            </p>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
              <p className="text-xs">Scanning serial reservations database...</p>
            </div>
          ) : orphans.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="font-semibold text-slate-800 text-sm">All Serialization Sequences Reconciled</p>
              <p className="text-xs text-slate-500 max-w-md">
                There are no pending, orphaned, or interrupted serial reservations. All ranges have been committed cleanly.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11.5px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="p-2 border-r border-slate-200">Job ID</th>
                    <th className="p-2 border-r border-slate-200">Source</th>
                    <th className="p-2 border-r border-slate-200 font-mono">Serial Range</th>
                    <th className="p-2 border-r border-slate-200 text-center w-16">Count</th>
                    <th className="p-2 border-r border-slate-200">Status</th>
                    <th className="p-2 border-r border-slate-200">Reserved At</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orphans.map((res) => (
                    <tr key={res.id} className="border-b border-slate-200 hover:bg-amber-50/50">
                      <td className="p-2 border-r border-slate-200 font-mono font-medium text-slate-900">{res.jobId || res.id}</td>
                      <td className="p-2 border-r border-slate-200 text-slate-700">{res.sourceId}</td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-amber-900">
                        {res.startValue} → {res.endValue}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono font-semibold">{res.count}</td>
                      <td className="p-2 border-r border-slate-200">
                        <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                          {res.status}
                        </span>
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-500 text-[10.5px]">
                        {new Date(res.createdAt).toLocaleString()}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleResumeReprint(res)}
                            title="Reprint / Resume Range"
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-medium text-[10.5px] cursor-pointer"
                          >
                            Reprint
                          </button>
                          <button
                            onClick={() => handleMarkPrinted(res)}
                            title="Mark range as printed and advance counter"
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-medium text-[10.5px] cursor-pointer"
                          >
                            Commit
                          </button>
                          <button
                            onClick={() => handleRollback(res)}
                            title="Rollback unprinted reservation"
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-medium text-[10.5px] cursor-pointer"
                          >
                            Rollback
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
          <button
            onClick={fetchOrphans}
            className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Scan</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11.5px] font-semibold cursor-pointer shadow-2xs"
          >
            Close Recovery Center
          </button>
        </div>
      </div>
    </div>
  );
};
