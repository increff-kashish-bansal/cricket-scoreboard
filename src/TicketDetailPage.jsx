import React from "react";
import { useState, useRef, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { formatHoursToDuration, formatDate as formatDateForDisplay } from './utils.js';
import { Gantt, ViewMode } from 'gantt-task-react';
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

export default function TicketDetailPage({ tickets = [], loading }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const ticketIdx = tickets.findIndex((t) => t.id?.toString() === id);
  const ticket = tickets[ticketIdx] || {};

  // --- DYNAMIC DATA DERIVATION FROM eventLogParsed ---
  const eventLogParsed = ticket.eventLogParsed || [];

  // Gantt Task Transformation
  function transformEventLogToGanttTasks(eventLogParsed, ticketDetails) {
    const statusColors = {
      'To Do': '#2563eb',
      'Backlog': '#64748b',
      'In Progress': '#f59e42',
      'In Review': '#a21caf',
      'QA': '#059669',
      'Blocked': '#dc2626',
      'Done': '#22c55e',
      'Deployed': '#0ea5e9',
      'Unblocked': '#22c55e',
      'default': '#bdbdbd',
    };
    const blockedBarFill = '#991B1B';
    const tasks = [];
    for (let i = 0; i < eventLogParsed.length; i++) {
      const ev = eventLogParsed[i];
      if (!ev.status || !ev.timestamp) continue;
      const start = ev.timestamp;
      let end = null;
      if (i < eventLogParsed.length - 1) {
        end = eventLogParsed[i + 1].timestamp;
      } else {
        end = (ticketDetails.status === 'Done' || ticketDetails.status === 'Deployed') ? null : new Date();
      }
      if (!start || isNaN(start.getTime())) continue;
      if (end && (isNaN(end.getTime()) || end <= start)) continue;
      const phaseStatus = ev.status;
      const color = statusColors[phaseStatus] || statusColors['default'];
      const ganttEnd = end || new Date();
      
      // Debug logging
      console.log(`Processing status: ${phaseStatus}, color: ${color}`);
      
      // Concise name for bar
      let name = phaseStatus;
      
      // Use the library's built-in color properties
      const task = {
        id: `${ticketDetails.id}-${i}-${phaseStatus}`,
        name,
        start: start,
        end: ganttEnd,
        type: 'task',
        progress: end ? 100 : 0,
        dependencies: [],
        backgroundColor: phaseStatus === 'Blocked' ? blockedBarFill : color,
        barColor: phaseStatus === 'Blocked' ? blockedBarFill : color,
        barProgressColor: phaseStatus === 'Blocked' ? blockedBarFill : color,
        progressColor: phaseStatus === 'Blocked' ? blockedBarFill : color,
        blockedBy: ev.blockedBy,
        user: ev.user,
        reason: ev.reason || ev.note,
      };
      
      tasks.push(task);
    }
    return tasks;
  }

  // Compute Gantt tasks for this ticket
  const ganttTasks = transformEventLogToGanttTasks(eventLogParsed, ticket);
  
  // Debug: Log all unique statuses found
  const uniqueStatuses = [...new Set(eventLogParsed.map(ev => ev.status).filter(Boolean))];
  console.log('Unique statuses found:', uniqueStatuses);
  console.log('Event log parsed:', eventLogParsed);
  
  // Fallback: if no tasks were created, create a default task
  if (ganttTasks.length === 0) {
    const now = new Date();
    const createdDate = ticket.Created_On_Date || now;
    ganttTasks.push({
      id: `${ticket.id}-default`,
      name: `Ticket ${ticket.status || 'Unknown'}`,
      start: createdDate,
      end: now,
      type: 'task',
      progress: 100,
      dependencies: [],
      styles: { backgroundColor: '#a3a3a3', borderColor: '#a3a3a3' },
    });
  }
  
  // Debug logging
  console.log('Gantt tasks:', ganttTasks);

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

  const [viewMode, setViewMode] = useState(ViewMode.Day);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskDetail, setTaskDetail] = useState(null);

  const ganttContainerRef = useRef(null);

  // Custom Today Line Overlay
  useEffect(() => {
    const container = ganttContainerRef.current;
    if (!container) return;
    // Remove any previous today lines
    const prev = container.querySelector('.gantt-today-line');
    if (prev) prev.remove();
    // Find the Gantt chart svg
    const svg = container.querySelector('svg');
    if (!svg) return;
    // Find the leftmost and rightmost x positions
    const chartArea = svg.querySelector('g[data-testid="horizontal-lines"]');
    if (!chartArea) return;
    // Find the time scale (x axis) group
    const xAxis = svg.querySelector('g[data-testid="date-labels"]');
    if (!xAxis) return;
    // Find the first and last date label positions
    const labels = xAxis.querySelectorAll('text');
    if (!labels.length) return;
    // Get the bounding box for the chart area
    const chartBox = chartArea.getBBox();
    // Calculate the X position for today
    const now = new Date();
    // Find the min and max date from the tasks
    const allDates = ganttTasks.flatMap(t => [t.start, t.end]).filter(Boolean);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    if (now < minDate || now > maxDate) return; // Don't draw if out of range
    const totalMs = maxDate - minDate;
    const nowMs = now - minDate;
    const percent = nowMs / totalMs;
    const x = chartBox.x + chartBox.width * percent;
    // Draw the today line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('x2', x);
    line.setAttribute('y1', chartBox.y);
    line.setAttribute('y2', chartBox.y + chartBox.height);
    line.setAttribute('stroke', '#3B82F6');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '4 2');
    line.setAttribute('class', 'gantt-today-line');
    svg.appendChild(line);
  }, [ganttTasks, viewMode]);

  // Interactivity handlers
  function handleDateChange(task, newStart, newEnd) {
    // For now, just log or ignore (could update state if you want editable Gantt)
    // console.log('Date changed:', task, newStart, newEnd);
  }
  function handleTaskClick(task) {
    setSelectedTaskId(task.id);
    setTaskDetail(task);
    // Optionally scroll to or highlight corresponding log entry
  }
  function handleExpanderClick(task) {
    // Not used for flat tasks, but could be implemented for groups
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 space-y-12">
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
      {/* Gantt Chart Section */}
      <div className="bg-neutral-100 rounded-lg shadow-sm p-8 mb-8 overflow-x-auto" ref={ganttContainerRef}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold text-neutral-700 mb-4">Status Timeline (Gantt)</h2>
          <div className="flex items-center gap-2">
            <label className="font-medium text-neutral-600" htmlFor="viewMode">View Mode:</label>
            <select
              id="viewMode"
              className="border border-neutral-300 rounded-md px-3 py-2 text-neutral-700"
              value={viewMode}
              onChange={e => setViewMode(e.target.value)}
            >
              <option value={ViewMode.Day}>Day</option>
              <option value={ViewMode.Week}>Week</option>
              <option value={ViewMode.Month}>Month</option>
            </select>
            <span className="ml-4 flex items-center gap-1 text-xs text-blue-600"><span className="inline-block w-3 h-3 rounded-full bg-blue-500 border border-blue-700" style={{borderRadius:2, borderWidth:2}}></span> Today</span>
          </div>
        </div>
        {/* Color Legend */}
        <div className="flex flex-wrap gap-4 mb-4">
          {Object.entries({
            'To Do': '#2563eb',
            'In Progress': '#f59e42',
            'Blocked': '#dc2626',
            'Done': '#22c55e',
            'QA': '#059669',
            'In Review': '#a21caf',
            'Deployed': '#0ea5e9',
          }).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded" style={{background: color, border: '2px solid #222'}}></span>
              <span className="text-sm text-neutral-700">{status}</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: 8, minWidth: 600, overflowX: 'auto' }}>
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={16}
            barHeight={52}
            columnWidth={viewMode === ViewMode.Day ? 80 : viewMode === ViewMode.Week ? 120 : 180}
            listCellWidth={0}
            barCornerRadius={6}
            onDateChange={handleDateChange}
            onTaskClick={handleTaskClick}
            onExpanderClick={handleExpanderClick}
            TooltipContent={({ task }) => {
              const durationH = task.start && task.end ? Math.round((new Date(task.end) - new Date(task.start)) / 36e5) : null;
              return (
                <div style={{ padding: 16, fontSize: 15, minWidth: 260, background: 'rgba(255,255,255,0.98)', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)', color: '#1e293b' }}>
                  <div className="font-bold mb-1" style={{fontSize: 17, fontWeight: 700, color: '#0f172a'}} title={task.name}>{task.name}</div>
                  <div className="text-xs text-neutral-500 mb-1">{task.user && `By: ${task.user}`}</div>
                  <div><span className="text-neutral-500">Start:</span> {task.start ? new Date(task.start).toLocaleString() : '-'}</div>
                  <div><span className="text-neutral-500">End:</span> {task.end ? new Date(task.end).toLocaleString() : 'now'}</div>
                  <div><span className="text-neutral-500">Duration:</span> {durationH != null ? durationH + 'h' : '-'}</div>
                  {task.name.toLowerCase().includes('blocked') && (
                    <>
                      <div className="mt-2 text-red-700 font-semibold">Blocked By: {task.blockedBy || task.user || '?'}</div>
                      {task.reason && <div className="mt-1 text-xs text-neutral-700 bg-yellow-50 rounded p-2">Reason: {task.reason}</div>}
                    </>
                  )}
                </div>
              );
            }}
          />
        </div>
        {/* Show details for selected phase */}
        {taskDetail && (
          <div className="mt-4 p-4 bg-white rounded shadow border border-primary-light">
            <div className="font-bold text-primary mb-2">Phase Details</div>
            <div><b>Name:</b> {taskDetail.name}</div>
            <div><b>Start:</b> {taskDetail.start ? new Date(taskDetail.start).toLocaleString() : '-'}</div>
            <div><b>End:</b> {taskDetail.end ? new Date(taskDetail.end).toLocaleString() : 'now'}</div>
            <div><b>Status:</b> {taskDetail.type}</div>
          </div>
        )}
      </div>
      {/* Blocker Log */}
      <div className="bg-white rounded-xl shadow-md p-8 mb-8">
        <h2 className="text-xl font-semibold text-neutral-700 mb-4">Blocker Log</h2>
        <div className="divide-y divide-neutral-200">
          {blockerLog.length === 0 ? (
            <div className="py-4 text-neutral-500">No blocks recorded.</div>
          ) : (
            blockerLog.map((block, idx) => (
              <div key={idx} className="py-4 flex flex-col md:flex-row md:items-center md:gap-6 gap-y-2 gap-x-6">
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
                  <tr key={idx} className="divide-y divide-neutral-200">
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