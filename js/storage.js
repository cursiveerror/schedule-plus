export function getProfiles() {
  try {
    return JSON.parse(localStorage.getItem('schedule_profiles')) || [];
  } catch (e) {
    return [];
  }
}

export function setProfiles(profiles) {
  localStorage.setItem('schedule_profiles', JSON.stringify(profiles));
}

export function getActiveProfileId() {
  return localStorage.getItem('active_profile_id') || '';
}

export function setActiveProfileId(id) {
  localStorage.setItem('active_profile_id', id);
}

export function getActiveProfile() {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  let profile = profiles.find(p => p.id === activeId);
  if (!profile && profiles.length > 0) {
    profile = profiles[0];
    setActiveProfileId(profile.id);
  }
  return profile || null;
}

export function saveActiveProfile(updatedProfile) {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  const idx = profiles.findIndex(p => p.id === activeId);
  if (idx !== -1) {
    profiles[idx] = updatedProfile;
    setProfiles(profiles);
  }
}

export function createEmptySchedule() {
  return { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] };
}

export function getDB() {
  const profile = getActiveProfile();
  if (profile && profile.numerator && profile.denominator) {
    return { num: profile.numerator, den: profile.denominator };
  }
  return { num: createEmptySchedule(), den: createEmptySchedule() };
}

export function setDB(num, den) {
  const profile = getActiveProfile();
  if (profile) {
    profile.numerator = num;
    profile.denominator = den;
    saveActiveProfile(profile);
  }
  document.dispatchEvent(new CustomEvent('scheduleUpdated'));
}

export function initDB() {
  let profiles = getProfiles();

  // 1. Міграція зі старого сховища (один профіль)
  const oldNum = localStorage.getItem('custom_schedule_numerator');
  const oldDen = localStorage.getItem('custom_schedule_denominator');
  const oldName = localStorage.getItem('profile_name');

  if (profiles.length === 0 && oldNum && oldDen) {
    try {
      const num = JSON.parse(oldNum);
      const den = JSON.parse(oldDen);
      const migratedProfile = {
        id: 'prof_' + Date.now(),
        name: oldName || 'КІБ-25011б',
        numerator: num,
        denominator: den
      };
      profiles = [migratedProfile];
      setProfiles(profiles);
      setActiveProfileId(migratedProfile.id);
    } catch (err) {
      console.error('Migration error:', err);
    }
  }

  // 2. Якщо немає профілів - створюємо дефолтний
  if (profiles.length === 0) {
    const defaultProfile = {
      id: 'prof_' + Date.now(),
      name: 'Мій розклад',
      numerator: createEmptySchedule(),
      denominator: createEmptySchedule()
    };
    profiles = [defaultProfile];
    setProfiles(profiles);
    setActiveProfileId(defaultProfile.id);
  } else {
    // Видаляємо дублікати за іменем (якщо з'явилися під час тестування)
    const uniqueProfiles = [];
    const seenNames = new Set();
    for (const p of profiles) {
      if (!seenNames.has(p.name)) {
        seenNames.add(p.name);
        uniqueProfiles.push(p);
      }
    }
    if (uniqueProfiles.length !== profiles.length) {
      profiles = uniqueProfiles;
      setProfiles(profiles);
    }
  }
}
