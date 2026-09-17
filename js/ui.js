import { START_DATE, DAY_NAMES, PAIR_TIMES, state } from './state.js';
import { getProfiles, setProfiles, getActiveProfileId, getActiveProfile, getDB, setDB, setActiveProfileId } from './storage.js';
import { isClassLive } from './utils.js';

export function calculateCurrentWeekAndDay() {
  const now = new Date();
  let dayOfWeek = now.getDay();
  let dateForCalc = new Date(now.getTime());

  const db = getDB();
  const hasSaturdayClasses = (db.num && db.num["6"] && db.num["6"].length > 0) ||
    (db.den && db.den["6"] && db.den["6"].length > 0);

  if (dayOfWeek === 0) {
    dateForCalc.setDate(dateForCalc.getDate() + 1);
    state.selectedDay = 1;
  } else if (dayOfWeek === 6 && !hasSaturdayClasses) {
    dateForCalc.setDate(dateForCalc.getDate() + 2);
    state.selectedDay = 1;
  } else {
    state.selectedDay = dayOfWeek;
  }

  dateForCalc.setHours(0, 0, 0, 0);
  const diffTime = dateForCalc.getTime() - START_DATE.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const currentWeekNumber = Math.floor(diffDays / 7);

  state.currentWeekType = (currentWeekNumber % 2 === 0) ? 'numerator' : 'denominator';

  updateWeekToggleUI();
  updateDayTabsUI();
}

export function setWeekType(type) {
  if (state.currentWeekType === type) return;
  state.currentWeekType = type;
  updateWeekToggleUI();
  renderSchedule();
}

export function updateWeekToggleUI() {
  const toggleContainer = document.getElementById('weekToggle');
  if (toggleContainer) {
    toggleContainer.setAttribute('data-week', state.currentWeekType);
  }
  const numInput = document.getElementById('num-week');
  const denInput = document.getElementById('den-week');
  if (numInput) numInput.checked = (state.currentWeekType === 'numerator');
  if (denInput) denInput.checked = (state.currentWeekType === 'denominator');
}

export function updateDayTabsUI() {
  const dayTabs = document.querySelectorAll('.day-tab');
  dayTabs.forEach(tab => {
    if (parseInt(tab.dataset.day) === state.selectedDay) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  document.querySelectorAll('.day-column').forEach(col => {
    if (parseInt(col.dataset.day) === state.selectedDay) {
      col.classList.add('active');
    } else {
      col.classList.remove('active');
    }
  });
}

export function updateProfileUI() {
  const profileNameSpans = document.querySelectorAll('.selected-group-name');
  const profile = getActiveProfile();
  const pName = profile ? profile.name : 'Мій розклад';
  profileNameSpans.forEach(el => el.textContent = pName);

  const profileNameInput = document.getElementById('profileNameInput');
  if (profileNameInput && profile) {
    profileNameInput.value = profile.name;
  }
  renderProfilesList();
}

export function createClassCardHtml(cls, isLive = false, showLiveBadge = false, asEditor = false) {
  const timeStr = PAIR_TIMES[cls.pair] || '';
  const typeClass = cls.type === 'Лекція' ? 'lecture' : 'practice';

  let liveBadgeHTML = '';
  if (showLiveBadge && isLive) {
    liveBadgeHTML = `
      <div class="live-badge">
        <div class="live-dot"></div>
        Зараз
      </div>
    `;
  }

  let locationHTML = '';
  if (asEditor) {
    locationHTML = `
      <div class="class-location">
        <i class="ph ph-map-pin"></i>
        <span>${cls.location || '-'}</span>
      </div>
    `;
  } else {
    if (cls.location && cls.location.trim() !== '') {
      locationHTML = `
        <div class="class-location" title="${cls.location}">
          <i class="ph ph-map-pin"></i>
          <span>${cls.location}</span>
        </div>
      `;
    } else {
      locationHTML = `
        <div class="class-location dist" title="Дистанційно">
          <i class="ph ph-laptop"></i>
          <span>Дистанційно</span>
        </div>
      `;
    }
  }

  let meetBtnHTML = '';
  if (!asEditor) {
    const cleanLink = (cls.link || '').trim();
    if (cleanLink && cleanLink !== '#' && cleanLink !== 'about:blank') {
      meetBtnHTML = `
        <a href="${cleanLink}" target="_blank" rel="noopener noreferrer" class="meet-btn" title="Перейти на пару">
          <i class="ph ph-video-camera"></i>
        </a>
      `;
    }
  }

  return `
    <div class="class-header">
      <div class="class-time">
        <i class="ph ph-clock"></i>
        <span>${cls.pair} пара · ${timeStr}</span>
      </div>
      <div class="class-badges">
        ${liveBadgeHTML}
        <div class="class-type ${typeClass}">${cls.type}</div>
      </div>
    </div>
    <div class="class-subject">${cls.subject}</div>
    <div class="class-footer">
      ${locationHTML}
      ${meetBtnHTML}
    </div>
  `;
}

export function renderSchedule() {
  const scheduleContainer = document.getElementById('scheduleContainer');
  if (!scheduleContainer) return;
  scheduleContainer.innerHTML = '';
  const db = getDB();
  const schedule = state.currentWeekType === 'numerator' ? db.num : db.den;

  const now = new Date();
  const todayDayOfWeek = now.getDay();

  const satTabItem = document.getElementById('satTabItem');
  const hasSat = (schedule["6"] && schedule["6"].length > 0);
  if (satTabItem) satTabItem.style.display = hasSat ? 'list-item' : 'none';

  let maxDay = hasSat ? 6 : 5;
  if (state.selectedDay === 6 && !hasSat) {
    state.selectedDay = 1;
    updateDayTabsUI();
  }

  for (let day = 1; day <= maxDay; day++) {
    const dayColumn = document.createElement('div');
    dayColumn.className = `day-column ${day === state.selectedDay ? 'active' : ''}`;
    dayColumn.dataset.day = day;

    const isToday = (day === todayDayOfWeek);

    const headerDiv = document.createElement('div');
    headerDiv.className = `day-column-header ${isToday ? 'is-today' : ''}`;
    headerDiv.innerHTML = `
      <span class="day-column-title">${DAY_NAMES[day]}</span>
      ${isToday ? '<span class="today-badge">Сьогодні</span>' : ''}
    `;
    dayColumn.appendChild(headerDiv);

    const classesDiv = document.createElement('div');
    classesDiv.className = 'day-column-classes';

    const filteredSchedule = schedule[day] || [];
    filteredSchedule.sort((a, b) => a.pair - b.pair);

    if (filteredSchedule.length === 0) {
      classesDiv.innerHTML = `
        <div class="day-empty">
          <i class="ph ph-coffee"></i>
          <span>Пар немає</span>
        </div>
      `;
    } else {
      filteredSchedule.forEach((cls, index) => {
        let live = false;
        if (isToday) {
          live = isClassLive(cls.pair);
        }

        const card = document.createElement('div');
        card.className = `class-card ${live ? 'is-live' : ''}`;
        card.dataset.pair = cls.pair;
        card.style.animationDelay = `${index * 0.06}s`;

        card.innerHTML = createClassCardHtml(cls, live, true, false);
        classesDiv.appendChild(card);
      });
    }

    dayColumn.appendChild(classesDiv);
    scheduleContainer.appendChild(dayColumn);
  }
}

export function updateLiveStatus() {
  const now = new Date();
  const todayDayOfWeek = now.getDay();

  // Знаходимо колонку сьогоднішнього дня
  const todayColumn = document.querySelector(`.day-column[data-day="${todayDayOfWeek}"]`);
  if (!todayColumn) return;

  // Перевіряємо всі картки пар у цьому дні
  const cards = todayColumn.querySelectorAll('.class-card');
  cards.forEach(card => {
    const pairNumber = parseInt(card.dataset.pair);
    const live = isClassLive(pairNumber);
    const hasLiveClass = card.classList.contains('is-live');

    // Якщо пара почалася, але плашки ще немає
    if (live && !hasLiveClass) {
      card.classList.add('is-live');
      const badgesContainer = card.querySelector('.class-badges');
      if (badgesContainer) {
        const badgeHTML = `<div class="live-badge"><div class="live-dot"></div>Зараз</div>`;
        badgesContainer.insertAdjacentHTML('afterbegin', badgeHTML);
      }
    }
    // Якщо пара закінчилася, а плашка ще є
    else if (!live && hasLiveClass) {
      card.classList.remove('is-live');
      const liveBadge = card.querySelector('.live-badge');
      if (liveBadge) liveBadge.remove();
    }
  });
}

export function renderProfilesList() {
  const container = document.getElementById('profilesListContainer');
  if (!container) return;
  container.innerHTML = '';

  const profiles = getProfiles();
  const activeId = getActiveProfileId();

  profiles.forEach(p => {
    const isActive = (p.id === activeId);
    const card = document.createElement('div');
    card.className = `profile-card ${isActive ? 'active' : ''}`;

    const left = document.createElement('div');
    left.className = 'profile-card-left';
    left.innerHTML = `
      <i class="ph ${isActive ? 'ph-check-circle' : 'ph-circle'}"></i>
      <span class="profile-card-title">${p.name}</span>
      ${isActive ? '<span class="profile-card-tag">Активний</span>' : ''}
    `;
    left.addEventListener('click', () => {
      if (!isActive) {
        setActiveProfileId(p.id);
        updateProfileUI();
        renderSchedule();
      }
    });

    const actions = document.createElement('div');
    actions.className = 'profile-card-actions';

    if (!isActive && profiles.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className = 'profile-delete-btn';
      delBtn.title = 'Видалити цей розклад';
      delBtn.innerHTML = '<i class="ph ph-trash"></i>';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Ви дійсно бажаєте видалити розклад "${p.name}"?`)) return;
        let projs = getProfiles();
        projs = projs.filter(x => x.id !== p.id);

        setProfiles(projs);
        if (getActiveProfileId() === p.id && projs.length > 0) {
          setActiveProfileId(projs[0].id);
        }
        updateProfileUI();
        renderSchedule();
      });
      actions.appendChild(delBtn);
    }

    card.appendChild(left);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

// Select helpers
export function initCustomSelect(wrapperId, hiddenInputId) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  const trigger = wrapper.querySelector('.custom-select-trigger');
  const textSpan = wrapper.querySelector('.custom-select-text');
  const optionsContainer = wrapper.querySelector('.custom-select-options');
  const hiddenInput = document.getElementById(hiddenInputId);

  trigger.onclick = (e) => {
    e.stopPropagation();
    const isOpen = wrapper.classList.contains('open');
    document.querySelectorAll('.custom-select-container.open').forEach(c => c.classList.remove('open'));
    if (!isOpen) {
      const rect = wrapper.getBoundingClientRect();
      const modal = wrapper.closest('.group-modal');
      const modalBottom = modal ? Math.min(modal.getBoundingClientRect().bottom, window.innerHeight) : window.innerHeight;
      const spaceBelow = modalBottom - rect.bottom;

      if (spaceBelow < 140 && rect.top > 120) {
        wrapper.classList.add('drop-up');
      } else {
        wrapper.classList.remove('drop-up');
      }
      wrapper.classList.add('open');
    }
  };

  optionsContainer.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.onclick = (e) => {
      e.stopPropagation();
      const val = opt.dataset.value;
      const optContent = opt.querySelector('.opt-content');
      const displayHTML = optContent ? optContent.innerHTML : opt.textContent.trim();

      hiddenInput.value = val;
      textSpan.innerHTML = displayHTML;

      optionsContainer.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');

      wrapper.classList.remove('open');
    };
  });
}

export function setCustomSelectValue(wrapperId, hiddenInputId, value) {
  const wrapper = document.getElementById(wrapperId);
  const hiddenInput = document.getElementById(hiddenInputId);
  if (!wrapper || !hiddenInput) return;

  hiddenInput.value = value;
  const opt = wrapper.querySelector(`.custom-select-option[data-value="${value}"]`);
  const textSpan = wrapper.querySelector('.custom-select-text');
  if (opt && textSpan) {
    const optContent = opt.querySelector('.opt-content');
    textSpan.innerHTML = optContent ? optContent.innerHTML : opt.textContent.trim();
    wrapper.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  }
}
