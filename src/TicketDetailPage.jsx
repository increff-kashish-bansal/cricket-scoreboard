import React from "react";
import { useState, useRef, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { formatHoursToDuration, formatDate as formatDateForDisplay } from './utils.js';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import 'gantt-task-react/dist/index.css';

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

// Add statusColors for timeline dots
const statusColors = {
  'Created': 'bg-gray-400',
  'Tech Review': 'bg-blue-400',
  'Blocked for Clarification': 'bg-yellow-400',
  'In Sprint Backlog': 'bg-purple-400',
  'In Development': 'bg-blue-600',
  'Tech QC': 'bg-green-400',
  'Business QC': 'bg-green-600',
  'Deprioritized': 'bg-orange-400',
  'Released': 'bg-green-800',
};

// Add LifecycleTimeline component
function LifecycleTimeline({ eventLogParsed }) {
  if (!eventLogParsed || eventLogParsed.length === 0) return <div className="text-neutral-400 italic">No event log available.</div>;
  // Build timeline entries
  const entries = [];
  for (let i = 0; i < eventLogParsed.length; i++) {
    const ev = eventLogParsed[i];
    const prev = eventLogParsed[i - 1];
    let duration = null;
    if (prev && prev.timestamp && ev.timestamp) {
      duration = Math.round((new Date(ev.timestamp) - new Date(prev.timestamp)) / 36e5); // hours
    }
    entries.push({
      status: ev.status,
      by: ev.user || ev.by || ev.owner || '?',
      timestamp: ev.timestamp,
      duration,
      idx: i
    });
  }
  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <span className={`w-4 h-4 rounded-full ${statusColors[entry.status] || 'bg-gray-300'}`}></span>
            {idx < entries.length - 1 && <span className="w-1 h-8 bg-neutral-300 mx-auto"></span>}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-800">{entry.status}</span>
              <span className="text-xs text-neutral-500">{entry.timestamp ? formatDateForDisplay(entry.timestamp) : '-'}</span>
            </div>
            <div className="text-xs text-neutral-500">
              By: <span className="font-mono">{entry.by}</span>
              {entry.duration != null && idx > 0 && (
                <span className="ml-2">(Spent {entry.duration}h in previous state)</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// State Duration Summary Panel
function StateDurationSummary({ ticket }) {
  // Use the granular time properties from the ticket
  const stateTimes = [
    { name: 'Created', value: ticket.timeInCreatedHours },
    { name: 'Tech Review', value: ticket.timeInTechReviewHours },
    { name: 'Clarification', value: ticket.timeInClarificationHours },
    { name: 'Sprint Backlog', value: ticket.timeInSprintBacklogHours },
    { name: 'Development', value: ticket.timeInDevelopmentHours },
    { name: 'Tech QC', value: ticket.timeInTechQCHours },
    { name: 'Business QC', value: ticket.timeInBusinessQCHours },
    { name: 'Deprioritized', value: ticket.timeDeprioritizedHours },
    { name: 'Released', value: ticket.timeInReleasedHours },
  ].filter(s => typeof s.value === 'number' && s.value > 0);
  const COLORS = ['#a3a3a3', '#60a5fa', '#facc15', '#a78bfa', '#2563eb', '#34d399', '#059669', '#fb923c', '#166534'];
  if (stateTimes.length === 0) return <div className="text-neutral-400 italic">No state duration data.</div>;
  return (
    <div className="w-full max-w-xs">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={stateTimes}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={70}
            label={({ name, percent }) => `${name} (${Math.round(percent * 100)}%)`}
          >
            {stateTimes.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [`${value}h`, name]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-neutral-500">Total time spent in each state (hours).</div>
    </div>
  );
}

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

  // Interactivity handlers
  function handleDateChange(task, newStart, newEnd) {
    // For now, just log or ignore (could update state if you want editable Gantt)
    // console.log('Date changed:', task, newStart, newEnd);
  }

  // --- Highlight/scroll refs for logs ---
  const blockerLogRefs = useRef([]);
  const statusLogRefs = useRef([]);
  const [highlightedBlockerIdx, setHighlightedBlockerIdx] = useState(null);
  const [highlightedStatusIdx, setHighlightedStatusIdx] = useState(null);

  // Scroll and highlight logic
  useEffect(() => {
    if (highlightedBlockerIdx != null && blockerLogRefs.current[highlightedBlockerIdx]) {
      blockerLogRefs.current[highlightedBlockerIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timeout = setTimeout(() => setHighlightedBlockerIdx(null), 2000);
      return () => clearTimeout(timeout);
    }
  }, [highlightedBlockerIdx]);
  useEffect(() => {
    if (highlightedStatusIdx != null && statusLogRefs.current[highlightedStatusIdx]) {
      statusLogRefs.current[highlightedStatusIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timeout = setTimeout(() => setHighlightedStatusIdx(null), 2000);
      return () => clearTimeout(timeout);
    }
  }, [highlightedStatusIdx]);

  // Enhanced onTaskClick handler
  function handleTaskClick(task) {
    // Interactive linking: scroll to and highlight log entry
    if (task.name === 'Blocked') {
      // Find matching Blocker Log entry by start/end
      const idx = blockerLog.findIndex(block => {
        const blockStart = block.since && new Date(block.since).getTime();
        const blockEnd = block.resumedAt && new Date(block.resumedAt).getTime();
        const taskStart = task.start && new Date(task.start).getTime();
        const taskEnd = task.end && new Date(task.end).getTime();
        // Allow some leeway in ms
        const leeway = 60000; // 1 min
        return (
          (blockStart && taskStart && Math.abs(blockStart - taskStart) < leeway) &&
          ((blockEnd && taskEnd && Math.abs(blockEnd - taskEnd) < leeway) || (!blockEnd && !taskEnd))
        );
      });
      if (idx !== -1) setHighlightedBlockerIdx(idx);
    } else {
      // Find matching Status Change Log entry by status and timestamp
      const idx = statusLog.findIndex(log => {
        const taskStart = task.start && new Date(task.start).getTime();
        const logTime = log.timestamp && new Date(log.timestamp).getTime();
        const leeway = 60000; // 1 min
        // Try to match by time and status
        return (
          logTime && taskStart && Math.abs(logTime - taskStart) < leeway &&
          (log.to === task.name || log.from === task.name)
        );
      });
      if (idx !== -1) setHighlightedStatusIdx(idx);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="mb-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-primary hover:underline flex items-center gap-1"><ArrowLeftIcon className="w-5 h-5" />Back</button>
        <h1 className="text-2xl font-bold text-neutral-800">Ticket #{ticket.id}</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Timeline */}
        <div className="md:col-span-2">
          <h2 className="text-lg font-semibold mb-2">Lifecycle Timeline</h2>
          <LifecycleTimeline eventLogParsed={eventLogParsed} />
        </div>
        {/* State Duration Summary */}
        <div>
          <h2 className="text-lg font-semibold mb-2">State Duration Summary</h2>
          <StateDurationSummary ticket={ticket} />
        </div>
      </div>
      {/* Top Header with Navigation */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-6">{ticket.title || `Ticket #${id}`}</h1>
          <span className={`inline-block px-2 py-0.5 rounded-full border text-sm font-semibold ${statusPillClass(ticket.status)}`}>{ticket.status}{ticket.status === "Done" && ticket.owner ? `: ${ticket.owner}` : ''}</span>
        </div>
        <div className="flex gap-4">
          <button
            className="bg-transparent text-primary border border-primary px-4 py-2 rounded-md hover:bg-primary-light hover:text-white transition-all flex items-center gap-4"
            disabled={!prevId}
            onClick={() => prevId && navigate(`/tickets/${prevId}`)}
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Previous
          </button>
          <button
            className="bg-transparent text-primary border border-primary px-4 py-2 rounded-md hover:bg-primary-light hover:text-white transition-all flex items-center gap-4"
            disabled={!nextId}
            onClick={() => nextId && navigate(`/tickets/${nextId}`)}
          >
            Next
            <ArrowRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* Owner Initials Circle and Handoffs */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        {ticket.owner && (
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-neutral-300 text-neutral-700 flex items-center justify-center rounded-full text-lg font-bold shadow-sm">{getInitials(ticket.owner)}</span>
            <span className="font-semibold text-neutral-800 text-base">{ticket.owner}</span>
          </div>
        )}
        {handoffs.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-semibold text-neutral-600">Handoffs:</span>
            {handoffs.map((h, i) => (
              <React.Fragment key={h + i}>
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-light/20 text-primary-dark">{h}</span>
                {i < handoffs.length - 1 && <span className="mx-1 text-neutral-500">→</span>}
              </React.Fragment>
            ))}
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-200 text-xs text-neutral-700 font-semibold"><svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17v-2a4 4 0 00-3-3.87M7 7V5a4 4 0 013-3.87M7 7a4 4 0 013 3.87v2m0 0a4 4 0 003 3.87v2m0 0a4 4 0 01-3 3.87M7 17v2a4 4 0 003 3.87" /></svg> {handoffs.length}</span>
          </div>
        )}
      </div>
      {/* Summary Metrics */}
      <div className="bg-neutral-100 rounded-lg shadow-sm p-8 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 text-center">
          <div>
            <div className="text-3xl font-bold text-neutral-800">{formatHoursToDuration(devH)}</div>
            <div className="text-sm text-neutral-500 uppercase tracking-wide">Time in Dev</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-neutral-800">{formatHoursToDuration(blockedH)}</div>
            <div className="text-sm text-neutral-500 uppercase tracking-wide">Time Blocked</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-neutral-800">{formatHoursToDuration(cycleH)}</div>
            <div className="text-sm text-neutral-500 uppercase tracking-wide">Total Cycle Time</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-neutral-800">{percentBlocked != null ? percentBlocked + '%' : '-'}</div>
            <div className="text-sm text-neutral-500 uppercase tracking-wide">% Time Blocked</div>
          </div>
        </div>
      </div>
      {/* Blocker Log */}
      <div className="bg-white rounded-xl shadow-md p-8 mb-8">
        <h2 className="text-xl font-semibold text-neutral-700 mb-4">Blocker Log</h2>
        <div className="divide-y divide-neutral-200">
          {blockerLog.length === 0 ? (
            <div className="py-4 text-neutral-500">No blocks recorded.</div>
          ) : (
            blockerLog.map((block, idx) => (
              <div
                key={idx}
                ref={el => blockerLogRefs.current[idx] = el}
                className={`py-4 flex flex-col md:flex-row md:items-center md:gap-6 gap-y-2 gap-x-6 transition-all duration-500 ${highlightedBlockerIdx === idx ? 'ring-4 ring-primary/40 bg-primary/10' : ''}`}
              >
                <span className="font-semibold text-status-blocked text-lg">{block.blockedBy}</span>
                <span className="text-xs text-neutral-500">{block.since ? formatDateForDisplay(block.since) : ''} → {block.resumedAt ? formatDateForDisplay(block.resumedAt) : 'now'}</span>
                <span className="text-sm text-neutral-700 font-mono bg-yellow-100 rounded px-2 py-1">Duration: {block.duration}</span>
                {block.reason && (
                  <button className="ml-2 text-primary hover:underline text-xs" onClick={() => setExpandedBlocker(idx)}>
                    Show Reason
                  </button>
                )}
                {expandedBlocker === idx && (
                  <div className="mt-2 bg-neutral-50 rounded-md p-2 text-sm text-neutral-700 border border-neutral-200">{block.reason}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      {/* Status Change Log */}
      <div className="bg-neutral-100 rounded-xl shadow-md p-8 mb-8">
        <h2 className="text-xl font-semibold text-neutral-700 mb-4">Status Change Log</h2>
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
                  <tr
                    key={idx}
                    ref={el => statusLogRefs.current[idx] = el}
                    className={`divide-y divide-neutral-200 transition-all duration-500 ${highlightedStatusIdx === idx ? 'ring-4 ring-primary/40 bg-primary/10' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-neutral-500">{log.timestamp ? formatDateForDisplay(log.timestamp) : ''}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700">{log.from}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700">{log.to}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700">{log.by}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 