// Utility functions for IST time handling

/**
 * Convert IST time to UTC for database storage
 * @param {string} istDateString - Date string in IST (e.g., "2025-08-27T04:00:00")
 * @returns {Date} - UTC Date object
 */
export function istToUtc(istDateString) {
  const istDate = new Date(istDateString);
  // Subtract 5 hours 30 minutes to convert IST to UTC
  const utcDate = new Date(istDate.getTime() - (5 * 60 + 30) * 60 * 1000);
  return utcDate;
}

/**
 * Convert UTC time to IST for display
 * @param {Date} utcDate - UTC Date object
 * @returns {Date} - IST Date object
 */
export function utcToIst(utcDate) {
  // Add 5 hours 30 minutes to convert UTC to IST
  const istDate = new Date(utcDate.getTime() + (5 * 60 + 30) * 60 * 1000);
  return istDate;
}

/**
 * Format date to IST string
 * @param {Date} date - Date object
 * @returns {string} - Formatted IST string
 */
export function formatToIST(date) {
  return utcToIst(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Get current IST time
 * @returns {Date} - Current time in IST
 */
export function getCurrentIST() {
  return utcToIst(new Date());
}

// Example usage:
// const istExpiry = "2025-08-27T04:00:00"; // 4 AM IST
// const utcExpiry = istToUtc(istExpiry); // Converts to UTC for database
// console.log("IST:", istExpiry);
// console.log("UTC:", utcExpiry.toISOString());
