// Duration: '1d 2h' <-> hours
export function parseDurationStringToHours(str) {
  if (!str || typeof str !== 'string') return 0;
  const dayMatch = str.match(/(\d+)\s*d/);
  const hourMatch = str.match(/(\d+)\s*h/);
  const days = dayMatch ? parseInt(dayMatch[1], 10) : 0;
  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  return days * 24 + hours;
}

export function formatHoursToDuration(hours) {
  if (!hours || isNaN(hours)) return '0h';
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  if (d === 0) return `${h}h`;
  if (h === 0) return `${d}d`;
  return `${d}d ${h}h`;
}

// Consistent date formatting: 'YYYY-MM-DD HH:mm'
export function formatDate(date) {
  if (!date) return '-';
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d)) return '-';
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Ticket validation: returns array of issues
export function validateTicket(ticket) {
  const issues = [];
  if (!ticket.id) issues.push('Missing id');
  if (!ticket.title) issues.push('Missing title');
  // Validate Event_Log
  if (ticket.Event_Log) {
    try {
      const parsed = JSON.parse(ticket.Event_Log);
      if (!Array.isArray(parsed)) issues.push('Event_Log is not an array');
    } catch {
      issues.push('Malformed Event_Log');
    }
  }
  return issues;
}

/**
 * Calculate working hours (Mon-Fri, 8:30-17:30) between two Date objects.
 * Returns a float (hours, can be fractional).
 */
export function calculateWorkingHours(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start) || isNaN(end) || end <= start) return 0;
  const WORK_START_HOUR = 8;
  const WORK_START_MIN = 30;
  const WORK_END_HOUR = 17;
  const WORK_END_MIN = 30;
  let total = 0;
  let current = new Date(start);
  while (current < end) {
    // Skip weekends
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // 0=Sun, 6=Sat
      // Workday boundaries
      const workStart = new Date(current);
      workStart.setHours(WORK_START_HOUR, WORK_START_MIN, 0, 0);
      const workEnd = new Date(current);
      workEnd.setHours(WORK_END_HOUR, WORK_END_MIN, 0, 0);
      // Calculate overlap
      const intervalStart = current > workStart ? current : workStart;
      const intervalEnd = end < workEnd ? end : workEnd;
      if (intervalStart < intervalEnd) {
        total += (intervalEnd - intervalStart) / (1000 * 60 * 60);
      }
    }
    // Move to next day
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }
  return Math.max(0, total);
} 