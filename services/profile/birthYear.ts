/** A four-digit year for someone between 13 and 100 years old this year. */
export function isValidBirthYear(year: string, now = new Date()): boolean {
  if (!/^\d{4}$/.test(year)) return false;
  const parsed = Number(year);
  const current = now.getFullYear();
  return parsed >= current - 100 && parsed <= current - 13;
}
