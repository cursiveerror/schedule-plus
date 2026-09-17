import { getActiveProfile } from './storage.js';

const PUBLIC_VAPID_KEY = 'BO6yfOA8xe7qHUIPCh7LeMXNSH-D6Cc_2i_sgN4SJV3nLQDsplIN1LJB7iPWuEmje1hPoX4BE08a_CVAGgqYCeM';
const SERVER_URL = 'https://schedule-plus.pp.ua';

export async function syncScheduleWithServer(subscription) {
  const profile = getActiveProfile();
  if (!profile) return false;
  
  const payload = {
    subscription: subscription,
    schedule: {
      numerator: profile.numerator,
      denominator: profile.denominator
    }
  };

  try {
    const response = await fetch(`${SERVER_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (e) {
    console.error('Error syncing schedule:', e);
    return false;
  }
}

export function getPublicVapidKey() {
  return PUBLIC_VAPID_KEY;
}

export async function autoSyncIfSubscribed() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await syncScheduleWithServer(subscription);
      }
    } catch (e) {
      console.error('Error checking subscription for auto-sync:', e);
    }
  }
}
