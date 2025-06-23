import { useEffect, useState } from "react";
import Papa from "papaparse";

function parseTimeBlocked(str) {
  if (!str || str === "-") return 0;
  let days = 0, hours = 0;
  const dMatch = str.match(/(\d+)d/);
  const hMatch = str.match(/(\d+)h/);
  if (dMatch) days = parseInt(dMatch[1], 10);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  return days * 24 + hours;
}

function groupBySprint(tickets) {
  // If no sprint column, group all tickets under 'No Sprint'
  const sprints = {};
  tickets.forEach(ticket => {
    const sprint = ticket.sprint || "No Sprint";
    if (!sprints[sprint]) sprints[sprint] = [];
    sprints[sprint].push(ticket);
  });
  return sprints;
}

function getSprintStats(tickets) {
  const total = tickets.length;
  let blockedCount = 0;
  let totalBlocked = 0;
  let totalDev = 0;
  const blockerFreq = {};
  tickets.forEach(ticket => {
    const blocked = ticket.blocked === "TRUE" || ticket.blocked === true;
    if (blocked) {
      blockedCount++;
      const hours = parseTimeBlocked(ticket.timeBlocked);
      totalBlocked += hours;
      const entity = ticket.blockedBy || "Unknown";
      blockerFreq[entity] = (blockerFreq[entity] || 0) + 1;
    }
    totalDev += parseTimeBlocked(ticket.timeInDev);
  });
  const mostFrequentBlocker = Object.entries(blockerFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  const percentBlocked = totalDev > 0 ? Math.round((totalBlocked / totalDev) * 100) : 0;
  return {
    total,
    blockedCount,
    percentBlocked,
    mostFrequentBlocker,
    totalBlocked,
    totalDev,
  };
}

export default function SprintsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSprint, setExpandedSprint] = useState(null);

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

  const sprints = groupBySprint(tickets);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sprints</h1>
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading data...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(sprints).map(([sprint, sprintTickets]) => {
            const stats = getSprintStats(sprintTickets);
            return (
              <div key={sprint} className="bg-white rounded shadow p-4">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedSprint(expandedSprint === sprint ? null : sprint)}>
                  <div>
                    <h2 className="text-lg font-semibold">{sprint}</h2>
                    <div className="text-sm text-gray-600">{stats.total} tickets</div>
                  </div>
                  <button className="text-blue-600 hover:underline">{expandedSprint === sprint ? "Hide" : "Show"} Details</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <div><span className="font-semibold">Tickets Blocked:</span> {stats.blockedCount}</div>
                  <div><span className="font-semibold">% Time Blocked:</span> {stats.percentBlocked}%</div>
                  <div><span className="font-semibold">Most Frequent Blocker:</span> {stats.mostFrequentBlocker}</div>
                  <div><span className="font-semibold">Total Time Blocked:</span> {stats.totalBlocked}h</div>
                </div>
                {expandedSprint === sprint && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Tickets</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 text-left">
                            <th className="px-4 py-2">Ticket ID</th>
                            <th className="px-4 py-2">Title</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Blocked</th>
                            <th className="px-4 py-2">Blocked By</th>
                            <th className="px-4 py-2">Time in Dev</th>
                            <th className="px-4 py-2">Time Blocked</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sprintTickets.map(ticket => (
                            <tr key={ticket.id} className="border-t hover:bg-gray-50">
                              <td className="px-4 py-2 font-mono">{ticket.id}</td>
                              <td className="px-4 py-2">{ticket.title}</td>
                              <td className="px-4 py-2">{ticket.status}</td>
                              <td className="px-4 py-2">{ticket.blocked === "TRUE" || ticket.blocked === true ? "Y" : "N"}</td>
                              <td className="px-4 py-2">{ticket.blockedBy || "-"}</td>
                              <td className="px-4 py-2">{ticket.timeInDev}</td>
                              <td className="px-4 py-2">{ticket.timeBlocked}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 