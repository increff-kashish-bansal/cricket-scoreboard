import { useEffect, useState } from "react";
import Papa from "papaparse";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { saveAs } from "file-saver";
import { Link } from "react-router-dom";

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1", "#a4de6c", "#d0ed57", "#d8854f"
];

function parseTimeBlocked(str) {
  // Accepts formats like '1d 2h', '4h', '-', etc.
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
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(",")].concat(
    rows.map(row => keys.map(k => `"${(row[k] || "").replace(/"/g, '""')}"`).join(","))
  ).join("\n");
  return csv;
}

export default function BlockersPage({ tickets = [], loading }) {
  const [ticketsState, setTickets] = useState([]);
  const [loadingState, setLoading] = useState(true);
  const [selectedBlocker, setSelectedBlocker] = useState(null);
  const [barMode, setBarMode] = useState("time"); // "time" or "count"
  const [blockerSearch, setBlockerSearch] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "totalHours", direction: "desc" });

  // Use tickets from props if provided, else load from CSV (legacy)
  const ticketsToUse = tickets.length ? tickets : ticketsState;
  const loadingToUse = tickets.length ? loading : loadingState;

  useEffect(() => {
    if (tickets.length) return; // skip if using props
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
  }, [tickets.length]);

  // Aggregate blockers
  const blockerStats = {};
  let totalBlockedHours = 0;
  ticketsToUse.forEach(ticket => {
    const eventLog = ticket.eventLogParsed || [];
    const sprint = ticket.sprintName || ticket.sprint || "No Sprint";
    // Find all block events in eventLogParsed
    const blockEvents = eventLog.filter(ev => ev.status === 'Blocked');
    blockEvents.forEach(ev => {
      const entity = ticket.blockedBy || ev.blockedBy || ev.by || "Unknown";
      if (!blockerStats[entity]) {
        blockerStats[entity] = {
          entity,
          count: 0,
          totalHours: 0,
          maxHours: 0,
          blockDurations: [],
          mostRecent: null,
          mostRecentDate: null,
          sprints: new Set(),
          ticketIds: new Set(),
          blockTimestamps: [],
          blockSprints: new Set(),
        };
      }
      // Find the end of this block (next non-blocked event or end of log)
      let blockEnd = null;
      for (let i = eventLog.indexOf(ev) + 1; i < eventLog.length; i++) {
        if (eventLog[i].status !== 'Blocked') {
          blockEnd = eventLog[i].timestamp;
          break;
        }
      }
      // If still blocked, use now
      if (!blockEnd) blockEnd = ticket.status === 'Blocked' ? new Date() : null;
      let durationH = null;
      if (blockEnd && ev.timestamp) {
        durationH = Math.max(1, Math.round((new Date(blockEnd) - new Date(ev.timestamp)) / 36e5));
      }
      if (durationH) {
        blockerStats[entity].blockDurations.push(durationH);
        blockerStats[entity].totalHours += durationH;
        blockerStats[entity].maxHours = Math.max(blockerStats[entity].maxHours, durationH);
        totalBlockedHours += durationH;
      }
      blockerStats[entity].count += 1;
      blockerStats[entity].sprints.add(sprint);
      blockerStats[entity].ticketIds.add(ticket.id);
      blockerStats[entity].blockTimestamps.push(ev.timestamp);
      blockerStats[entity].blockSprints.add(sprint);
      // Most recent block event timestamp
      if (!blockerStats[entity].mostRecentDate || (ev.timestamp && ev.timestamp > blockerStats[entity].mostRecentDate)) {
        blockerStats[entity].mostRecentDate = ev.timestamp;
        blockerStats[entity].mostRecent = ticket;
      }
    });
  });

  // Prepare table data
  let tableData = Object.values(blockerStats).map(b => ({
    ...b,
    avgHours: b.blockDurations.length ? Math.round((b.totalHours / b.blockDurations.length) * 10) / 10 : 0,
    sprints: Array.from(b.sprints),
    repeatOffender: b.count > 3 && b.blockSprints.size > 1,
    ticketIds: Array.from(b.ticketIds),
  }));

  // --- FILTERING ---
  if (selectedBlocker) {
    tableData = tableData.filter(b => b.entity === selectedBlocker);
  }
  if (blockerSearch.trim()) {
    tableData = tableData.filter(b => b.entity.toLowerCase().includes(blockerSearch.toLowerCase()));
  }
  if (sprintFilter) {
    tableData = tableData.filter(b => b.sprints.includes(sprintFilter));
  }

  // --- SORTING ---
  if (sortConfig.key) {
    tableData = [...tableData].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === "entity") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      } else {
        return sortConfig.direction === "asc"
          ? aVal.toString().localeCompare(bVal.toString())
          : bVal.toString().localeCompare(aVal.toString());
      }
    });
  }

  // Pie/bar chart data (not filtered by search/sprint)
  const pieData = Object.values(blockerStats).map(b => ({
    name: b.entity,
    value: b.totalHours,
    count: b.count,
  }));
  const barData = [...pieData]
    .sort((a, b) =>
      barMode === "time" ? b.value - a.value : b.count - a.count
    );

  function handleExport() {
    const csv = toCSV(tableData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "blockers.csv");
  }

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { name, value } = payload[0].payload;
      const percent = totalBlockedHours ? ((value / totalBlockedHours) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white border rounded shadow px-3 py-2 text-xs">
          <div className="font-semibold">{name}</div>
          <div>Total Blocked: <span className="font-mono">{value}h</span></div>
          <div>Share: <span className="font-mono">{percent}%</span></div>
        </div>
      );
    }
    return null;
  };

  // Pie slice click handler
  function handlePieClick(data, idx) {
    if (!data || !data.name) return;
    setSelectedBlocker(prev => (prev === data.name ? null : data.name));
  }

  function handleSort(key) {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      } else {
        return { key, direction: "desc" };
      }
    });
  }

  // --- SPRINTS ---
  const allSprints = Array.from(new Set(ticketsToUse.map(t => t.sprint || "No Sprint")));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Blocker Dashboard</h1>
      {loadingToUse ? (
        <div className="p-8 text-center text-gray-500">Loading data...</div>
      ) : (
        <>
          <div className="mb-8 bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-4">% of Total Blocked Time by Entity</h2>
            {pieData.length === 0 ? (
              <div className="text-gray-500">No blocker data available.</div>
            ) : (
              <div className="w-full h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                      onClick={handlePieClick}
                      isAnimationActive={false}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={COLORS[idx % COLORS.length]}
                          stroke={selectedBlocker === entry.name ? "#222" : undefined}
                          strokeWidth={selectedBlocker === entry.name ? 4 : 1}
                          cursor="pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={CustomTooltip} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Bar Chart Toggle & Chart */}
            {pieData.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-4 mb-2">
                  <span className="font-semibold text-sm">Compare Blockers by:</span>
                  <button
                    className={`px-3 py-1 rounded text-xs border ${barMode === "time" ? "bg-blue-600 text-white border-blue-700" : "bg-white text-blue-700 border-blue-300"}`}
                    onClick={() => setBarMode("time")}
                  >
                    Total Blocked Time
                  </button>
                  <button
                    className={`px-3 py-1 rounded text-xs border ${barMode === "count" ? "bg-blue-600 text-white border-blue-700" : "bg-white text-blue-700 border-blue-300"}`}
                    onClick={() => setBarMode("count")}
                  >
                    # Tickets Blocked
                  </button>
                </div>
                <div className="w-full h-64">
                  <ResponsiveContainer>
                    <BarChart
                      data={barData}
                      layout="vertical"
                      margin={{ left: 40, right: 20, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        label={{
                          value: barMode === "time" ? "Total Blocked Time (h)" : "# Tickets Blocked",
                          position: "insideBottomRight",
                          offset: -5,
                        }}
                      />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip
                        formatter={(value) =>
                          barMode === "time"
                            ? `${value}h`
                            : `${value} ticket${value === 1 ? "" : "s"}`
                        }
                      />
                      <Bar
                        dataKey={barMode === "time" ? "value" : "count"}
                        fill="#8884d8"
                        name={barMode === "time" ? "Total Blocked Time (h)" : "# Tickets Blocked"}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {selectedBlocker && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm">Filtering for:</span>
                <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200">{selectedBlocker}</span>
                <button
                  className="ml-2 text-xs text-blue-600 hover:underline"
                  onClick={() => setSelectedBlocker(null)}
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>
          <div className="bg-white rounded shadow p-4">
            <div className="flex flex-wrap gap-4 items-end mb-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-1">Search Blocker</label>
                <input
                  type="text"
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Search by blocker name"
                  value={blockerSearch}
                  onChange={e => setBlockerSearch(e.target.value)}
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
                  {allSprints.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Blocker Table</h2>
              <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("entity")}>Blocker Entity {sortConfig.key === "entity" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                    <th className="px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("count")}># Tickets Blocked {sortConfig.key === "count" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                    <th className="px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("totalHours")}>Total Time Blocked (h) {sortConfig.key === "totalHours" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                    <th className="px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("avgHours")}>Avg Block Duration (h) {sortConfig.key === "avgHours" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                    <th className="px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("maxHours")}>Longest Block (h) {sortConfig.key === "maxHours" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                    <th className="px-4 py-2 cursor-pointer select-none" onClick={() => handleSort("mostRecentDate")}>Most Recent Blocked Ticket {sortConfig.key === "mostRecentDate" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-gray-500">
                        No blocker data available.
                      </td>
                    </tr>
                  ) : (
                    tableData.map(b => (
                      <tr key={b.entity} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono flex items-center gap-2">
                          {b.entity}
                          {b.repeatOffender && (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-semibold border border-red-200" title="Repeat Offender">Repeat Offender</span>
                          )}
                        </td>
                        <td className="px-4 py-2">{b.count}</td>
                        <td className="px-4 py-2">{b.totalHours}</td>
                        <td className="px-4 py-2">{b.avgHours}</td>
                        <td className="px-4 py-2">{b.maxHours}</td>
                        <td className="px-4 py-2">
                          {b.mostRecent ? (
                            <Link to={`/tickets/${b.mostRecent.id}`} className="text-blue-600 hover:underline font-mono">{b.mostRecent.id}</Link>
                          ) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 