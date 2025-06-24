import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

/**
 * TimeAnalysisChart
 * Props:
 *   - sprints: { [sprintName]: Ticket[] }
 *   - sprintNames: string[] (chronological order)
 *   - filter: { sprint: string }
 *   - onSprintClick: (sprint: string) => void
 */

// Custom ActiveDot component for highlighting
function CustomActiveDot(props) {
  const { cx, cy, payload, filter } = props;
  const isActive = filter && filter.sprint === payload.sprint;
  if (!cx || !cy) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isActive ? 10 : 6}
      fill={isActive ? '#2563eb' : '#fff'}
      stroke={isActive ? '#1e40af' : '#2563eb'}
      strokeWidth={isActive ? 3 : 2}
      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
    />
  );
}

function TimeAnalysisChart({ sprints, sprintNames, filter, onSprintClick }) {
  // Prepare data for the chart
  const data = sprintNames.map(sprint => {
    const tickets = sprints[sprint] || [];
    const totalDev = tickets.reduce((sum, t) => sum + (t.calculatedTotalTimeInDevHours || 0), 0);
    const totalBlocked = tickets.reduce((sum, t) => sum + (t.calculatedTotalTimeBlockedHours || 0), 0);
    return {
      sprint,
      "Total Time in Dev": totalDev,
      "Total Time Blocked": totalBlocked,
    };
  });

  return (
    <div className="bg-neutral-100 rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-neutral-700 mb-4">Time Analysis: Productive vs Blocked Hours</h2>
      <div className="w-full h-80">
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 24, right: 32, left: 32, bottom: 24 }}
            onClick={e => {
              if (onSprintClick && e && e.activeLabel) onSprintClick(e.activeLabel);
            }}
          >
            <defs>
              <linearGradient id="colorDev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f87171" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f87171" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="sprint" tick={{ fontSize: 14, fill: '#374151' }} />
            <YAxis tick={{ fontSize: 14, fill: '#374151' }} label={{ value: 'Total Hours', angle: -90, position: 'insideLeft', fill: '#374151', fontSize: 14 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#f5f5f5', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)', padding: 12, color: '#374151', fontSize: 14 }}
              wrapperClassName="!z-50"
              labelClassName="text-neutral-700"
              itemStyle={{ color: '#374151' }}
              formatter={(value, name) => [`${value}h`, name]}
            />
            <Legend
              wrapperStyle={{ color: '#52525b', fontSize: 14, paddingBottom: 8 }}
              iconType="circle"
              align="right"
              verticalAlign="top"
              layout="horizontal"
            />
            <Area
              type="monotone"
              dataKey="Total Time in Dev"
              stackId="1"
              stroke="#2563eb"
              fill="url(#colorDev)"
              name="Total Time in Dev"
              activeDot={props => <CustomActiveDot {...props} filter={filter} />}
            />
            <Area
              type="monotone"
              dataKey="Total Time Blocked"
              stackId="1"
              stroke="#f87171"
              fill="url(#colorBlocked)"
              name="Total Time Blocked"
              activeDot={props => <CustomActiveDot {...props} filter={filter} />}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-gray-500 mt-2">Shows the total productive vs blocked hours per sprint. Lower blocked area is better.</div>
    </div>
  );
}

export default TimeAnalysisChart; 