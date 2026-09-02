document.addEventListener('DOMContentLoaded', () => {
  const START_DATE = new Date('2026-08-31T00:00:00'); // Base date for Numerator
  const DAY_NAMES = {
    1: 'Понеділок',
    2: 'Вівторок',
    3: 'Середа',
    4: 'Четвер',
    5: "П'ятниця",
    6: 'Субота'
  };

  // Pair times
  const PAIR_TIMES = {
    1: "08:30-09:50",
    2: "10:10-11:30",
    3: "11:50-13:10",
    4: "13:30-14:50",
    5: "15:10-16:30",
    6: "16:50-18:10",
    7: "18:30-19:50"
  };

  let currentWeekType = 'numerator';
  let selectedDay = 1;

  // Editor State
  let editorWeekType = 'numerator';
  let editorSelectedDay = 1;



  // DOM Elements
  const weekInputs = document.querySelectorAll('input[name="week-type"]');
  const dayTabs = document.querySelectorAll('.day-tab');
  const scheduleContainer = document.getElementById('scheduleContainer');
  const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
  const notifyToggleBtns = document.querySelectorAll('.notify-toggle-btn');
  const metaThemeColor = document.getElementById('meta-theme-color');
  
  // Profile Elements
  const desktopProfileBtn = document.getElementById('desktopProfileBtn');
  const mobileProfileBtn = document.getElementById('mobileProfileBtn');
  const profileNameSpans = document.querySelectorAll('.selected-group-name');

  // --- Profiles & DB Management ---
  function getProfiles() {
    try {
      return JSON.parse(localStorage.getItem('schedule_profiles')) || [];
    } catch(e) {
      return [];
    }
  }

  function setProfiles(profiles) {
    localStorage.setItem('schedule_profiles', JSON.stringify(profiles));
  }

  function getActiveProfileId() {
    return localStorage.getItem('active_profile_id') || '';
  }

  function setActiveProfileId(id) {
    localStorage.setItem('active_profile_id', id);
  }

  function getActiveProfile() {
    const profiles = getProfiles();
    const activeId = getActiveProfileId();
    let profile = profiles.find(p => p.id === activeId);
    if (!profile && profiles.length > 0) {
      profile = profiles[0];
      setActiveProfileId(profile.id);
    }
    return profile || null;
  }

  function saveActiveProfile(updatedProfile) {
    const profiles = getProfiles();
    const activeId = getActiveProfileId();
    const idx = profiles.findIndex(p => p.id === activeId);
    if (idx !== -1) {
      profiles[idx] = updatedProfile;
      setProfiles(profiles);
    }
  }

  function createEmptySchedule() {
    return { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] };
  }

  // Initialize DB
  initDB();

  function initDB() {
    let profiles = getProfiles();

    // 1. Migration from old single-profile storage
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

    if (profiles.length === 0) {
      const defaultProfile = {
        id: 'prof_' + Date.now(),
        name: 'КІБ-25011б',
        numerator: createEmptySchedule(),
        denominator: createEmptySchedule()
      };
      profiles = [defaultProfile];
      setProfiles(profiles);
      setActiveProfileId(defaultProfile.id);
    } else {
      // Deduplicate profiles by name if duplicates were created during testing
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

    // Always fetch schedule.json to keep template for КІБ-25011б in sync with local file
    fetch('assets/schedule.json?v=' + Date.now())
      .then(res => res.json())
      .then(data => {
        if (!data || !data.templates) return;
        const kibTpl = data.templates['КІБ-25011б'];
        if (!kibTpl) return;

        let currentProfiles = getProfiles();
        const kibIdx = currentProfiles.findIndex(p => p.name === 'КІБ-25011б');

        if (kibIdx !== -1) {
          currentProfiles[kibIdx].numerator = JSON.parse(JSON.stringify(kibTpl.numerator));
          currentProfiles[kibIdx].denominator = JSON.parse(JSON.stringify(kibTpl.denominator));
          setProfiles(currentProfiles);

          if (getActiveProfileId() === currentProfiles[kibIdx].id) {
            setDB(kibTpl.numerator, kibTpl.denominator);
            renderSchedule();
            updateProfileUI();
          }
        }
      })
      .catch(err => console.warn('Could not sync template from schedule.json:', err));

    init();
  }

  function getDB() {
    const profile = getActiveProfile();
    if (profile && profile.numerator && profile.denominator) {
      return { num: profile.numerator, den: profile.denominator };
    }
    return { num: createEmptySchedule(), den: createEmptySchedule() };
  }

  function setDB(num, den) {
    const profile = getActiveProfile();
    if (profile) {
      profile.numerator = num;
      profile.denominator = den;
      saveActiveProfile(profile);
    }
    // Also save separate numerator and denominator keys for full compatibility
    localStorage.setItem('custom_schedule_numerator', JSON.stringify(num));
    localStorage.setItem('custom_schedule_denominator', JSON.stringify(den));
  }

  function init() {
    initTheme();
    calculateCurrentWeekAndDay();
    setupEventListeners();
    updateProfileUI();
    renderSchedule();
    checkNotificationStatus();
    registerServiceWorker();
    startLiveTimer();
  }

  // Timer to update live status automatically
  let lastMinute = new Date().getMinutes();
  function startLiveTimer() {
    setInterval(() => {
      const currentMinute = new Date().getMinutes();
      if (currentMinute !== lastMinute) {
        lastMinute = currentMinute;
        renderSchedule(); // re-render dynamically
      }
    }, 1000);
  }

  function updateProfileUI() {
    const profile = getActiveProfile();
    const pName = profile ? profile.name : 'Мій розклад';
    profileNameSpans.forEach(el => el.textContent = pName);
    const profileNameInput = document.getElementById('profileNameInput');
    if (profileNameInput && profile) {
      profileNameInput.value = profile.name;
    }
    renderProfilesList();
  }

  // --- Custom Select Handling ---
  function initCustomSelect(wrapperId, hiddenInputId) {
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
        // Adaptively check available space below on all screen sizes
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

  function setCustomSelectValue(wrapperId, hiddenInputId, value) {
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

  function renderProfilesList() {
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
          switchProfile(p.id);
        }
      });

      const actions = document.createElement('div');
      actions.className = 'profile-card-actions';

      // Show delete button only for non-active profiles when multiple exist
      if (!isActive && profiles.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.className = 'profile-delete-btn';
        delBtn.title = 'Видалити цей розклад';
        delBtn.innerHTML = '<i class="ph ph-trash"></i>';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteProfile(p.id, p.name);
        });
        actions.appendChild(delBtn);
      }

      card.appendChild(left);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  function switchProfile(id) {
    setActiveProfileId(id);
    updateProfileUI();
    renderSchedule();
  }

  function deleteProfile(id, name) {
    if (!confirm(`Ви дійсно бажаєте видалити розклад "${name}"?`)) return;
    let profiles = getProfiles();
    profiles = profiles.filter(p => p.id !== id);
    setProfiles(profiles);

    if (getActiveProfileId() === id && profiles.length > 0) {
      setActiveProfileId(profiles[0].id);
    }
    updateProfileUI();
    renderSchedule();
  }

  function calculateCurrentWeekAndDay() {
    const now = new Date();
    let dayOfWeek = now.getDay();
    let dateForCalc = new Date(now.getTime());

    const db = getDB();
    const hasSaturdayClasses = (db.num && db.num["6"] && db.num["6"].length > 0) ||
                               (db.den && db.den["6"] && db.den["6"].length > 0);

    if (dayOfWeek === 0) {
      dateForCalc.setDate(dateForCalc.getDate() + 1);
      selectedDay = 1;
    } else if (dayOfWeek === 6 && !hasSaturdayClasses) {
      dateForCalc.setDate(dateForCalc.getDate() + 2);
      selectedDay = 1;
    } else {
      selectedDay = dayOfWeek;
    }

    dateForCalc.setHours(0, 0, 0, 0);
    const diffTime = dateForCalc.getTime() - START_DATE.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const currentWeekNumber = Math.floor(diffDays / 7);

    currentWeekType = (currentWeekNumber % 2 === 0) ? 'numerator' : 'denominator';

    updateWeekToggleUI();
    updateDayTabsUI();
  }

  function setWeekType(type) {
    if (currentWeekType === type) return;
    currentWeekType = type;
    updateWeekToggleUI();
    renderSchedule();
  }

  function updateWeekToggleUI() {
    const toggleContainer = document.getElementById('weekToggle');
    if (toggleContainer) {
      toggleContainer.setAttribute('data-week', currentWeekType);
    }
    const numInput = document.getElementById('num-week');
    const denInput = document.getElementById('den-week');
    if (numInput) numInput.checked = (currentWeekType === 'numerator');
    if (denInput) denInput.checked = (currentWeekType === 'denominator');
  }

  function updateDayTabsUI() {
    dayTabs.forEach(tab => {
      if (parseInt(tab.dataset.day) === selectedDay) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    document.querySelectorAll('.day-column').forEach(col => {
      if (parseInt(col.dataset.day) === selectedDay) {
        col.classList.add('active');
      } else {
        col.classList.remove('active');
      }
    });
  }

  function setupEventListeners() {
    const weekToggleContainer = document.getElementById('weekToggle');
    if (weekToggleContainer) {
      weekToggleContainer.addEventListener('click', (e) => {
        const numLabel = document.getElementById('num-label');
        const denLabel = document.getElementById('den-label');
        if (e.target === numLabel || e.target.id === 'num-week') {
          setWeekType('numerator');
        } else if (e.target === denLabel || e.target.id === 'den-week') {
          setWeekType('denominator');
        } else {
          const rect = weekToggleContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          if (clickX < rect.width / 2) setWeekType('numerator');
          else setWeekType('denominator');
        }
      });
    }

    weekInputs.forEach(input => {
      input.addEventListener('change', (e) => setWeekType(e.target.value));
    });

    dayTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        selectedDay = parseInt(e.currentTarget.dataset.day);
        updateDayTabsUI();
      });
    });

    themeToggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
      });
    });

    notifyToggleBtns.forEach(btn => {
      btn.addEventListener('click', handleNotifyToggle);
    });

    // Profile Modal
    const profileModalBackdrop = document.getElementById('profileModalBackdrop');
    if (desktopProfileBtn) desktopProfileBtn.addEventListener('click', openProfileModal);
    if (mobileProfileBtn) mobileProfileBtn.addEventListener('click', openProfileModal);
    
    document.getElementById('closeProfileModal').addEventListener('click', () => {
      profileModalBackdrop.classList.remove('open');
    });

    document.getElementById('saveProfileBtn').addEventListener('click', () => {
      const newName = document.getElementById('profileNameInput').value.trim();
      if (newName) {
        const profile = getActiveProfile();
        if (profile) {
          profile.name = newName;
          saveActiveProfile(profile);
          updateProfileUI();
          alert(`Назву розкладу змінено на "${newName}"`);
        }
      } else {
        alert('Введіть назву розкладу!');
      }
    });

    const addEmptyProfileBtn = document.getElementById('addEmptyProfileBtn');
    if (addEmptyProfileBtn) {
      addEmptyProfileBtn.addEventListener('click', () => {
        const name = prompt('Введіть назву для нового розкладу:', 'Друга спеціальність');
        if (!name || !name.trim()) return;

        const newProfile = {
          id: 'prof_' + Date.now(),
          name: name.trim(),
          numerator: createEmptySchedule(),
          denominator: createEmptySchedule()
        };

        const profiles = getProfiles();
        profiles.push(newProfile);
        setProfiles(profiles);
        setActiveProfileId(newProfile.id);

        updateProfileUI();
        renderSchedule();
      });
    }

    document.getElementById('resetScheduleBtn').addEventListener('click', () => {
      const profile = getActiveProfile();
      if (!profile) return;
      if (confirm(`Очистити всі пари активного розкладу "${profile.name}"?`)) {
        setDB(createEmptySchedule(), createEmptySchedule());
        renderSchedule();
      }
    });

    const loadTemplateBtn = document.getElementById('loadTemplateBtn');
    if (loadTemplateBtn) {
      loadTemplateBtn.addEventListener('click', () => {
        const sel = document.getElementById('templateSelect');
        const tplName = sel.value;
        if (!tplName) {
          alert('Будь ласка, оберіть шаблон.');
          return;
        }

        fetch('assets/schedule.json?v=' + Date.now())
          .then(res => res.json())
          .then(data => {
             const tpl = data.templates && data.templates[tplName];
             if (tpl) {
               const profiles = getProfiles();
               const existingIdx = profiles.findIndex(p => p.name === tplName);

               if (existingIdx !== -1) {
                 profiles[existingIdx].numerator = JSON.parse(JSON.stringify(tpl.numerator));
                 profiles[existingIdx].denominator = JSON.parse(JSON.stringify(tpl.denominator));
                 setProfiles(profiles);
                 setActiveProfileId(profiles[existingIdx].id);
                 setDB(tpl.numerator, tpl.denominator);
                 updateProfileUI();
                 renderSchedule();
                 setCustomSelectValue('templateSelectWrapper', 'templateSelect', '');
                 alert(`Розклад "${tplName}" успішно оновлено з файлу!`);
               } else {
                 const newProfile = {
                   id: 'prof_' + Date.now(),
                   name: tplName,
                   numerator: JSON.parse(JSON.stringify(tpl.numerator)),
                   denominator: JSON.parse(JSON.stringify(tpl.denominator))
                 };
                 profiles.push(newProfile);
                 setProfiles(profiles);
                 setActiveProfileId(newProfile.id);
                 setDB(tpl.numerator, tpl.denominator);
                 updateProfileUI();
                 renderSchedule();
                 setCustomSelectValue('templateSelectWrapper', 'templateSelect', '');
                 alert(`Розклад "${tplName}" успішно додано до ваших розкладів!`);
               }
             } else {
               alert('Шаблон не знайдено.');
             }
          })
          .catch(err => {
             console.error(err);
             alert('Помилка завантаження шаблону.');
          });
      });
    }

    // Editor Modal
    const editorModalBackdrop = document.getElementById('editorModalBackdrop');
    document.getElementById('editScheduleBtn').addEventListener('click', () => {
      profileModalBackdrop.classList.remove('open');
      openEditorModal();
    });
    
    document.getElementById('closeEditorModal').addEventListener('click', () => {
      editorModalBackdrop.classList.remove('open');
      renderSchedule(); // Render changes when exiting editor
    });

    // Editor Week Toggle
    const editorWeekToggleContainer = document.getElementById('editorWeekToggle');
    editorWeekToggleContainer.addEventListener('click', (e) => {
      const numLabel = document.getElementById('editor-num-label');
      const denLabel = document.getElementById('editor-den-label');
      if (e.target === numLabel || e.target.id === 'editor-num-week') {
        editorWeekType = 'numerator';
      } else if (e.target === denLabel || e.target.id === 'editor-den-week') {
        editorWeekType = 'denominator';
      } else {
        const rect = editorWeekToggleContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        editorWeekType = (clickX < rect.width / 2) ? 'numerator' : 'denominator';
      }
      editorWeekToggleContainer.setAttribute('data-week', editorWeekType);
      document.getElementById('editor-num-week').checked = (editorWeekType === 'numerator');
      document.getElementById('editor-den-week').checked = (editorWeekType === 'denominator');
      renderEditorClasses();
    });

    // Editor Days Nav
    document.querySelectorAll('#editorDaysNav .course-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#editorDaysNav .course-chip').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        editorSelectedDay = parseInt(e.currentTarget.dataset.editday);
        renderEditorClasses();
      });
    });

    // Add Class Button
    document.getElementById('addClassBtn').addEventListener('click', () => {
       openEditClassModal(null);
    });

    // Edit Class Modal
    const editClassModalBackdrop = document.getElementById('editClassModalBackdrop');
    document.getElementById('closeEditClassModal').addEventListener('click', () => {
      editClassModalBackdrop.classList.remove('open');
    });

    document.getElementById('saveClassBtn').addEventListener('click', saveClass);
    document.getElementById('deleteClassBtn').addEventListener('click', deleteClass);

    // Initialize custom selects
    initCustomSelect('templateSelectWrapper', 'templateSelect');
    initCustomSelect('editClassTypeWrapper', 'editClassType');

    // Close any open custom select when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-select-container.open').forEach(c => c.classList.remove('open'));
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const editClassBackdrop = document.getElementById('editClassModalBackdrop');
        const editorBackdrop = document.getElementById('editorModalBackdrop');
        const profileBackdrop = document.getElementById('profileModalBackdrop');

        if (editClassBackdrop && editClassBackdrop.classList.contains('open')) {
          editClassBackdrop.classList.remove('open');
        } else if (editorBackdrop && editorBackdrop.classList.contains('open')) {
          editorBackdrop.classList.remove('open');
          renderSchedule();
        } else if (profileBackdrop && profileBackdrop.classList.contains('open')) {
          profileBackdrop.classList.remove('open');
        }
        document.querySelectorAll('.custom-select-container.open').forEach(c => c.classList.remove('open'));
      }
    });
  }

  function openProfileModal() {
    updateProfileUI();
    document.getElementById('profileModalBackdrop').classList.add('open');
  }

  function openEditorModal() {
    editorWeekType = currentWeekType;
    editorSelectedDay = selectedDay > 5 ? 1 : selectedDay; // Default to Mon if Sunday
    
    document.getElementById('editorWeekToggle').setAttribute('data-week', editorWeekType);
    document.getElementById('editor-num-week').checked = (editorWeekType === 'numerator');
    document.getElementById('editor-den-week').checked = (editorWeekType === 'denominator');
    
    document.querySelectorAll('#editorDaysNav .course-chip').forEach(btn => {
      if(parseInt(btn.dataset.editday) === editorSelectedDay) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    document.getElementById('editorModalBackdrop').classList.add('open');
    renderEditorClasses();
  }

  function renderEditorClasses() {
    const container = document.getElementById('editorClassesContainer');
    container.innerHTML = '';
    
    const db = getDB();
    const schedule = editorWeekType === 'numerator' ? db.num : db.den;
    const dayClasses = schedule[editorSelectedDay] || [];

    // Sort by pair number
    dayClasses.sort((a, b) => a.pair - b.pair);

    if (dayClasses.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--color-ash); padding: 20px;">Пар немає. Додайте нову пару.</div>`;
      return;
    }

    dayClasses.forEach(cls => {
      const timeStr = PAIR_TIMES[cls.pair] || '';
      const typeClass = cls.type === 'Лекція' ? 'lecture' : 'practice';

      const card = document.createElement('div');
      card.className = 'class-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="class-header">
          <div class="class-time">
            <i class="ph ph-clock"></i>
            <span>${cls.pair} пара · ${timeStr}</span>
          </div>
          <div class="class-badges">
            <div class="class-type ${typeClass}">${cls.type}</div>
          </div>
        </div>
        <div class="class-subject">${cls.subject}</div>
        <div class="class-footer">
          <div class="class-location">
            <i class="ph ph-map-pin"></i>
            <span>${cls.location || '-'}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => openEditClassModal(cls));
      container.appendChild(card);
    });
  }

  function openEditClassModal(cls = null) {
    const title = document.getElementById('editClassTitle');
    const btnDel = document.getElementById('deleteClassBtn');
    
    if (cls) {
      title.textContent = 'Редагування пари';
      btnDel.style.display = 'block';
      document.getElementById('editClassId').value = cls.id;
      document.getElementById('editClassNum').value = cls.pair;
      document.getElementById('editClassSubject').value = cls.subject;
      document.getElementById('editClassLocation').value = cls.location || '';
      document.getElementById('editClassLink').value = cls.link || '';
      document.getElementById('editClassType').value = cls.type;
      setCustomSelectValue('editClassTypeWrapper', 'editClassType', cls.type);
    } else {
      title.textContent = 'Нова пара';
      btnDel.style.display = 'none';
      document.getElementById('editClassId').value = '';
      document.getElementById('editClassNum').value = '';
      document.getElementById('editClassSubject').value = '';
      document.getElementById('editClassLocation').value = '';
      document.getElementById('editClassLink').value = '';
      document.getElementById('editClassType').value = 'Лекція';
      setCustomSelectValue('editClassTypeWrapper', 'editClassType', 'Лекція');
    }
    document.getElementById('editClassModalBackdrop').classList.add('open');
  }

  function saveClass() {
    const id = document.getElementById('editClassId').value;
    const pair = parseInt(document.getElementById('editClassNum').value);
    const subject = document.getElementById('editClassSubject').value.trim();
    const location = document.getElementById('editClassLocation').value.trim();
    const link = document.getElementById('editClassLink').value.trim();
    const type = document.getElementById('editClassType').value;

    if (!pair || pair < 1 || pair > 7 || !subject) {
      alert("Вкажіть номер пари та предмет!");
      return;
    }

    const db = getDB();
    const schedule = editorWeekType === 'numerator' ? db.num : db.den;
    
    // Check if pair already exists (and it's not the one we are editing)
    const existing = schedule[editorSelectedDay].find(c => c.pair === pair);
    if (existing && existing.id !== id) {
       alert(`Пара ${pair} вже існує у цьому дні! Видаліть або змініть її спочатку.`);
       return;
    }

    if (id) {
      const idx = schedule[editorSelectedDay].findIndex(c => c.id === id);
      if (idx !== -1) {
        schedule[editorSelectedDay][idx] = { id, pair, subject, location, link, type };
      }
    } else {
      if(!schedule[editorSelectedDay]) schedule[editorSelectedDay] = [];
      schedule[editorSelectedDay].push({
        id: Date.now().toString(),
        pair, subject, location, link, type
      });
    }

    setDB(db.num, db.den);
    document.getElementById('editClassModalBackdrop').classList.remove('open');
    renderEditorClasses();
  }

  function deleteClass() {
    if(!confirm("Видалити цю пару?")) return;
    const id = document.getElementById('editClassId').value;
    const db = getDB();
    const schedule = editorWeekType === 'numerator' ? db.num : db.den;
    
    schedule[editorSelectedDay] = schedule[editorSelectedDay].filter(c => c.id !== id);
    
    setDB(db.num, db.den);
    document.getElementById('editClassModalBackdrop').classList.remove('open');
    renderEditorClasses();
  }

  function renderSchedule() {
    scheduleContainer.innerHTML = '';
    const db = getDB();
    const schedule = currentWeekType === 'numerator' ? db.num : db.den;

    const now = new Date();
    const todayDayOfWeek = now.getDay();
    const currentTotalM = now.getHours() * 60 + now.getMinutes();

    const satTabItem = document.getElementById('satTabItem');
    const hasSat = (schedule["6"] && schedule["6"].length > 0);
    if (satTabItem) satTabItem.style.display = hasSat ? 'list-item' : 'none';

    let maxDay = hasSat ? 6 : 5;
    if (selectedDay === 6 && !hasSat) {
      selectedDay = 1;
      updateDayTabsUI();
    }

    for (let day = 1; day <= maxDay; day++) {
      const dayColumn = document.createElement('div');
      dayColumn.className = `day-column ${day === selectedDay ? 'active' : ''}`;
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
      filteredSchedule.sort((a,b) => a.pair - b.pair);

      if (filteredSchedule.length === 0) {
        classesDiv.innerHTML = `
          <div class="day-empty">
            <i class="ph ph-coffee"></i>
            <span>Пар немає</span>
          </div>
        `;
      } else {
        filteredSchedule.forEach((cls, index) => {
          const timeStr = PAIR_TIMES[cls.pair] || '';
          const [startStr, endStr] = timeStr.split('-');
          const link = cls.link || '#';
          
          let typeLabel = cls.type;
          const typeClass = typeLabel === 'Лекція' ? 'lecture' : 'practice';

          let isLive = false;
          if (isToday && startStr && endStr) {
            const [startH, startM] = startStr.split(':').map(Number);
            const [endH, endM] = endStr.split(':').map(Number);
            const startTotal = startH * 60 + startM;
            const endTotal = endH * 60 + endM;
            if (currentTotalM >= startTotal && currentTotalM <= endTotal) {
              isLive = true;
            }
          }

          const card = document.createElement('div');
          card.className = `class-card ${isLive ? 'is-live' : ''}`;
          card.style.animationDelay = `${index * 0.06}s`;

          const liveBadgeHTML = isLive ? `
            <div class="live-badge">
              <div class="live-dot"></div>
              Зараз
            </div>
          ` : '';

          let locationHTML = '';
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
                <span>Дистант</span>
              </div>
            `;
          }

          let meetBtnHTML = '';
          const cleanLink = (cls.link || '').trim();
          if (cleanLink && cleanLink !== '#' && cleanLink !== 'about:blank') {
            meetBtnHTML = `
              <a href="${cleanLink}" target="_blank" rel="noopener noreferrer" class="meet-btn">
                <i class="ph ph-video-camera"></i>
                Перейти
              </a>
            `;
          }

          card.innerHTML = `
            <div class="class-header">
              <div class="class-time">
                <i class="ph ph-clock"></i>
                <span>${cls.pair} пара · ${timeStr}</span>
              </div>
              <div class="class-badges">
                ${liveBadgeHTML}
                <div class="class-type ${typeClass}">${typeLabel}</div>
              </div>
            </div>
            <div class="class-subject">${cls.subject}</div>
            <div class="class-footer">
              ${locationHTML}
              ${meetBtnHTML}
            </div>
          `;
          classesDiv.appendChild(card);
        });
      }

      dayColumn.appendChild(classesDiv);
      scheduleContainer.appendChild(dayColumn);
    }
  }

  // --- Theme ---
  function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) setTheme(e.matches ? 'dark' : 'light');
    });
  }

  function setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      metaThemeColor.setAttribute('content', '#000000');
      themeToggleBtns.forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'ph ph-sun';
      });
    } else {
      document.documentElement.removeAttribute('data-theme');
      metaThemeColor.setAttribute('content', '#f5f5f7');
      themeToggleBtns.forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'ph ph-moon';
      });
    }
    localStorage.setItem('theme', theme);
  }

  // --- Notifications ---
  const notifiedClasses = new Set();

  function checkNotificationStatus() {
    if (!("Notification" in window)) {
      notifyToggleBtns.forEach(b => b.style.display = 'none');
      return;
    }
    if (Notification.permission === "granted") {
      notifyToggleBtns.forEach(b => b.classList.add('active'));
    }
  }

  function handleNotifyToggle() {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      alert("Щоб вимкнути сповіщення, змініть налаштування у браузері.");
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          notifyToggleBtns.forEach(b => b.classList.add('active'));
          setupAlarms();
        }
      });
    } else {
      alert("Сповіщення заблоковані у вашому браузері.");
    }
  }

  function setupAlarms() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    // Check every 30 seconds for upcoming classes, avoiding background tab throttling
    setInterval(() => {
      const now = new Date();
      let dayOfWeek = now.getDay();
      if (dayOfWeek === 0) return;

      // Calculate actual calendar week (not preview UI toggle state)
      const diffTime = now.getTime() - START_DATE.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const actualWeekNumber = Math.floor(diffDays / 7);
      const actualWeekType = (actualWeekNumber % 2 === 0) ? 'numerator' : 'denominator';

      const db = getDB();
      const schedule = (actualWeekType === 'numerator') ? db.num : db.den;
      const dayData = schedule[dayOfWeek] || [];

      dayData.forEach(cls => {
        const timeStr = PAIR_TIMES[cls.pair];
        if (!timeStr) return;

        const [startStr] = timeStr.split('-');
        const [startH, startM] = startStr.split(':').map(Number);

        const targetTime = new Date(now.getTime());
        targetTime.setHours(startH, startM, 0, 0);

        const diffMinutes = Math.round((targetTime.getTime() - now.getTime()) / 60000);
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

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .catch(err => console.warn('ServiceWorker registration failed:', err));
      });
    }
  }

  if ("Notification" in window && Notification.permission === "granted") {
    setupAlarms();
  }
});
