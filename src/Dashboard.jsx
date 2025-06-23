import React, { useState } from "react";
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

function getLatestSprintName(tickets) {
  // Find the latest sprint name by sorting by date if possible, else by name
  const sprints = Array.from(new Set(tickets.map(t => t.sprintName || t.sprint || 'No Sprint')));
  // Try to sort by date if sprints are date-like
  const dateSprints = sprints.filter(s => /\d{4}-\d{2}-\d{2}/.test(s));
  if (dateSprints.length === sprints.length) {
    return dateSprints.sort().slice(-1)[0];
  }
  // Otherwise, sort by name (assume last is latest)
  return sprints.sort().slice(-1)[0];
}

function Dashboard() {
  const { tickets, loading } = useTicketsContext();
  const [velocityMode, setVelocityMode] = useState('tickets'); // 'tickets' or 'hours'
  const [blockedThresholdDays, setBlockedThresholdDays] = useState(3); // user-defined threshold

  // Auto-detect current sprint
  const currentSprintName = getLatestSprintName(tickets);

  // Total tickets
  const totalTickets = tickets.length;

  // Group by sprint
  const sprints = groupBySprint(tickets);
  const sprintNames = Object.keys(sprints).sort();
  const currentSprint = sprintNames[sprintNames.length - 1];

  // Top 3 blockers (by count, across all tickets)
  const blockerStats = {};
  tickets.forEach(t => {
    if (t.isBlocked || t.calculatedTotalTimeBlockedHours > 0) {
      const entity = t.blockedBy || "Unknown";
      if (!blockerStats[entity]) blockerStats[entity] = { count: 0, totalBlocked: 0 };
      blockerStats[entity].count += 1;
      blockerStats[entity].totalBlocked += t.calculatedTotalTimeBlockedHours || 0;
    }
  });
  const topBlockers = Object.entries(blockerStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);

  // Developer velocity chart (tickets closed per sprint)
  const completedStatuses = ['Done', 'Deployed'];
  const velocityData = sprintNames.map(sprint => {
    const sprintTickets = sprints[sprint];
    if (velocityMode === 'tickets') {
      const closed = sprintTickets.filter(t => completedStatuses.includes(t.status)).length;
      return { sprint, value: closed };
    } else {
      const hours = sprintTickets
        .filter(t => completedStatuses.includes(t.status))
        .reduce((sum, t) => sum + (t.calculatedTotalTimeInDevHours || 0), 0);
      return { sprint, value: hours };
    }
  });

  // --- ENHANCEMENT 8: More Granular Dashboard Metrics ---
  // Average Time to Close (for Done tickets)
  const doneTickets = tickets.filter(t => t.status === 'Done' && typeof t.totalCycleTimeHours === 'number');
  const avgTimeToClose = doneTickets.length
    ? Math.round(doneTickets.reduce((sum, t) => sum + t.totalCycleTimeHours, 0) / doneTickets.length)
    : null;

  // Tickets Blocked > X Days (user-defined threshold)
  const ticketsBlockedOverXDays = tickets.filter(t => {
    const thresholdHours = blockedThresholdDays * 24;
    if (t.isBlocked && t.currentBlockDurationHours > thresholdHours) return true;
    if (!t.isBlocked && t.calculatedTotalTimeBlockedHours > thresholdHours) return true;
    return false;
  }).length;

  // --- ENHANCEMENT 9: Refine Blocked This Sprint ---
  // Use isBlocked and sprintName
  const currentSprintTickets = tickets.filter(t => t.sprintName === currentSprintName);
  const blockedThisSprint = currentSprintTickets.filter(t => t.isBlocked).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading data...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            {/* Total Tickets */}
            <div className="flex items-center gap-3 bg-white rounded shadow p-6" title="Total number of tickets in the current dataset">
              <UserGroupIcon className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{totalTickets}</div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Tickets</div>
              </div>
            </div>
            {/* Blocked This Sprint */}
            <div className="flex items-center gap-3 bg-white rounded shadow p-6" title="Number of tickets currently blocked in the latest sprint ({currentSprintName})">
              <ExclamationCircleIcon className="w-8 h-8 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{blockedThisSprint}</div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Blocked This Sprint</div>
              </div>
            </div>
            {/* Top 3 Blockers */}
            <div className="flex items-center gap-3 bg-white rounded shadow p-6" title="Top 3 entities causing blocks, with average block duration">
              <FireIcon className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-lg font-bold mb-1">Top 3 Blockers</div>
                <ul className="text-xs text-gray-700">
                  {topBlockers.length === 0 ? <li>None</li> : topBlockers.map(([name, stat]) => (
                    <li key={name} className="flex flex-col gap-0.5 mb-1">
                      <span className="flex items-center gap-2">
                        <span>{name}</span>
                        <span className="text-gray-400">({stat.count})</span>
                      </span>
                      <span className="ml-2 text-green-700">Avg Blocked: {stat.count ? Math.round(stat.totalBlocked / stat.count) + 'h' : '-'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {/* Avg Time to Close */}
            <div className="flex items-center gap-3 bg-white rounded shadow p-6" title="Average time (in hours) from ticket creation to Done for completed tickets">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100">
                <span className="text-green-700 text-xl font-bold">⏱️</span>
              </div>
              <div>
                <div className="text-2xl font-bold">{avgTimeToClose != null ? avgTimeToClose + 'h' : '-'}</div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Avg Time to Close</div>
              </div>
            </div>
            {/* Tickets Blocked > X Days */}
            <div className="flex flex-col gap-2 items-start bg-white rounded shadow p-6" title="Number of tickets blocked for more than the selected threshold (in days)">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100">
                  <span className="text-red-700 text-xl font-bold">⏳</span>
                </div>
                <div>
                  <div className="text-2xl font-bold">{ticketsBlockedOverXDays}</div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Blocked &gt; {blockedThresholdDays} Days</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <label htmlFor="blocked-threshold" className="text-xs text-gray-500">Threshold:</label>
                <input
                  id="blocked-threshold"
                  type="number"
                  min={1}
                  value={blockedThresholdDays}
                  onChange={e => setBlockedThresholdDays(Number(e.target.value) || 1)}
                  className="border rounded px-2 py-0.5 w-14 text-xs"
                />
                <span className="text-xs text-gray-500">days</span>
              </div>
            </div>
          </div>

          {/* Velocity Chart */}
          <div className="bg-white rounded shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Developer Velocity (per Sprint)</h2>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1 rounded ${velocityMode === 'tickets' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  onClick={() => setVelocityMode('tickets')}
                  title="Show number of tickets closed per sprint"
                >
                  Total Tickets Done
                </button>
                <button
                  className={`px-3 py-1 rounded ${velocityMode === 'hours' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  onClick={() => setVelocityMode('hours')}
                  title="Show total development hours completed per sprint"
                >
                  Total Dev Hours Done
                </button>
              </div>
            </div>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <BarChart data={velocityData} margin={{ left: 40, right: 20, top: 10, bottom: 10 }}
                  title="Bar chart showing developer velocity per sprint">
                  <XAxis dataKey="sprint" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => velocityMode === 'tickets' ? `${value} tickets` : `${value}h`} />
                  <Legend />
                  <Bar dataKey="value" fill="#22c55e" name={velocityMode === 'tickets' ? 'Tickets Closed' : 'Dev Hours Done'} />
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