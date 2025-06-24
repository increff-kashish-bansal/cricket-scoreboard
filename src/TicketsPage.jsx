import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { saveAs } from "file-saver";
import { ArrowPathIcon, InformationCircleIcon, EyeIcon } from "@heroicons/react/24/solid";
import { Gantt, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';

const statuses = ["To Do", "In Progress", "Blocked", "Done"];

// Granular lifecycle statuses for filter and indicator
const lifecycleStatuses = [
  'Created',
  'Tech Review',
  'Blocked for Clarification',
  'In Sprint Backlog',
  'In Development',
  'Tech QC',
  'Business QC',
  'Deprioritized',
  'Released'
];
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

function parseTimeBlocked(str) {
  if (!str || str === "-") return 0;
  let days = 0, hours = 0;
  const dMatch = str.match(/(\d+)d/);
  const hMatch = str.match(/(\d+)h/);
  if (dMatch) days = parseInt(dMatch[1], 10);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  return days * 24 + hours;
}

function toCSV(rows) {
  if (!rows.length) return '';
  // Always include Event_Log as the last column
  const keys = [...Object.keys(rows[0]).filter(k => k !== 'Event_Log'), 'Event_Log'];
  const csv = [keys.join(",")].concat(
    rows.map(row => {
      // Ensure Event_Log is a JSON string array
      let eventLog = row.Event_Log;
      if (!eventLog) {
        // Try eventLogParsed if available
        if (row.eventLogParsed && Array.isArray(row.eventLogParsed)) {
          eventLog = JSON.stringify(row.eventLogParsed.map(ev => ({
            ...ev,
            // Convert timestamp to ISO string if it's a Date
            timestamp: ev.timestamp instanceof Date ? ev.timestamp.toISOString() : ev.timestamp
          })));
        } else {
          eventLog = '[]';
        }
      } else if (Array.isArray(eventLog)) {
        eventLog = JSON.stringify(eventLog);
      }
      return keys.map(k => {
        if (k === 'Event_Log') return `"${eventLog.replace(/"/g, '""')}"`;
        return `"${(row[k] || "").replace(/"/g, '""')}"`;
      }).join(",");
    })
  ).join("\n");
  return csv;
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

export default function TicketsPage({ tickets = [], loading, onShowTicketDetail, onShowUserDetail }) {
  console.log('TicketsPage received:', { ticketsCount: tickets.length, loading, tickets: tickets.slice(0, 3) });
  
  const [statusFilter, setStatusFilter] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [quickViewTicketId, setQuickViewTicketId] = useState(null);
  const [quickViewAnchor, setQuickViewAnchor] = useState(null);

  const uniqueOwners = Array.from(new Set(tickets.map(t => t.owner))).filter(Boolean);

  // Filtering and sorting with memoization
  const filteredTickets = useMemo(() => {
    let result = tickets.filter(ticket => {
      const matchesStatus = statusFilter.length === 0 || (ticket.eventLogParsed && statusFilter.some(sf => ticket.eventLogParsed.some(ev => ev.status === sf)));
      const matchesOwner = ownerFilter === "" || ticket.owner === ownerFilter;
      const matchesSearch =
        searchTerm.trim() === "" ||
        (ticket.id && ticket.id.toString().toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ticket.title && ticket.title.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesStatus && matchesOwner && matchesSearch;
    });
    // Sorting
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        // Special handling for calculated durations
        if (sortConfig.key === "calculatedTotalTimeBlockedHours" || sortConfig.key === "calculatedTotalTimeInDevHours") {
          aVal = typeof aVal === 'number' ? aVal : 0;
          bVal = typeof bVal === 'number' ? bVal : 0;
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }
        // Fallback for undefined/null
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        } else {
          return sortConfig.direction === "asc"
            ? aVal.toString().localeCompare(bVal.toString())
            : bVal.toString().localeCompare(aVal.toString());
        }
      });
    }
    return result;
  }, [tickets, statusFilter, ownerFilter, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function handleExport() {
    // Ensure every ticket has Event_Log as a JSON string array
    const ticketsWithEventLog = filteredTickets.map(ticket => {
      let eventLog = ticket.Event_Log;
      if (!eventLog) {
        if (ticket.eventLogParsed && Array.isArray(ticket.eventLogParsed)) {
          eventLog = JSON.stringify(ticket.eventLogParsed.map(ev => ({
            ...ev,
            timestamp: ev.timestamp instanceof Date ? ev.timestamp.toISOString() : ev.timestamp
          })));
        } else {
          eventLog = '[]';
        }
      } else if (Array.isArray(eventLog)) {
        eventLog = JSON.stringify(eventLog);
      }
      return { ...ticket, Event_Log: eventLog };
    });
    const csv = toCSV(ticketsWithEventLog);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "ticket.csv");
  }

  function handleSort(key) {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      } else {
        return { key, direction: "asc" };
      }
    });
  }

  // Table headers config for sorting
  const columns = [
    { key: "id", label: "Ticket ID" },
    { key: "title", label: "Title" },
    { key: "status", label: "Status" },
    { key: "owner", label: "Owner" },
    { key: "blocked", label: "Blocked" },
    { key: "blockedBy", label: "Blocked By" },
    { key: "calculatedTotalTimeInDevHours", label: "Time in Dev" },
    { key: "calculatedTotalTimeBlockedHours", label: "Time Blocked" },
    { key: "lifecycle", label: "Lifecycle" },
  ];

  // Helper: transform event log to Gantt tasks (from TicketDetailPage)
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
    const criticalBlockerFill = '#ff1744';
    const tasks = [];
    const blockedTasks = [];
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
      let name = phaseStatus;
      let durationMs = null;
      if (phaseStatus === 'Blocked') {
        durationMs = new Date(ganttEnd) - new Date(start);
      }
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
        durationMs,
      };
      if (phaseStatus === 'Blocked') blockedTasks.push({ idx: tasks.length, durationMs: durationMs || 0 });
      tasks.push(task);
    }
    if (blockedTasks.length > 0) {
      const maxIdx = blockedTasks.reduce((maxI, t, i, arr) => t.durationMs > arr[maxI].durationMs ? i : maxI, 0);
      const criticalIdx = blockedTasks[maxIdx].idx;
      if (tasks[criticalIdx]) {
        tasks[criticalIdx].isCriticalBlocker = true;
        tasks[criticalIdx].backgroundColor = criticalBlockerFill;
        tasks[criticalIdx].barColor = criticalBlockerFill;
        tasks[criticalIdx].barProgressColor = criticalBlockerFill;
        tasks[criticalIdx].progressColor = criticalBlockerFill;
        tasks[criticalIdx].customClass = 'gantt-critical-blocker';
      }
    }
    return tasks;
  }

  // Fallbacks for handler props
  const showTicketDetail = onShowTicketDetail || (() => {});
  const showUserDetail = onShowUserDetail || (() => {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <button onClick={handleExport} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Export CSV</button>
      </div>
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-1">Status</label>
          <div className="flex flex-col gap-1 bg-white border border-neutral-300 rounded-md px-3 py-2">
            {lifecycleStatuses.map(status => (
              <label key={status} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={status}
                  checked={statusFilter.includes(status)}
                  onChange={e => {
                    if (e.target.checked) setStatusFilter(prev => [...prev, status]);
                    else setStatusFilter(prev => prev.filter(s => s !== status));
                  }}
                  className="accent-primary"
                />
                <span className={`w-3 h-3 rounded-full inline-block ${statusColors[status] || 'bg-gray-200'}`}></span>
                {status}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-1">Owner</label>
          <select
            className="border border-neutral-300 rounded-md px-3 py-2 w-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
          >
            <option value="">All</option>
            {uniqueOwners.map(owner => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-neutral-600 mb-1">Search</label>
          <input
            type="text"
            className="border border-neutral-300 rounded-md px-3 py-2 w-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="Search by Ticket ID or Title"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-x-auto bg-white rounded shadow">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-8 text-neutral-500">
            <ArrowPathIcon className="h-10 w-10 animate-spin mb-2" />
            <div>Loading tickets...</div>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-neutral-200 text-neutral-700 text-left">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-2 cursor-pointer select-none group"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span className="text-xs">
                          {sortConfig.direction === "asc" ? "\u25b2" : "\u25bc"}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedTickets.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center p-8 text-neutral-500">
                      <InformationCircleIcon className="h-8 w-8 mb-2" />
                      <div>No tickets found. Try adjusting your filters or search.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((ticket, idx) => {
                  // Blocked >3 days highlight - only for currently blocked tickets
                  const isCurrentlyBlocked = ticket.status === 'Blocked';
                  const highlight = isCurrentlyBlocked && ticket.currentBlockDurationHours && ticket.currentBlockDurationHours > 72;
                  
                  // Debug logging for tickets with warning emoji
                  if (highlight) {
                    console.log('Ticket with warning:', {
                      id: ticket.id,
                      status: ticket.status,
                      isBlocked: ticket.isBlocked,
                      currentBlockDurationHours: ticket.currentBlockDurationHours
                    });
                  }
                  
                  return (
                    <tr
                      key={ticket.id}
                      className={`border-t border-neutral-200 hover:bg-neutral-100 ${idx % 2 === 1 ? 'even:bg-neutral-50' : ''} ${highlight ? 'bg-red-100' : ''}`}
                    >
                      <td className="px-4 py-2 font-mono relative group">
                        <button type="button" onClick={() => showTicketDetail(ticket.id)} className="text-indigo-600 hover:text-indigo-800 font-medium text-left p-0 bg-transparent">{ticket.id}</button>
                        {/* Eye icon for quick view */}
                        <button
                          type="button"
                          className="ml-1 p-1 rounded hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary absolute top-1/2 -translate-y-1/2 right-0"
                          onMouseEnter={e => { setQuickViewTicketId(ticket.id); setQuickViewAnchor(e.currentTarget); }}
                          onMouseLeave={() => setQuickViewTicketId(null)}
                          tabIndex={0}
                          aria-label="Quick View"
                        >
                          <EyeIcon className="w-4 h-4 text-neutral-500" />
                        </button>
                        {/* Popover for quick view */}
                        {quickViewTicketId === ticket.id && (
                          <div
                            className="z-50 absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-white border border-neutral-200 rounded-lg shadow-lg p-4 min-w-[260px] max-w-xs text-xs flex flex-col gap-2 animate-fadein"
                            onMouseEnter={() => setQuickViewTicketId(ticket.id)}
                            onMouseLeave={() => setQuickViewTicketId(null)}
                          >
                            <div className="font-semibold text-neutral-800 mb-1">{ticket.title || `Ticket #${ticket.id}`}</div>
                            <div className="text-neutral-600 mb-1">{ticket.description || <span className="italic text-neutral-400">No description</span>}</div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${statusPillClass(ticket.status)}`}>{ticket.status}</span>
                              <span className="text-neutral-500">Owner:</span> <span className="font-semibold text-neutral-700">{ticket.owner || '-'}</span>
                            </div>
                            {/* Mini Gantt chart */}
                            <div className="w-full h-16 bg-neutral-50 rounded border border-neutral-100 overflow-x-auto">
                              <Gantt
                                tasks={transformEventLogToGanttTasks(ticket.eventLogParsed || [], ticket)}
                                viewMode={ViewMode.Day}
                                fontFamily="Inter, system-ui, sans-serif"
                                fontSize={10}
                                barHeight={12}
                                columnWidth={24}
                                listCellWidth={0}
                                barCornerRadius={3}
                                TooltipContent={null}
                                // Hide grid lines and extras for minimal look
                                style={{ minWidth: 180, height: 48 }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2">{ticket.title}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${statusPillClass(ticket.status)}`}>{ticket.status}</span>
                      </td>
                      <td className="px-4 py-2">
                        <button type="button" onClick={() => showUserDetail(ticket.owner)} className="text-indigo-600 hover:text-indigo-800 font-medium text-left p-0 bg-transparent">{ticket.owner}</button>
                      </td>
                      <td className="px-4 py-2">{ticket.blocked === "TRUE" || ticket.blocked === true ? "Y" : "N"}</td>
                      <td className="px-4 py-2">{ticket.blockedBy || "-"}</td>
                      <td className="px-4 py-2">{typeof ticket.calculatedTotalTimeInDevHours === 'number' ? ticket.calculatedTotalTimeInDevHours + 'h' : '-'}</td>
                      <td className="px-4 py-2 flex items-center gap-2">
                        {typeof ticket.calculatedTotalTimeBlockedHours === 'number' ? ticket.calculatedTotalTimeBlockedHours + 'h' : '-'}
                        {highlight && <span title="Currently blocked > 3 days" className="text-red-600">⚠️</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 items-center">
                          {(ticket.eventLogParsed || []).map((ev, i, arr) => {
                            // Only show the first occurrence of each status in order
                            if (arr.findIndex(evv => evv.status === ev.status) !== i) return null;
                            return (
                              <span key={ev.status} className={`w-3 h-3 rounded-full ${statusColors[ev.status] || 'bg-gray-200'}`} title={ev.status}></span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <button
              type="button"
              className="px-3 py-1 rounded bg-neutral-200 text-neutral-700 hover:bg-neutral-300 disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              &larr; Prev
            </button>
            <span className="text-sm text-neutral-600">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              className="px-3 py-1 rounded bg-neutral-200 text-neutral-700 hover:bg-neutral-300 disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              Next &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 