/**
 * Split a date range into chunks of specified days
 */
export function splitDateRangeIntoChunks(
  fromDate,
  toDate,
  daysPerChunk = 5,
) {
  const chunks = [];
  let currentStart = new Date(fromDate);

  while (currentStart <= toDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + (daysPerChunk - 1)); // Add (daysPerChunk - 1) days

    // Don't go beyond the end date
    if (currentEnd > toDate) {
      currentEnd.setTime(toDate.getTime());
    }

    chunks.push({
      from: new Date(currentStart),
      to: new Date(currentEnd),
    });

    // Move to next chunk (start from the day after currentEnd)
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return chunks;
}

/**
 * Format date to YYYY-MM-DD for input[type="date"]
 */
export function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date to dd-mmm-yy format
 */
export function formatDateDisplay(dateStr) {
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}
