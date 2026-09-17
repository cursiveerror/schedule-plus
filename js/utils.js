import { PAIR_TIMES } from './state.js';

export function isClassLive(pairNumber) {
  const timeStr = PAIR_TIMES[pairNumber];
  if (!timeStr) return false;
  
  const [startStr, endStr] = timeStr.split('-');
  if (!startStr || !endStr) return false;

  const now = new Date();
  const currentTotalM = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  return currentTotalM >= startTotal && currentTotalM <= endTotal;
}

export function getMinutesToClassStart(pairNumber) {
  const timeStr = PAIR_TIMES[pairNumber];
  if (!timeStr) return -1;

  const [startStr] = timeStr.split('-');
  const [startH, startM] = startStr.split(':').map(Number);
  
  const now = new Date();
  const targetTime = new Date(now.getTime());
  targetTime.setHours(startH, startM, 0, 0);

  return Math.round((targetTime.getTime() - now.getTime()) / 60000);
}
