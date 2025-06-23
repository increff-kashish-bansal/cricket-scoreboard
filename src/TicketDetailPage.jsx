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

// Timeline colors
const statusColors = {
  "In Progress": "bg-yellow-400",
  Blocked: "bg-red-500",
  Done: "bg-green-500",
  "To Do": "bg-gray-300",
  Backlog: "bg-gray-300",
};

export default function TicketDetailPage({ tickets = [], loading }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const ticketIdx = tickets.findIndex((t) => t.id?.toString() === id);
  const ticket = tickets[ticketIdx] || {};

  // --- MOCK DATA FALLBACKS ---
  // In real use, these should come from the ticket object or backend
  const statusHistory = ticket.statusHistory || [
    { status: "To Do", start: "2024-06-01T09:00", end: "2024-06-02T10:00", by: "Alice" },
    { status: "In Progress", start: "2024-06-02T10:00", end: "2024-06-03T15:00", by: "Bob" },
    { status: "Blocked", start: "2024-06-03T15:00", end: "2024-06-05T12:00", by: "Bob" },
    { status: "In Progress", start: "2024-06-05T12:00", end: "2024-06-06T18:00", by: "QA" },
    { status: "Done", start: "2024-06-06T18:00", end: null, by: "QA" },
  ];
  const blockerLog = ticket.blockerLog || [
    {
      blockedBy: "API Team",
      reason: "Waiting for endpoint deployment. The endpoint was delayed due to infra issues.",
      since: "2024-06-03T15:00",
      resumedAt: "2024-06-05T12:00",
      duration: "1d 21h",
    },
  ];
  const handoffs = ticket.handoffs || ["Alice", "Bob", "QA"];
  const statusLog = ticket.statusLog || [
    { timestamp: "2024-06-02T10:00", from: "To Do", to: "In Progress", by: "Bob" },
    { timestamp: "2024-06-03T15:00", from: "In Progress", to: "Blocked", by: "Bob" },
    { timestamp: "2024-06-05T12:00", from: "Blocked", to: "In Progress", by: "QA" },
    { timestamp: "2024-06-06T18:00", from: "In Progress", to: "Done", by: "QA" },
  ];
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

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Top: Title, Status, Owner, Handoffs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded shadow p-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{ticket.title || `Ticket #${id}`}</h1>
            <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${statusColors[ticket.status] || 'bg-gray-200 text-gray-800 border-gray-300'}`}>{ticket.status || statusPhases[statusPhases.length-1]?.status}</span>
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
          <span className="text-xs text-gray-500">Total handoffs: {handoffs.length - 1}</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
          onClick={() => prevId && navigate(`/tickets/${prevId}`)}
          disabled={!prevId}
        >
          ← Previous
        </button>
        <button
          className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
          onClick={() => nextId && navigate(`/tickets/${nextId}`)}
          disabled={!nextId}
        >
          Next →
        </button>
      </div>

      {/* Timeline Visualization */}
      <div className="bg-white rounded shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Status Timeline</h2>
        <div className="flex items-center gap-2 w-full">
          {timelinePhases.map((phase, idx) => (
            <div
              key={idx}
              className={`relative group flex-1 h-8 rounded ${statusColors[phase.status] || 'bg-gray-300'}`}
              style={{ flex: `${phase.durationH} ${phase.durationH} 0%` }}
            >
              <span className="absolute left-1/2 -translate-x-1/2 -top-7 text-xs font-semibold whitespace-nowrap">
                {phase.status}
              </span>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-xs opacity-0 group-hover:opacity-100 bg-black text-white px-2 py-1 rounded z-10 pointer-events-none">
                {formatDuration(phase.durationH)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{new Date(timelinePhases[0].start).toLocaleString()}</span>
          <span>{timelinePhases[timelinePhases.length-1].end ? new Date(timelinePhases[timelinePhases.length-1].end).toLocaleString() : "now"}</span>
        </div>
      </div>

      {/* Blocker Log */}
      <div className="bg-white rounded shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Blocker Log</h2>
          <span className="text-xs text-gray-500">{blockerLog.length} event(s)</span>
        </div>
        <div className="divide-y">
          {blockerLog.map((b, i) => (
            <div key={i} className="py-2">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-red-700">{b.blockedBy}</span>
                <span className="text-xs text-gray-500">{b.since} → {b.resumedAt}</span>
                <span className="text-xs text-gray-700">Duration: {b.duration}</span>
                <button
                  className="ml-auto text-blue-600 hover:underline text-xs"
                  onClick={() => setExpandedBlocker(expandedBlocker === i ? null : i)}
                >
                  {expandedBlocker === i ? "Hide Reason" : "Show Reason"}
                </button>
              </div>
              {expandedBlocker === i && (
                <div className="mt-2 bg-gray-50 rounded p-2 text-sm text-gray-800">
                  {b.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status Change Log */}
      <div className="bg-white rounded shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Status Change Log</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">Old Status</th>
              <th className="px-4 py-2">New Status</th>
              <th className="px-4 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {statusLog.map((log, i) => (
              <tr key={i} className="border-t">
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