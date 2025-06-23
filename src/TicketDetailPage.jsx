import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

// Helper: get initials from name
function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// Helper: format duration
function formatDuration(dur) {
  if (!dur) return "-";
  if (typeof dur === "string") return dur;
  const d = Math.floor(dur / 24);
  const h = dur % 24;
  return `${d ? d + "d " : ""}${h ? h + "h" : ""}`.trim();
}

// Helper to map status to new status-* classes
const statusPillClass = status => {
  switch (status) {
    case "In Progress":
      return "status-in-progress";
    case "Blocked":
      return "status-blocked";
    case "Done":
      return "status-done";
    case "To Do":
      return "status-to-do";
    case "Backlog":
      return "status-to-do";
    default:
      return "status-to-do";
  }
};

export default function TicketDetailPage({ tickets = [], loading }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const ticketIdx = tickets.findIndex((t) => t.id?.toString() === id);
  const ticket = tickets[ticketIdx] || {};

  // --- DYNAMIC DATA DERIVATION FROM eventLogParsed ---
  const eventLogParsed = ticket.eventLogParsed || [];

  // 4.1 Build statusHistory
  const statusHistory = (() => {
    if (!eventLogParsed.length) return [];
    const phases = [];
    let prev = null;
    for (let i = 0; i < eventLogParsed.length; i++) {
      const ev = eventLogParsed[i];
      if (ev.status && (!prev || ev.status !== prev.status)) {
        if (prev) {
          phases[phases.length - 1].end = ev.timestamp;
        }
        phases.push({
          status: ev.status,
          start: ev.timestamp,
          end: null,
          by: ev.by || ev.user || ev.owner || "?"
        });
      }
      prev = ev;
    }
    // Set end for last phase
    if (phases.length) {
      const last = phases[phases.length - 1];
      if (!last.end) {
        last.end = (ticket.status === 'Done' || ticket.status === 'Deployed') ? null : new Date();
      }
    }
    // Calculate durationH
    return phases.map((phase, idx) => {
      const start = phase.start ? new Date(phase.start) : null;
      const end = phase.end ? new Date(phase.end) : (ticket.status === 'Done' || ticket.status === 'Deployed' ? null : new Date());
      let durationH = null;
      if (start && end) durationH = Math.max(1, Math.round((end - start) / 36e5));
      return { ...phase, start, end, durationH, idx };
    });
  })();

  // 4.2 Build blockerLog
  const blockerLog = (() => {
    if (!eventLogParsed.length) return [];
    const blocks = [];
    let currentBlock = null;
    for (let i = 0; i < eventLogParsed.length; i++) {
      const ev = eventLogParsed[i];
      if (ev.status === 'Blocked') {
        currentBlock = {
          blockedBy: ev.blockedBy || ev.by || ev.user || "?",
          reason: ev.reason || ev.note || '',
          since: ev.timestamp,
          resumedAt: null,
          duration: null
        };
      } else if (currentBlock && ev.status !== 'Blocked') {
        currentBlock.resumedAt = ev.timestamp;
        // Calculate duration
        if (currentBlock.since && currentBlock.resumedAt) {
          const ms = new Date(currentBlock.resumedAt) - new Date(currentBlock.since);
          const d = Math.floor(ms / 36e5 / 24);
          const h = Math.round((ms / 36e5) % 24);
          currentBlock.duration = `${d ? d + 'd ' : ''}${h}h`;
        }
        blocks.push(currentBlock);
        currentBlock = null;
      }
    }
    // If still blocked
    if (currentBlock && !currentBlock.resumedAt) {
      currentBlock.resumedAt = null;
      if (currentBlock.since) {
        const ms = new Date() - new Date(currentBlock.since);
        const d = Math.floor(ms / 36e5 / 24);
        const h = Math.round((ms / 36e5) % 24);
        currentBlock.duration = `${d ? d + 'd ' : ''}${h}h`;
      }
      blocks.push(currentBlock);
    }
    return blocks;
  })();

  // 4.3 Build statusLog
  const statusLog = (() => {
    if (!eventLogParsed.length) return [];
    const logs = [];
    let prevStatus = null;
    for (let i = 0; i < eventLogParsed.length; i++) {
      const ev = eventLogParsed[i];
      if (ev.status && prevStatus && ev.status !== prevStatus) {
        logs.push({
          timestamp: ev.timestamp,
          from: prevStatus,
          to: ev.status,
          by: ev.by || ev.user || ev.owner || "?"
        });
      }
      if (ev.status) prevStatus = ev.status;
    }
    return logs;
  })();

  // 4.4 Build handoffs
  const handoffs = (() => {
    if (!eventLogParsed.length) return [];
    const owners = [];
    let lastOwner = null;
    for (let i = 0; i < eventLogParsed.length; i++) {
      const ev = eventLogParsed[i];
      const owner = ev.owner || ev.by || ev.user || null;
      if (owner && owner !== lastOwner) {
        owners.push(owner);
        lastOwner = owner;
      }
    }
    return [...new Set(owners)];
  })();

  const owner = ticket.owner || handoffs[handoffs.length - 1] || "?";

  // --- Timeline calculation ---
  const timelinePhases = statusHistory.map((phase, idx) => {
    const start = new Date(phase.start);
    const end = phase.end ? new Date(phase.end) : new Date();
    const durationH = Math.max(1, Math.round((end - start) / (1000 * 60 * 60)));
    return { ...phase, durationH, idx };
  });
  const totalH = timelinePhases.reduce((sum, p) => sum + p.durationH, 0);

  // --- Blocker Log expand/collapse ---
  const [expandedBlocker, setExpandedBlocker] = useState(null);

  // --- Navigation ---
  const prevId = tickets[ticketIdx - 1]?.id;
  const nextId = tickets[ticketIdx + 1]?.id;

  // --- High-level stats ---
  const devH = ticket.calculatedTotalTimeInDevHours;
  const blockedH = ticket.calculatedTotalTimeBlockedHours;
  const cycleH = ticket.totalCycleTimeHours;
  const percentBlocked = (cycleH && blockedH != null) ? Math.round((blockedH / cycleH) * 100) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* High-Level Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-8 mb-8">
        <h2 className="text-lg font-semibold text-neutral-700 mb-6">Ticket Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-sm text-neutral-600 mb-1">Time in Dev</div>
            <div className="text-2xl font-bold text-blue-600">{devH != null ? devH + 'h' : '-'}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-neutral-600 mb-1">Time Blocked</div>
            <div className="text-2xl font-bold text-red-600">{blockedH != null ? blockedH + 'h' : '-'}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-neutral-600 mb-1">Total Cycle Time</div>
            <div className="text-2xl font-bold text-green-600">{cycleH != null ? cycleH + 'h' : '-'}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-neutral-600 mb-1">% Time Blocked</div>
            <div className="text-2xl font-bold text-orange-600">{percentBlocked != null ? percentBlocked + '%' : '-'}</div>
          </div>
        </div>
      </div>

      {/* Top: Title, Status, Owner, Handoffs */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-3xl font-bold text-neutral-800">{ticket.title || `Ticket #${id}`}</h1>
              <span className={`inline-block px-3 py-1 rounded-full border text-sm font-semibold ${statusPillClass(ticket.status)}`}>{ticket.status || statusPhases[statusPhases.length-1]?.status}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-neutral-700">Owner:</span>
              <span className="inline-flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 border-2 border-blue-200">
                  {getInitials(owner)}
                </span>
                <span className="text-lg">{owner}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start lg:items-end gap-4">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-neutral-700">Handoffs:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {handoffs.map((h, i) => (
                  <span key={h} className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold border border-blue-200">
                    {h}
                    {i < handoffs.length - 1 && <span className="mx-2">→</span>}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-sm text-neutral-500">Total handoffs: {handoffs.length - 1}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          className="px-6 py-3 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-50 transition-colors font-semibold"
          onClick={() => prevId && navigate(`/tickets/${prevId}`)}
          disabled={!prevId}
        >
          ← Previous
        </button>
        <button
          className="px-6 py-3 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-50 transition-colors font-semibold"
          onClick={() => nextId && navigate(`/tickets/${nextId}`)}
          disabled={!nextId}
        >
          Next →
        </button>
      </div>

      {/* Timeline Visualization */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-8 mb-8">
        <h2 className="text-xl font-semibold text-neutral-700 mb-6">Status Timeline</h2>
        <div className="flex items-center gap-2 w-full relative">
          {/* Start label */}
          <span className="absolute left-0 -top-8 text-sm font-semibold whitespace-nowrap text-neutral-700">
            {timelinePhases[0]?.start ? new Date(timelinePhases[0].start).toLocaleString() : ''}
          </span>
          {/* End label */}
          <span className="absolute right-0 -top-8 text-sm font-semibold whitespace-nowrap text-neutral-700">
            {timelinePhases[timelinePhases.length-1]?.end ? new Date(timelinePhases[timelinePhases.length-1].end).toLocaleString() : 'now'}
          </span>
          {/* Timeline segments */}
          {timelinePhases.map((phase, idx) => {
            const phaseClass = statusPillClass(phase.status).replace('status-', 'bg-status-');
            const nextPhase = timelinePhases[idx + 1];
            return (
              <div
                key={idx}
                className={`relative group h-10 rounded-lg ${phaseClass} flex items-center justify-center shadow-sm`}
                style={{ flex: `${phase.durationH} ${phase.durationH} 0%`, minWidth: '40px' }}
              >
                <span className="absolute left-1/2 -translate-x-1/2 -top-8 text-sm font-semibold whitespace-nowrap text-neutral-700">
                  {phase.status}
                </span>
                {/* Improved tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 opacity-0 transition-opacity bg-neutral-800 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg">
                  <div><span className="font-semibold">Status:</span> {phase.status}</div>
                  <div><span className="font-semibold">Start:</span> {phase.start ? new Date(phase.start).toLocaleString() : '-'}</div>
                  <div><span className="font-semibold">End:</span> {phase.end ? new Date(phase.end).toLocaleString() : 'now'}</div>
                  <div><span className="font-semibold">Duration:</span> {phase.durationH != null ? formatDuration(phase.durationH) : '-'}</div>
                </div>
                {/* Separator for phase transition */}
                {nextPhase && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-neutral-300 border-2 border-white z-20 shadow-sm"></span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Blocker Log */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-700">Blocker Log</h2>
          <span className="text-sm text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">{blockerLog.length} event(s)</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {blockerLog.map((b, i) => (
            <div key={i} className="py-4">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-status-blocked text-lg">{b.blockedBy}</span>
                <span className="text-sm text-neutral-500">{b.since ? new Date(b.since).toLocaleString() : '-'} → {b.resumedAt ? new Date(b.resumedAt).toLocaleString() : 'now'}</span>
                <span className="text-sm text-neutral-700 font-semibold bg-neutral-100 px-2 py-1 rounded">Duration: {b.duration || '-'}</span>
                <button
                  className="ml-auto border border-neutral-300 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 rounded-lg px-4 py-2 text-sm transition-all font-medium"
                  onClick={() => setExpandedBlocker(expandedBlocker === i ? null : i)}
                >
                  {expandedBlocker === i ? "Hide Reason" : "Show Reason"}
                </button>
              </div>
              {expandedBlocker === i && (
                <div className="mt-4 bg-neutral-50 rounded-lg p-4 text-sm text-neutral-700 border border-neutral-200">
                  {b.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status Change Log */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-8 mb-8">
        <h2 className="text-xl font-semibold text-neutral-700 mb-6">Status Change Log</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-neutral-100 text-neutral-700 text-left">
                <th className="px-6 py-3 font-semibold">Timestamp</th>
                <th className="px-6 py-3 font-semibold">Old Status</th>
                <th className="px-6 py-3 font-semibold">New Status</th>
                <th className="px-6 py-3 font-semibold">By</th>
              </tr>
            </thead>
            <tbody>
              {statusLog.map((log, i) => (
                <tr key={i} className="border-t border-neutral-200 hover:bg-neutral-50">
                  <td className="px-6 py-4">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4">{log.from}</td>
                  <td className="px-6 py-4">{log.to}</td>
                  <td className="px-6 py-4">{log.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 