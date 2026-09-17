import { START_DATE } from './state.js';
import { getDB } from './storage.js';
import { syncScheduleWithServer, getPublicVapidKey } from './api.js';
import { getMinutesToClassStart } from './utils.js';

const notifiedClasses = new Set();

export function checkNotificationStatus() {
  const notifyToggleBtns = document.querySelectorAll('.notify-toggle-btn');
  if (!("Notification" in window)) {
    notifyToggleBtns.forEach(b => b.style.display = 'none');
    return;
  }
  if (Notification.permission === "granted") {
    notifyToggleBtns.forEach(b => b.classList.add('active'));
  }
}

export function setupAlarms() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  setInterval(() => {
    const now = new Date();
    let dayOfWeek = now.getDay();
    if (dayOfWeek === 0) return;

    const diffTime = now.getTime() - START_DATE.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const actualWeekNumber = Math.floor(diffDays / 7);
    const actualWeekType = (actualWeekNumber % 2 === 0) ? 'numerator' : 'denominator';

    const db = getDB();
    const schedule = (actualWeekType === 'numerator') ? db.num : db.den;
    const dayData = schedule[dayOfWeek] || [];

    dayData.forEach(cls => {
      const diffMinutes = getMinutesToClassStart(cls.pair);
      if (diffMinutes === -1) return;

      const notificationKey = `${now.toDateString()}_${actualWeekType}_${dayOfWeek}_${cls.pair}_${cls.subject}`;

      if (diffMinutes >= 0 && diffMinutes <= 10 && !notifiedClasses.has(notificationKey)) {
        notifiedClasses.add(notificationKey);
        new Notification("Скоро пара!", {
          body: `${cls.subject} почнеться ${diffMinutes > 0 ? 'через ' + diffMinutes + ' хв' : 'зараз'}.`,
          icon: "assets/schedule-plus.svg"
        });
      }
    });
  }, 30000);
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .catch(err => console.warn('ServiceWorker registration failed:', err));
    });
  }
}

export async function handlePushSubscribe(e) {
  if (e) e.preventDefault();
  const notifyToggleBtns = document.querySelectorAll('.notify-toggle-btn');

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Push-сповіщення не підтримуються вашим браузером.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Ви відхилили дозвіл на сповіщення.');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(getPublicVapidKey())
      });
    }

    const success = await syncScheduleWithServer(subscription);

    if (success) {
      alert('Сповіщення успішно увімкнено!');
      notifyToggleBtns.forEach(b => b.classList.add('active'));
      setupAlarms();
    } else {
      alert('Помилка сервера при збереженні підписки та розкладу.');
    }

  } catch (err) {
    console.error('Push error:', err);
    alert('Помилка при налаштуванні сповіщень: ' + err.message);
  }
}

