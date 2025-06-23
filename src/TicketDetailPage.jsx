import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { formatHoursToDuration } from './utils.js';

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
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="bg-white rounded-xl shadow-md p-8 mb-8">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-baseline gap-3 mb-2">
            <h1 className="text-3xl font-bold text-neutral-800">{ticket.title || `Ticket #${id}`}</h1>
            <span className={`inline-block px-2 py-0.5 rounded-full border text-sm font-semibold ${statusPillClass(ticket.status)}`}>{ticket.status}{ticket.status === "Done" && ticket.owner ? `: ${ticket.owner}` : ''}</span>
          </div>
          {/* Handoffs */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="font-semibold text-neutral-600">Key Collaborators / Handoff Path:</span>
            {handoffs.map((h, i) => (
              <span key={h + i} className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary-light/20 text-primary-dark border border-primary-light">{h}</span>
            ))}
          </div>
        </div>
        {/* Summary Metrics */}
        <div className="bg-neutral-100 rounded-lg shadow-sm p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-neutral-800">{formatHoursToDuration(devH)}</div>
            <div className="text-sm text-neutral-500 uppercase tracking-wide mt-1">Time in Dev</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-neutral-800">{formatHoursToDuration(blockedH)}</div>
            <div className="text-sm text-neutral-500 uppercase tracking-wide mt-1">Time Blocked</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-neutral-800">{formatHoursToDuration(cycleH)}</div>
            <div className="text-sm text-neutral-500 uppercase tracking-wide mt-1">Total Cycle Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-neutral-800">{percentBlocked != null ? percentBlocked + '%' : '-'}</div>
            <div className="text-sm text-neutral-500 uppercase tracking-wide mt-1">% Time Blocked</div>
          </div>
        </div>
      </div>
      {/* Timeline */}
      <div className="bg-neutral-100 rounded-lg shadow-sm p-8 mb-8">
        <h2 className="text-xl font-bold text-neutral-700 mb-6">Status Timeline</h2>
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium text-neutral-600">{timelinePhases[0]?.start ? new Date(timelinePhases[0].start).toLocaleString() : ''}</span>
          <span className="font-medium text-neutral-600">{timelinePhases[timelinePhases.length-1]?.end ? new Date(timelinePhases[timelinePhases.length-1].end).toLocaleString() : 'now'}</span>
        </div>
        <div className="overflow-x-auto">
          <div className="flex items-center gap-6 w-full min-h-[60px]">
            {timelinePhases.map((phase, idx) => {
              const phaseClass = statusPillClass(phase.status).replace('status-', 'bg-status-');
              return (
                <div key={idx} className={`flex flex-col items-center flex-1 min-w-[60px]`} style={{ flex: `${phase.durationH} ${phase.durationH} 0%` }}>
                  <span className="absolute left-1/2 -translate-x-1/2 -top-12 text-xs font-semibold whitespace-nowrap">{phase.status}</span>
                  <div className={`w-full h-6 ${phaseClass} rounded`} title={phase.status}></div>
                  <span className="mt-2 text-xs bg-neutral-200 rounded px-2 py-1">{phase.durationH}h</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Blocker Log */}
      <div className="bg-white rounded-xl shadow-md p-8 mb-8">
        <h2 className="text-xl font-bold mb-4">Blocker Log</h2>
        <div className="divide-y divide-neutral-200">
          {blockerLog.length === 0 ? (
            <div className="py-4 text-neutral-500">No blocks recorded.</div>
          ) : (
            blockerLog.map((block, idx) => (
              <div key={idx} className="py-4 flex flex-col md:flex-row md:items-center md:gap-6 gap-3">
                <span className="font-semibold text-neutral-700">{block.blockedBy}</span>
                <span className="text-neutral-500 text-sm">{block.since ? new Date(block.since).toLocaleString() : ''} → {block.resumedAt ? new Date(block.resumedAt).toLocaleString() : 'now'}</span>
                <span className="text-neutral-700 font-mono bg-yellow-100 rounded px-2 py-1">Duration: {block.duration}</span>
                {block.reason && (
                  <button className="ml-2 text-blue-600 underline text-xs" onClick={() => setExpandedBlocker(idx)}>
                    Show Reason
                  </button>
                )}
                {expandedBlocker === idx && (
                  <div className="mt-2 bg-neutral-50 rounded p-2 text-sm text-neutral-700 border border-neutral-200">{block.reason}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      {/* Status Change Log */}
      <div className="bg-neutral-100 rounded-xl shadow-md p-8 mb-8">
        <h2 className="text-xl font-bold mb-4">Status Change Log</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-neutral-200 text-neutral-700">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Old Status</th>
                <th className="px-4 py-3">New Status</th>
                <th className="px-4 py-3">By</th>
              </tr>
            </thead>
            <tbody>
              {statusLog.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-neutral-500">No status changes recorded.</td></tr>
              ) : (
                statusLog.map((log, idx) => (
                  <tr key={idx} className="divide-y divide-neutral-200">
                    <td className="px-4 py-3 whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</td>
                    <td className="px-4 py-3">{log.from}</td>
                    <td className="px-4 py-3">{log.to}</td>
                    <td className="px-4 py-3">{log.by}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Navigation Buttons */}
      <div className="flex justify-between items-center mt-8 gap-8 mb-8">
        <button
          className="bg-transparent text-primary border border-primary px-4 py-2 rounded-md hover:bg-primary-light hover:text-white transition-all flex items-center gap-2"
          disabled={!prevId}
          onClick={() => prevId && navigate(`/tickets/${prevId}`)}
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Previous
        </button>
        <button
          className="bg-transparent text-primary border border-primary px-4 py-2 rounded-md hover:bg-primary-light hover:text-white transition-all flex items-center gap-2"
          disabled={!nextId}
          onClick={() => nextId && navigate(`/tickets/${nextId}`)}
        >
          Next
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
} 