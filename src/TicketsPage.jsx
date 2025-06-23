import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { saveAs } from "file-saver";

const statuses = ["To Do", "In Progress", "Blocked", "Done"];
const statusPillColors = {
  "In Progress": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Blocked": "bg-red-100 text-red-800 border-red-300",
  "Done": "bg-green-100 text-green-800 border-green-300",
  "To Do": "bg-gray-100 text-gray-800 border-gray-300",
  "Backlog": "bg-gray-100 text-gray-800 border-gray-300",
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

export default function TicketsPage({ tickets = [], loading }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

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
        <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Export CSV</button>
      </div>
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            className="border rounded px-2 py-1"
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
          <label className="block text-sm font-medium mb-1">Owner</label>
          <select
            className="border rounded px-2 py-1"
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
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            className="border rounded px-2 py-1 w-full"
            placeholder="Search by Ticket ID or Title"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-x-auto bg-white rounded shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading tickets...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
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
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-gray-500">
                    No tickets found. Try adjusting your filters or search.
                  </td>
                </tr>
              ) : (
                filteredTickets.map(ticket => {
                  // Blocked >3 days highlight
                  const highlight = ticket.currentBlockDurationHours > 72;
                  return (
                    <tr key={ticket.id} className={`border-t hover:bg-gray-50 ${highlight ? 'bg-red-100' : ''}`}>
                      <td className="px-4 py-2 font-mono">
                        <Link to={`/tickets/${ticket.id}`} className="text-blue-600 hover:underline">
                          {ticket.id}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{ticket.title}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${statusPillColors[ticket.status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>{ticket.status}</span>
                      </td>
                      <td className="px-4 py-2">{ticket.owner}</td>
                      <td className="px-4 py-2">{ticket.blocked === "TRUE" || ticket.blocked === true ? "Y" : "N"}</td>
                      <td className="px-4 py-2">{ticket.blockedBy || "-"}</td>
                      <td className="px-4 py-2">{typeof ticket.calculatedTotalTimeInDevHours === 'number' ? ticket.calculatedTotalTimeInDevHours + 'h' : '-'}</td>
                      <td className="px-4 py-2 flex items-center gap-2">
                        {typeof ticket.calculatedTotalTimeBlockedHours === 'number' ? ticket.calculatedTotalTimeBlockedHours + 'h' : '-'}
                        {highlight && <span title="Blocked > 3 days" className="text-red-600">⚠️</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
} 