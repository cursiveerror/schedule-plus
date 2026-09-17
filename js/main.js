import { initDB } from './storage.js';
import { initTheme } from './theme.js';
import { calculateCurrentWeekAndDay, updateProfileUI, renderSchedule, initCustomSelect, updateLiveStatus } from './ui.js';
import { setupEventListeners } from './events.js';
import { checkNotificationStatus, registerServiceWorker } from './notifications.js';
import { autoSyncIfSubscribed } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  initDB();
  initTheme();
  calculateCurrentWeekAndDay();
  
  // Custom Selects initialization
  initCustomSelect('templateSelectWrapper', 'templateSelect');
  initCustomSelect('editClassTypeWrapper', 'editClassType');
  
  setupEventListeners();
  updateProfileUI();
  renderSchedule();
  checkNotificationStatus();
  registerServiceWorker();

  // Автоматична синхронізація розкладу з сервером при будь-якій його зміні
  document.addEventListener('scheduleUpdated', () => {
    autoSyncIfSubscribed();
  });

  // Timer for live status updates
  let lastMinute = new Date().getMinutes();
  setInterval(() => {
    const currentMinute = new Date().getMinutes();
    if (currentMinute !== lastMinute) {
      lastMinute = currentMinute;
      updateLiveStatus();
    }
  }, 1000);
});
