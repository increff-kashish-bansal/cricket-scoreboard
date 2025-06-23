import React from "react";
import { useTicketsContext } from "./TicketsContext.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { ExclamationCircleIcon, UserGroupIcon, FireIcon } from "@heroicons/react/24/solid";

function groupBySprint(tickets) {
  const sprints = {};
  tickets.forEach(ticket => {
    const sprint = ticket.sprint || "No Sprint";
    if (!sprints[sprint]) sprints[sprint] = [];
    sprints[sprint].push(ticket);
  });
  return sprints;
}

function Dashboard() {
  const { tickets, loading } = useTicketsContext();

  // Total tickets
  const totalTickets = tickets.length;

  // Group by sprint
  const sprints = groupBySprint(tickets);
  const sprintNames = Object.keys(sprints).sort();
  const currentSprint = sprintNames[sprintNames.length - 1];
  const currentSprintTickets = sprints[currentSprint] || [];

  // Tickets blocked this sprint
  const blockedThisSprint = currentSprintTickets.filter(t => t.blocked === "TRUE" || t.blocked === true).length;

  // Top 3 blockers (by count, across all tickets)
  const blockerCounts = {};
  tickets.forEach(t => {
    if (t.blocked === "TRUE" || t.blocked === true) {
      const entity = t.blockedBy || "Unknown";
      blockerCounts[entity] = (blockerCounts[entity] || 0) + 1;
    }
  });
  const topBlockers = Object.entries(blockerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Developer velocity chart (tickets closed per sprint)
  const velocityData = sprintNames.map(sprint => {
    const sprintTickets = sprints[sprint];
    const closed = sprintTickets.filter(t => t.status === "Done").length;
    return { sprint, closed };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading data...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="flex items-center gap-3 bg-white rounded shadow p-6">
              <UserGroupIcon className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{totalTickets}</div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Tickets</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white rounded shadow p-6">
              <ExclamationCircleIcon className="w-8 h-8 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{blockedThisSprint}</div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Blocked This Sprint</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white rounded shadow p-6">
              <FireIcon className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-lg font-bold mb-1">Top 3 Blockers</div>
                <ul className="text-xs text-gray-700">
                  {topBlockers.length === 0 ? <li>None</li> : topBlockers.map(([name, count]) => (
                    <li key={name}>{name} <span className="text-gray-400">({count})</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Velocity Chart */}
          <div className="bg-white rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Developer Velocity (Tickets Closed per Sprint)</h2>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <BarChart data={velocityData} margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
                  <XAxis dataKey="sprint" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="closed" fill="#22c55e" name="Tickets Closed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard; 