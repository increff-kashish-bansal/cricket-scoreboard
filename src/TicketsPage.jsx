import { useState, useEffect } from "react";
import Papa from "papaparse";
import { Link } from "react-router-dom";

const statuses = ["To Do", "In Progress", "Blocked", "Done"];
const owners = ["Alice", "Bob", "Charlie"];

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    Papa.parse("/tickets.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setTickets(results.data);
        setLoading(false);
      },
      error: () => setLoading(false),
    });
  }, []);

  // Dynamically get unique owners from data
  const uniqueOwners = Array.from(new Set(tickets.map(t => t.owner))).filter(Boolean);

  const filteredTickets = tickets.filter(ticket => {
    return (
      (statusFilter === "" || ticket.status === statusFilter) &&
      (ownerFilter === "" || ticket.owner === ownerFilter)
    );
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tickets</h1>
      <div className="flex flex-wrap gap-4 mb-4">
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
      </div>
      <div className="overflow-x-auto bg-white rounded shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading tickets...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2">Ticket ID</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Blocked</th>
                <th className="px-4 py-2">Blocked By</th>
                <th className="px-4 py-2">Time in Dev</th>
                <th className="px-4 py-2">Time Blocked</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-gray-500">
                    No tickets found.
                  </td>
                </tr>
              ) : (
                filteredTickets.map(ticket => (
                  <tr key={ticket.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono">
                      <Link to={`/tickets/${ticket.id}`} className="text-blue-600 hover:underline">
                        {ticket.id}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{ticket.title}</td>
                    <td className="px-4 py-2">{ticket.status}</td>
                    <td className="px-4 py-2">{ticket.owner}</td>
                    <td className="px-4 py-2">{ticket.blocked === "TRUE" || ticket.blocked === true ? "Y" : "N"}</td>
                    <td className="px-4 py-2">{ticket.blockedBy || "-"}</td>
                    <td className="px-4 py-2">{ticket.timeInDev}</td>
                    <td className="px-4 py-2">{ticket.timeBlocked}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
} 