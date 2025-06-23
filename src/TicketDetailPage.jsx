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
    <div className="max-w-3xl mx-auto space-y-8 px-4 md:px-0">
      {/* High-Level Stats */}
      <div className="bg-neutral-100 rounded-lg shadow-sm p-6 mb-6 flex flex-wrap gap-6 items-center">
        <div>
          <div className="text-xs text-neutral-500">Time in Dev</div>
          <div className="text-lg font-bold">{devH != null ? devH + 'h' : '-'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">Time Blocked</div>
          <div className="text-lg font-bold">{blockedH != null ? blockedH + 'h' : '-'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">Total Cycle Time</div>
          <div className="text-lg font-bold">{cycleH != null ? cycleH + 'h' : '-'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">% Time Blocked</div>
          <div className="text-lg font-bold">{percentBlocked != null ? percentBlocked + '%' : '-'}</div>
        </div>
      </div>

      {/* Top: Title, Status, Owner, Handoffs */}
      <div className="bg-neutral-100 rounded-lg shadow-sm p-6 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-neutral-800">{ticket.title || `Ticket #${id}`}</h1>
            <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${statusPillClass(ticket.status)}`}>{ticket.status || statusPhases[statusPhases.length-1]?.status}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-semibold">Owner:</span>
            <span className="inline-flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-lg font-bold text-gray-700">
                {getInitials(owner)}
              </span>
              <span>{owner}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Handoffs:</span>
            <div className="flex items-center gap-1">
              {handoffs.map((h, i) => (
                <span key={h} className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200">
                  {h}
                  {i < handoffs.length - 1 && <span className="mx-1">→</span>}
                </span>
              ))}
            </div>
          </div>
          <span className="text-xs text-neutral-500">Total handoffs: {handoffs.length - 1}</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          className="px-4 py-2 rounded bg-neutral-200 text-neutral-700 hover:bg-neutral-300 disabled:opacity-50"
          onClick={() => prevId && navigate(`/tickets/${prevId}`)}
          disabled={!prevId}
        >
          ← Previous
        </button>
        <button
          className="px-4 py-2 rounded bg-neutral-200 text-neutral-700 hover:bg-neutral-300 disabled:opacity-50"
          onClick={() => nextId && navigate(`/tickets/${nextId}`)}
          disabled={!nextId}
        >
          Next →
        </button>
      </div>

      {/* Timeline Visualization */}
      <div className="bg-neutral-100 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-700 mb-4">Status Timeline</h2>
        <div className="flex items-center gap-2 w-full relative">
          {/* Start label */}
          <span className="absolute left-0 -top-6 text-xs font-semibold whitespace-nowrap text-neutral-700">
            {timelinePhases[0]?.start ? new Date(timelinePhases[0].start).toLocaleString() : ''}
          </span>
          {/* End label */}
          <span className="absolute right-0 -top-6 text-xs font-semibold whitespace-nowrap text-neutral-700">
            {timelinePhases[timelinePhases.length-1]?.end ? new Date(timelinePhases[timelinePhases.length-1].end).toLocaleString() : 'now'}
          </span>
          {/* Timeline segments */}
          {timelinePhases.map((phase, idx) => {
            const phaseClass = statusPillClass(phase.status).replace('status-', 'bg-status-');
            const nextPhase = timelinePhases[idx + 1];
            return (
              <div
                key={idx}
                className={`relative group h-8 rounded ${phaseClass} flex items-center justify-center`}
                style={{ flex: `${phase.durationH} ${phase.durationH} 0%`, minWidth: '30px' }}
              >
                <span className="absolute left-1/2 -translate-x-1/2 -top-7 text-xs font-semibold whitespace-nowrap text-neutral-700">
                  {phase.status}
                </span>
                {/* Improved tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 opacity-0 transition-opacity bg-neutral-800 text-white px-2 py-1 rounded-md text-xs whitespace-nowrap">
                  <div><span className="font-semibold">Status:</span> {phase.status}</div>
                  <div><span className="font-semibold">Start:</span> {phase.start ? new Date(phase.start).toLocaleString() : '-'}</div>
                  <div><span className="font-semibold">End:</span> {phase.end ? new Date(phase.end).toLocaleString() : 'now'}</div>
                  <div><span className="font-semibold">Duration:</span> {phase.durationH != null ? formatDuration(phase.durationH) : '-'}</div>
                </div>
                {/* Separator for phase transition */}
                {nextPhase && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-neutral-300 border-2 border-white z-20"></span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Blocker Log */}
      <div className="bg-neutral-100 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-neutral-700">Blocker Log</h2>
          <span className="text-xs text-neutral-500">{blockerLog.length} event(s)</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {blockerLog.map((b, i) => (
            <div key={i} className="py-2">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-status-blocked">{b.blockedBy}</span>
                <span className="text-xs text-neutral-500">{b.since ? new Date(b.since).toLocaleString() : '-'} → {b.resumedAt ? new Date(b.resumedAt).toLocaleString() : 'now'}</span>
                <span className="text-xs text-neutral-700 font-semibold">Duration: {b.duration || '-'}</span>
                <button
                  className="ml-auto border border-neutral-300 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 rounded-md px-3 py-1 text-xs transition-all"
                  onClick={() => setExpandedBlocker(expandedBlocker === i ? null : i)}
                >
                  {expandedBlocker === i ? "Hide Reason" : "Show Reason"}
                </button>
              </div>
              {expandedBlocker === i && (
                <div className="mt-2 bg-neutral-50 rounded-md p-2 text-sm text-neutral-700">
                  {b.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status Change Log */}
      <div className="bg-neutral-100 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-700 mb-2">Status Change Log</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-neutral-200 text-neutral-700 text-left">
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">Old Status</th>
              <th className="px-4 py-2">New Status</th>
              <th className="px-4 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {statusLog.map((log, i) => (
              <tr key={i} className="border-t border-neutral-200 hover:bg-neutral-100">
                <td className="px-4 py-2">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-4 py-2">{log.from}</td>
                <td className="px-4 py-2">{log.to}</td>
                <td className="px-4 py-2">{log.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 