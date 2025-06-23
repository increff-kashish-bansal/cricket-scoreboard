import { useEffect, useState } from "react";
import Papa from "papaparse";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

export default function BlockersPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Aggregate blockers
  const blockerStats = {};
  let totalBlockedHours = 0;
  tickets.forEach(ticket => {
    if (ticket.blocked === "TRUE" || ticket.blocked === true) {
      const entity = ticket.blockedBy || "Unknown";
      const hours = parseTimeBlocked(ticket.timeBlocked);
      totalBlockedHours += hours;
      if (!blockerStats[entity]) {
        blockerStats[entity] = { entity, count: 0, totalHours: 0 };
      }
      blockerStats[entity].count += 1;
      blockerStats[entity].totalHours += hours;
    }
  });

  const pieData = Object.values(blockerStats).map(b => ({
    name: b.entity,
    value: b.totalHours
  }));

  const tableData = Object.values(blockerStats).sort((a, b) => b.totalHours - a.totalHours);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Blocker Dashboard</h1>
      {loading ? (
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
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Blocker Table</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="px-4 py-2">Blocker Entity</th>
                    <th className="px-4 py-2"># Tickets Blocked</th>
                    <th className="px-4 py-2">Total Time Blocked (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-gray-500">
                        No blocker data available.
                      </td>
                    </tr>
                  ) : (
                    tableData.map(b => (
                      <tr key={b.entity} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono">{b.entity}</td>
                        <td className="px-4 py-2">{b.count}</td>
                        <td className="px-4 py-2">{b.totalHours}</td>
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