import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { saveAs } from "file-saver";
import { ArrowPathIcon, InformationCircleIcon } from "@heroicons/react/24/solid";

const statuses = ["To Do", "In Progress", "Blocked", "Done"];

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

export default function TicketsPage({ tickets = [], loading }) {
  console.log('TicketsPage received:', { ticketsCount: tickets.length, loading, tickets: tickets.slice(0, 3) });
  
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const uniqueOwners = Array.from(new Set(tickets.map(t => t.owner))).filter(Boolean);

  // Filtering and sorting with memoization
  const filteredTickets = useMemo(() => {
    let result = tickets.filter(ticket => {
      const matchesStatus = statusFilter === "" || ticket.status === statusFilter;
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
    saveAs(blob, "tickets.csv");
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
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <button onClick={handleExport} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Export CSV</button>
      </div>
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-1">Status</label>
          <select
            className="border border-neutral-300 rounded-md px-3 py-2 w-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
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
                      <td className="px-4 py-2 font-mono">
                        <Link to={`/tickets/${ticket.id}`} className="text-blue-600 hover:underline">
                          {ticket.id}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{ticket.title}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${statusPillClass(ticket.status)}`}>{ticket.status}</span>
                      </td>
                      <td className="px-4 py-2">{ticket.owner}</td>
                      <td className="px-4 py-2">{ticket.blocked === "TRUE" || ticket.blocked === true ? "Y" : "N"}</td>
                      <td className="px-4 py-2">{ticket.blockedBy || "-"}</td>
                      <td className="px-4 py-2">{typeof ticket.calculatedTotalTimeInDevHours === 'number' ? ticket.calculatedTotalTimeInDevHours + 'h' : '-'}</td>
                      <td className="px-4 py-2 flex items-center gap-2">
                        {typeof ticket.calculatedTotalTimeBlockedHours === 'number' ? ticket.calculatedTotalTimeBlockedHours + 'h' : '-'}
                        {highlight && <span title="Currently blocked > 3 days" className="text-red-600">⚠️</span>}
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