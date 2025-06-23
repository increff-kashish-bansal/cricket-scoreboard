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
  if (typeof hours !== 'number' || isNaN(hours) || hours < 0) return '0h';
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  let result = '';
  if (d > 0) result += `${d}d`;
  if (h > 0) result += (result ? ' ' : '') + `${h}h`;
  if (!result) result = '0h';
  return result;
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