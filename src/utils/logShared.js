import path from 'node:path';

const pad2 = (value) => String(value).padStart(2, '0');
const pad3 = (value) => String(value).padStart(3, '0');

export const formatLocalTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  const millis = pad3(date.getMilliseconds());

  const tzOffsetMinutes = -date.getTimezoneOffset();
  const sign = tzOffsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(tzOffsetMinutes);
  const offsetHours = pad2(Math.floor(absOffset / 60));
  const offsetMinutes = pad2(absOffset % 60);

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${millis}${sign}${offsetHours}:${offsetMinutes}`;
};

export const getDateStamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

export const getDailyLogFilePath = (logDir, date = new Date()) =>
  path.join(logDir, `${getDateStamp(date)}.log`);

export const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
