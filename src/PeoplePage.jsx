import { useEffect, useState } from "react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";

function parseTime(str) {
  if (!str || str === "-") return 0;
  let days = 0, hours = 0;
  const dMatch = str.match(/(\d+)d/);
  const hMatch = str.match(/(\d+)h/);
  if (dMatch) days = parseInt(dMatch[1], 10);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  return days * 24 + hours;
}

export default function PeoplePage() {
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

  // Aggregate stats by owner and blocker
  const peopleStats = {};
  tickets.forEach(ticket => {
    // Tickets worked on (owner)
    if (ticket.owner) {
      if (!peopleStats[ticket.owner]) {
        peopleStats[ticket.owner] = { name: ticket.owner, tickets: 0, timeHeld: 0, blocksCaused: 0, blocksResolved: 0 };
      }
      peopleStats[ticket.owner].tickets += 1;
      peopleStats[ticket.owner].timeHeld += parseTime(ticket.timeInDev);
      // If ticket is Done, count as resolved
      if (ticket.status === "Done") {
        peopleStats[ticket.owner].blocksResolved += 1;
      }
    }
    // Blocks caused (blockedBy)
    if (ticket.blockedBy) {
      if (!peopleStats[ticket.blockedBy]) {
        peopleStats[ticket.blockedBy] = { name: ticket.blockedBy, tickets: 0, timeHeld: 0, blocksCaused: 0, blocksResolved: 0 };
      }
      peopleStats[ticket.blockedBy].blocksCaused += 1;
    }
  });

  const people = Object.values(peopleStats).sort((a, b) => b.tickets - a.tickets);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">People Dashboard</h1>
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading data...</div>
      ) : (
        <>
          <div className="mb-8 bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Tickets Worked On</h2>
            <div className="w-full h-64">
              <ResponsiveContainer>
                <BarChart data={people} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tickets" fill="#8884d8" name="# Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mb-8 bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Total Time Held (hours)</h2>
            <div className="w-full h-64">
              <ResponsiveContainer>
                <BarChart data={people} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="timeHeld" fill="#82ca9d" name="Time Held (h)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mb-8 bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Blocks Caused</h2>
            <div className="w-full h-64">
              <ResponsiveContainer>
                <BarChart data={people} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="blocksCaused" fill="#ff8042" name="Blocks Caused" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mb-8 bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Blocks Resolved</h2>
            <div className="w-full h-64">
              <ResponsiveContainer>
                <BarChart data={people} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="blocksResolved" fill="#ffc658" name="Blocks Resolved" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 