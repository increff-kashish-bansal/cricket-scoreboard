import React, { useState } from "react";
import { useTicketsContext } from "./TicketsContext.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, CartesianGrid } from "recharts";
import { ExclamationCircleIcon, UserGroupIcon, FireIcon, ArrowPathIcon } from "@heroicons/react/24/solid";

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
  console.log('Done tickets with cycle time:', doneTickets.map(t => ({ id: t.id, cycleTime: t.totalCycleTimeHours })));
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
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-6">Dashboard</h1>
      {loading ? (
        <div className="flex flex-col items-center justify-center p-8 text-neutral-500">
          <ArrowPathIcon className="h-10 w-10 animate-spin mb-2" />
          <div>Loading data...</div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Total Tickets */}
            <div className="flex flex-col items-center gap-3 bg-white rounded-xl shadow-md p-6 border border-neutral-200">
              <UserGroupIcon className="w-8 h-8 text-primary mb-2" />
              <div className="text-3xl font-bold text-neutral-800">{totalTickets}</div>
              <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">Total Tickets</div>
            </div>
            {/* Blocked This Sprint */}
            <div className="flex flex-col items-center gap-3 bg-white rounded-xl shadow-md p-6 border border-neutral-200">
              <ExclamationCircleIcon className="w-8 h-8 text-status-in-progress mb-2" />
              <div className="text-3xl font-bold text-neutral-800">{blockedThisSprint}</div>
              <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide text-center">Blocked This Sprint</div>
            </div>
            {/* Top 3 Blockers */}
            <div className="flex flex-col items-center gap-3 bg-white rounded-xl shadow-md p-6 border border-neutral-200">
              <FireIcon className="w-8 h-8 text-status-blocked mb-2" />
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
            {/* Avg Time to Close */}
            <div className="flex flex-col items-center gap-3 bg-white rounded-xl shadow-md p-6 border border-neutral-200">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 mb-2">
                <span className="text-green-700 text-2xl font-bold">⏱️</span>
              </div>
              <div className="text-2xl font-bold text-neutral-800">{avgTimeToClose != null ? avgTimeToClose + 'h' : '-'}</div>
              <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide text-center">Avg Time to Close</div>
            </div>
            {/* Tickets Blocked > X Days */}
            <div className="flex flex-col gap-2 items-center bg-white rounded-xl shadow-md p-6 border border-neutral-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100">
                  <span className="text-red-700 text-2xl font-bold">⏳</span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-neutral-800">{ticketsBlockedOverXDays}</div>
                  <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">Blocked &gt; {blockedThresholdDays} Days</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <label htmlFor="blocked-threshold" className="block text-sm font-medium text-neutral-600 mb-1">Threshold:</label>
                <input
                  id="blocked-threshold"
                  type="number"
                  min={1}
                  value={blockedThresholdDays}
                  onChange={e => setBlockedThresholdDays(Number(e.target.value) || 1)}
                  className="border border-neutral-300 rounded-md px-3 py-2 w-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-xs"
                />
              </div>
            </div>
          </div>

          {/* Velocity Chart Card */}
          <div className="bg-white rounded-xl shadow-md p-8 border border-neutral-200 mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-neutral-700 mb-4">Developer Velocity (per Sprint)</h2>
              <div className="flex gap-2">
                <button
                  className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 transition-all ${velocityMode === 'tickets' ? 'border-primary text-primary bg-white' : 'border-transparent text-neutral-500 bg-neutral-100'}`}
                  onClick={() => setVelocityMode('tickets')}
                  title="Show number of tickets closed per sprint"
                >
                  Total Tickets Done
                </button>
                <button
                  className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 transition-all ${velocityMode === 'hours' ? 'border-primary text-primary bg-white' : 'border-transparent text-neutral-500 bg-neutral-100'}`}
                  onClick={() => setVelocityMode('hours')}
                  title="Show total development hours completed per sprint"
                >
                  Total Dev Hours Done
                </button>
              </div>
            </div>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <BarChart
                  data={velocityData}
                  margin={{ left: 48, right: 24, top: 24, bottom: 24 }}
                  title="Bar chart showing developer velocity per sprint"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={"#e5e7eb"} />
                  <XAxis
                    dataKey="sprint"
                    tickLine={{ stroke: '#9ca3af' }}
                    axisLine={{ stroke: '#9ca3af' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={{ stroke: '#9ca3af' }}
                    axisLine={{ stroke: '#9ca3af' }}
                  />
                  <Tooltip
                    contentStyle={{ background: '#f5f5f5', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)', padding: 12, color: '#374151', fontSize: 14 }}
                    wrapperClassName="!z-50"
                    labelClassName="text-neutral-700"
                    itemStyle={{ color: '#374151' }}
                    formatter={(value) => velocityMode === 'tickets' ? `${value} tickets` : `${value}h`}
                  />
                  <Legend wrapperStyle={{ color: '#52525b' }} iconType="circle" />
                  <Bar
                    dataKey="value"
                    fill="#22c55e"
                    name={velocityMode === 'tickets' ? 'Tickets Closed' : 'Dev Hours Done'}
                    radius={[4, 4, 0, 0]}
                  />
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