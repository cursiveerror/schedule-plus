document.addEventListener('DOMContentLoaded', () => {
  const START_DATE = new Date('2026-08-31T00:00:00'); // Base date for Numerator
  const DAY_NAMES = {
    1: 'Понеділок',
    2: 'Вівторок',
    3: 'Середа',
    4: 'Четвер',
    5: "П'ятниця"
  };

  let scheduleData = null;
  let currentWeekType = 'numerator';
  let selectedDay = 1;

  // DOM Elements
  const weekInputs = document.querySelectorAll('input[name="week-type"]');
  const dayTabs = document.querySelectorAll('.day-tab');
  const scheduleContainer = document.getElementById('scheduleContainer');
  const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
  const notifyToggleBtns = document.querySelectorAll('.notify-toggle-btn');
  const metaThemeColor = document.getElementById('meta-theme-color');

  // Load Data
  fetch('assets/schedule.json')
    .then(res => res.json())
    .then(data => {
      scheduleData = data;
      init();
    })
    .catch(err => console.error("Error loading schedule:", err));

  function init() {
    initTheme();
    calculateCurrentWeekAndDay();
    setupEventListeners();
    renderSchedule();
    checkNotificationStatus();
    registerServiceWorker();
  }

  function calculateCurrentWeekAndDay() {
    const now = new Date();
    
    // Day of week: 0 is Sunday, 1 is Monday ... 6 is Saturday
    let dayOfWeek = now.getDay();
    
    // If weekend (0 or 6), jump to next Monday
    let dateForCalc = new Date(now.getTime());
    if (dayOfWeek === 0) {
      dateForCalc.setDate(dateForCalc.getDate() + 1);
      selectedDay = 1;
    } else if (dayOfWeek === 6) {
      dateForCalc.setDate(dateForCalc.getDate() + 2);
      selectedDay = 1;
    } else {
      selectedDay = dayOfWeek;
    }

    // Reset dateForCalc to midnight for accurate week calc
    dateForCalc.setHours(0, 0, 0, 0);
    
    const diffTime = dateForCalc.getTime() - START_DATE.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const currentWeekNumber = Math.floor(diffDays / 7);
    
    // Even week (0, 2, 4...) -> Numerator, Odd week (1, 3, 5...) -> Denominator
    currentWeekType = (currentWeekNumber % 2 === 0) ? 'numerator' : 'denominator';

    // Update UI
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

    // Update active day column on mobile view
    document.querySelectorAll('.day-column').forEach(col => {
      if (parseInt(col.dataset.day) === selectedDay) {
        col.classList.add('active');
      } else {
        col.classList.remove('active');
      }
    });
  }

  function setupEventListeners() {
    // Week toggle - direct container click & input listener
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
          // Calculate which half was clicked
          const rect = weekToggleContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          if (clickX < rect.width / 2) {
            setWeekType('numerator');
          } else {
            setWeekType('denominator');
          }
        }
      });
    }

    weekInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        setWeekType(e.target.value);
      });
    });

    // Day tabs
    dayTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        selectedDay = parseInt(e.currentTarget.dataset.day);
        updateDayTabsUI();
      });
    });

    // Theme toggle (both mobile & desktop buttons)
    themeToggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
      });
    });

    // Notify toggle (both mobile & desktop buttons)
    notifyToggleBtns.forEach(btn => {
      btn.addEventListener('click', handleNotifyToggle);
    });
  }

  function renderSchedule() {
    scheduleContainer.innerHTML = '';
    
    if (!scheduleData || !scheduleData.schedule) {
      return;
    }

    const now = new Date();
    const todayDayOfWeek = now.getDay();
    const currentTotalM = now.getHours() * 60 + now.getMinutes();

    // Render all 5 weekdays (1 to 5)
    for (let day = 1; day <= 5; day++) {
      const dayColumn = document.createElement('div');
      dayColumn.className = `day-column ${day === selectedDay ? 'active' : ''}`;
      dayColumn.dataset.day = day;

      const isToday = (day === todayDayOfWeek);

      // Day Column Header
      const headerDiv = document.createElement('div');
      headerDiv.className = `day-column-header ${isToday ? 'is-today' : ''}`;
      headerDiv.innerHTML = `
        <span class="day-column-title">${DAY_NAMES[day]}</span>
        ${isToday ? '<span class="today-badge">Сьогодні</span>' : ''}
      `;
      dayColumn.appendChild(headerDiv);

      // Day Classes Container
      const classesDiv = document.createElement('div');
      classesDiv.className = 'day-column-classes';

      const rawSchedule = scheduleData.schedule[day] || [];
      const filteredSchedule = rawSchedule.filter(cls => {
        if (!cls.weekType) return true;
        return cls.weekType === currentWeekType;
      });

      if (filteredSchedule.length === 0) {
        classesDiv.innerHTML = `
          <div class="day-empty">
            <i class="ph ph-coffee"></i>
            <span>Пар немає</span>
          </div>
        `;
      } else {
        filteredSchedule.forEach((cls, index) => {
          const timeObj = scheduleData.times[cls.num];
          const link = scheduleData.links[cls.link] || '#';
          const typeLabel = cls.type === 'lecture' ? 'Лекція' : 'Практика';

          // Live class check
          let isLive = false;
          if (isToday) {
            const [startH, startM] = timeObj.start.split(':').map(Number);
            const [endH, endM] = timeObj.end.split(':').map(Number);
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

          card.innerHTML = `
            <div class="class-header">
              <div class="class-time">
                <i class="ph ph-clock"></i>
                <span>${cls.num} пара · ${timeObj.start}–${timeObj.end}</span>
              </div>
              <div class="class-badges">
                ${liveBadgeHTML}
                <div class="class-type ${cls.type}">${typeLabel}</div>
              </div>
            </div>
            <div class="class-subject">${cls.subject}</div>
            <div class="class-footer">
              <div class="class-location" title="${cls.location}">
                <i class="ph ph-map-pin"></i>
                <span>${cls.location}</span>
              </div>
              <a href="${link}" target="_blank" rel="noopener noreferrer" class="meet-btn">
                <i class="ph ph-video-camera"></i>
                Meet
              </a>
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
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
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
    if (Notification.permission !== "granted") return;

    setInterval(() => {
      if(!scheduleData) return;
      const now = new Date();

      // Check current day and week
      let dayOfWeek = now.getDay();
      if(dayOfWeek === 0 || dayOfWeek === 6) return; // Weekend
      
      const daySchedule = scheduleData.schedule[dayOfWeek];
      if(!daySchedule) return;

      const filteredSchedule = daySchedule.filter(cls => !cls.weekType || cls.weekType === currentWeekType);

      filteredSchedule.forEach(cls => {
        const timeObj = scheduleData.times[cls.num];
        const [startH, startM] = timeObj.start.split(':').map(Number);
        
        let targetTime = new Date();
        targetTime.setHours(startH, startM, 0, 0);
        
        // 10 minutes before
        targetTime.setMinutes(targetTime.getMinutes() - 10);

        if (now.getHours() === targetTime.getHours() && now.getMinutes() === targetTime.getMinutes() && now.getSeconds() === 0) {
           new Notification("Скоро пара!", {
             body: `${cls.subject} почнеться за 10 хвилин.`,
             icon: "assets/schedule-plus.svg"
           });
        }
      });
    }, 1000);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('ServiceWorker registered with scope:', reg.scope);
          })
          .catch(err => {
            console.warn('ServiceWorker registration failed:', err);
          });
      });
    }
  }

  if ("Notification" in window && Notification.permission === "granted") {
    setupAlarms();
  }
});
