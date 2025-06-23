import { useState, useMemo } from "react";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { CheckCircleIcon, ExclamationCircleIcon, ClockIcon, UserGroupIcon, FireIcon } from "@heroicons/react/24/solid";

function parseTimeBlocked(str) {
  if (!str || str === "-") return 0;
  let days = 0, hours = 0;
  const dMatch = str.match(/(\d+)d/);
  const hMatch = str.match(/(\d+)h/);
  if (dMatch) days = parseInt(dMatch[1], 10);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  return days * 24 + hours;
}

function parseTimeDev(str) {
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
  let totalDevExBlocked = 0;
  const blockerFreq = {};
  tickets.forEach(ticket => {
    const blocked = ticket.isBlocked;
    // Use calculated fields
    const blockedHours = ticket.calculatedTotalTimeBlockedHours || 0;
    const devHours = ticket.calculatedTotalTimeInDevHours || 0;
    if (blocked) blockedCount++;
    totalBlocked += blockedHours;
    totalDev += devHours;
    if (!blocked) totalDevExBlocked += devHours;
    const entity = ticket.blockedBy || "Unknown";
    if (blocked) blockerFreq[entity] = (blockerFreq[entity] || 0) + 1;
  });
  const mostFrequentBlocker = Object.entries(blockerFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  const percentBlocked = total > 0 ? Math.round((blockedCount / total) * 100) : 0;
  // Efficiency: totalDev / (totalDev + totalBlocked)
  const efficiency = (totalDev + totalBlocked) > 0 ? Math.round((totalDev / (totalDev + totalBlocked)) * 100) : 0;
  const avgDevExBlocked = total - blockedCount > 0 ? Math.round((totalDevExBlocked / (total - blockedCount)) * 10) / 10 : 0;
  return {
    total,
    blockedCount,
    percentBlocked,
    mostFrequentBlocker,
    totalBlocked,
    totalDev,
    avgDevExBlocked,
    efficiency,
  };
}

function toCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(",")].concat(
    rows.map(row => keys.map(k => `"${(row[k] || "").replace(/"/g, '""')}"`).join(","))
  ).join("\n");
  return csv;
}

const CARD_ICONS = [
  <UserGroupIcon className="w-6 h-6 text-blue-500" />, // total tickets
  <ExclamationCircleIcon className="w-6 h-6 text-yellow-500" />, // % blocked
  <ClockIcon className="w-6 h-6 text-purple-500" />, // avg dev time
  <FireIcon className="w-6 h-6 text-red-500" />, // total blocked
  <CheckCircleIcon className="w-6 h-6 text-green-500" />, // most frequent blocker
];

export default function SprintsPage({ tickets = [], loading }) {
  const [expandedSprint, setExpandedSprint] = useState(null);
  const [sprintFilter, setSprintFilter] = useState("");
  const [sprintSearch, setSprintSearch] = useState("");
  const [ticketSort, setTicketSort] = useState({ key: null, direction: "asc" });

  // Memoize sprints and sprintNames
  const sprints = useMemo(() => groupBySprint(tickets), [tickets]);
  let sprintNames = useMemo(() => Object.keys(sprints), [sprints]);
  if (sprintSearch.trim()) {
    sprintNames = sprintNames.filter(s => s.toLowerCase().includes(sprintSearch.toLowerCase()));
  }
  if (sprintFilter) {
    sprintNames = sprintNames.filter(s => s === sprintFilter);
  }

  // --- Stacked Bar Chart Data ---
  const sprintChartData = sprintNames.map(sprint => {
    const sprintTickets = sprints[sprint];
    let completed = 0, blocked = 0, open = 0;
    sprintTickets.forEach(ticket => {
      if (ticket.status === "Done") completed++;
      else if (ticket.blocked === "TRUE" || ticket.blocked === true) blocked++;
      else open++;
    });
    return {
      sprint,
      Completed: completed,
      Blocked: blocked,
      Open: open,
    };
  });

  function handleExport(sprintTickets) {
    const csv = toCSV(sprintTickets);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "sprint-tickets.csv");
  }

  // Sprint Efficiency Score
  function getEfficiencyBadge(score) {
    let color = "bg-red-100 text-red-800 border-red-200";
    if (score > 85) color = "bg-green-100 text-green-800 border-green-200";
    else if (score >= 60) color = "bg-yellow-100 text-yellow-800 border-yellow-200";
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ml-2 ${color}`}>Efficiency: {score}%</span>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sprints</h1>
      {/* Sprint Filter & Search */}
      <div className="flex flex-wrap gap-4 items-end mb-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">Search Sprint</label>
          <input
            type="text"
            className="border rounded px-2 py-1 w-full"
            placeholder="Search by sprint name or number"
            value={sprintSearch}
            onChange={e => setSprintSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sprint</label>
          <select
            className="border rounded px-2 py-1"
            value={sprintFilter}
            onChange={e => setSprintFilter(e.target.value)}
          >
            <option value="">All</option>
            {Object.keys(sprints).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Stacked Bar Chart */}
      <div className="mb-8 bg-white rounded shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Sprint Progress</h2>
        <div className="w-full h-64">
          <ResponsiveContainer>
            <BarChart data={sprintChartData} layout="vertical" margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="sprint" type="category" width={100} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Completed" stackId="a" fill="#22c55e" name="Completed" onClick={(_, idx) => setExpandedSprint(sprintNames[idx])} cursor="pointer" />
              <Bar dataKey="Blocked" stackId="a" fill="#f59e42" name="Blocked" onClick={(_, idx) => setExpandedSprint(sprintNames[idx])} cursor="pointer" />
              <Bar dataKey="Open" stackId="a" fill="#60a5fa" name="Open" onClick={(_, idx) => setExpandedSprint(sprintNames[idx])} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-gray-500 mt-2">Click a bar to view sprint details below.</div>
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading data...</div>
      ) : (
        <div className="space-y-6">
          {/* Sprint Summary Cards */}
          {expandedSprint && (
            <div className="flex flex-wrap gap-4 mb-6">
              {(() => {
                const stats = getSprintStats(sprints[expandedSprint]);
                const cardData = [
                  { label: "Total Tickets", value: stats.total, icon: CARD_ICONS[0] },
                  { label: "% Blocked", value: stats.percentBlocked + "%", icon: CARD_ICONS[1] },
                  { label: "Avg Dev Time (h)", value: stats.avgDevExBlocked, icon: CARD_ICONS[2] },
                  { label: "Total Blocked (h)", value: stats.totalBlocked, icon: CARD_ICONS[3] },
                  { label: "Top Blocker", value: stats.mostFrequentBlocker, icon: CARD_ICONS[4] },
                ];
                return cardData.map((c, i) => (
                  <div key={c.label} className="flex items-center gap-3 bg-gray-50 rounded shadow p-4 min-w-[180px]">
                    <div>{c.icon}</div>
                    <div>
                      <div className="text-lg font-bold">{c.value}</div>
                      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{c.label}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
          {sprintNames.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No sprints found. Try adjusting your filters or search.</div>
          ) : (
            sprintNames.map(sprint => {
              const sprintTickets = sprints[sprint];
              const stats = getSprintStats(sprintTickets);
              // Ticket Table Sorting
              let sortedTickets = useMemo(() => {
                let arr = [...sprintTickets];
                if (expandedSprint === sprint && ticketSort.key) {
                  arr.sort((a, b) => {
                    let aVal = a[ticketSort.key];
                    let bVal = b[ticketSort.key];
                    if (ticketSort.key === "timeBlocked") {
                      aVal = parseTimeBlocked(aVal);
                      bVal = parseTimeBlocked(bVal);
                    }
                    if (typeof aVal === "number" && typeof bVal === "number") {
                      return ticketSort.direction === "asc" ? aVal - bVal : bVal - aVal;
                    } else {
                      return ticketSort.direction === "asc"
                        ? (aVal || "").toString().localeCompare((bVal || "").toString())
                        : (bVal || "").toString().localeCompare((aVal || "").toString());
                    }
                  });
                }
                return arr;
              }, [sprintTickets, expandedSprint, ticketSort, sprint]);
              return (
                <div key={sprint} className="bg-white rounded shadow p-4">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedSprint(expandedSprint === sprint ? null : sprint)}>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{sprint}</h2>
                      {getEfficiencyBadge(stats.efficiency)}
                    </div>
                    <button className="text-blue-600 hover:underline">{expandedSprint === sprint ? "Hide" : "Show"} Details</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div><span className="font-semibold">Tickets Blocked:</span> {stats.blockedCount}</div>
                    <div><span className="font-semibold">% Time Blocked:</span> {stats.percentBlocked}%</div>
                    <div><span className="font-semibold">Most Frequent Blocker:</span> {stats.mostFrequentBlocker}</div>
                    <div><span className="font-semibold">Total Time Blocked:</span> {stats.totalBlocked}h</div>
                    <div><span className="font-semibold">Total Dev Hours:</span> {stats.totalDev}h</div>
                  </div>
                  {expandedSprint === sprint && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">Tickets</h3>
                        <button onClick={() => handleExport(sortedTickets)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Export CSV</button>
                      </div>
                      <div className="overflow-x-auto">
                        {sortedTickets.length === 0 ? (
                          <div className="text-gray-500 text-center py-8">No tickets in this sprint.</div>
                        ) : (
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 text-left">
                                <th className="px-4 py-2">Ticket ID</th>
                                <th className="px-4 py-2">Owner</th>
                                <th className="px-4 py-2 cursor-pointer select-none" onClick={e => { e.stopPropagation(); setTicketSort(prev => ({ key: "status", direction: prev.key === "status" && prev.direction === "asc" ? "desc" : "asc" })); }}>Status {ticketSort.key === "status" && (ticketSort.direction === "asc" ? "▲" : "▼")}</th>
                                <th className="px-4 py-2">Dev Hours</th>
                                <th className="px-4 py-2">Blocked Hours</th>
                                <th className="px-4 py-2">Cycle Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedTickets.map(ticket => {
                                const devH = ticket.calculatedTotalTimeInDevHours;
                                const blockedH = ticket.calculatedTotalTimeBlockedHours;
                                const cycleH = ticket.totalCycleTimeHours;
                                return (
                                  <tr key={ticket.id} className={`border-t hover:bg-gray-50`}>
                                    <td className="px-4 py-2 font-mono">{ticket.id}</td>
                                    <td className="px-4 py-2">{ticket.owner}</td>
                                    <td className="px-4 py-2">{ticket.status}</td>
                                    <td className="px-4 py-2">{devH != null ? devH + 'h' : '-'}</td>
                                    <td className="px-4 py-2">{blockedH != null ? blockedH + 'h' : '-'}</td>
                                    <td className="px-4 py-2">{cycleH != null ? cycleH + 'h' : '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
} 