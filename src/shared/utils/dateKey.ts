export function getVietnamDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date); // YYYY-MM-DD
}

export function getYesterdayDateKey(date = new Date()) {
  const current = new Date(date);
  current.setDate(current.getDate() - 1);

  return getVietnamDateKey(current);
}

export function getDateKeyDaysAgo(daysAgo: number, date = new Date()) {
  const current = new Date(date);
  current.setDate(current.getDate() - daysAgo);

  return getVietnamDateKey(current);
}

export function getLastSevenDateKeys(date = new Date()) {
  return Array.from({ length: 7 }).map((_, index) => {
    const daysAgo = 6 - index;
    return getDateKeyDaysAgo(daysAgo, date);
  });
}
