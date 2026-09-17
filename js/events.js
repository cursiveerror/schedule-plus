import { state } from './state.js';
import { getProfiles, setProfiles, getActiveProfile, saveActiveProfile, getDB, setDB, createEmptySchedule, setActiveProfileId } from './storage.js';
import { setWeekType, updateProfileUI, updateDayTabsUI, renderSchedule, createClassCardHtml, setCustomSelectValue } from './ui.js';
import { toggleTheme } from './theme.js';
import { handlePushSubscribe } from './notifications.js';

function openProfileModal() {
  updateProfileUI();
  document.getElementById('profileModalBackdrop').classList.add('open');
}

function renderEditorClasses() {
  const container = document.getElementById('editorClassesContainer');
  container.innerHTML = '';

  const db = getDB();
  const schedule = state.editorWeekType === 'numerator' ? db.num : db.den;
  const dayClasses = schedule[state.editorSelectedDay] || [];

  dayClasses.sort((a, b) => a.pair - b.pair);

  if (dayClasses.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--color-ash); padding: 20px;">Пар немає. Додайте нову пару.</div>`;
    return;
  }

  dayClasses.forEach(cls => {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.style.cursor = 'pointer';
    card.innerHTML = createClassCardHtml(cls, false, false, true);
    card.addEventListener('click', () => openEditClassModal(cls));
    container.appendChild(card);
  });
}

function openEditorModal() {
  state.editorWeekType = state.currentWeekType;
  state.editorSelectedDay = (state.selectedDay === 0 || state.selectedDay > 6) ? 1 : state.selectedDay;

  document.getElementById('editorWeekToggle').setAttribute('data-week', state.editorWeekType);
  document.getElementById('editor-num-week').checked = (state.editorWeekType === 'numerator');
  document.getElementById('editor-den-week').checked = (state.editorWeekType === 'denominator');

  document.querySelectorAll('#editorDaysNav .course-chip').forEach(btn => {
    if (parseInt(btn.dataset.editday) === state.editorSelectedDay) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  document.getElementById('editorModalBackdrop').classList.add('open');
  renderEditorClasses();
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
  const schedule = state.editorWeekType === 'numerator' ? db.num : db.den;

  if (!schedule[state.editorSelectedDay]) {
    schedule[state.editorSelectedDay] = [];
  }

  const existing = schedule[state.editorSelectedDay].find(c => c.pair === pair);
  if (existing && existing.id !== id) {
    alert(`Пара ${pair} вже існує у цьому дні! Видаліть або змініть її спочатку.`);
    return;
  }

  if (id) {
    const idx = schedule[state.editorSelectedDay].findIndex(c => c.id === id);
    if (idx !== -1) {
      schedule[state.editorSelectedDay][idx] = { id, pair, subject, location, link, type };
    }
  } else {
    schedule[state.editorSelectedDay].push({
      id: Date.now().toString(),
      pair, subject, location, link, type
    });
  }

  setDB(db.num, db.den);
  document.getElementById('editClassModalBackdrop').classList.remove('open');
  renderEditorClasses();
  renderSchedule();
}

function deleteClass() {
  if (!confirm("Видалити цю пару?")) return;
  const id = document.getElementById('editClassId').value;
  const db = getDB();
  const schedule = state.editorWeekType === 'numerator' ? db.num : db.den;

  if (schedule[state.editorSelectedDay]) {
    schedule[state.editorSelectedDay] = schedule[state.editorSelectedDay].filter(c => c.id !== id);
  }

  setDB(db.num, db.den);
  document.getElementById('editClassModalBackdrop').classList.remove('open');
  renderEditorClasses();
  renderSchedule();
}

export function setupEventListeners() {
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

  const weekInputs = document.querySelectorAll('input[name="week-type"]');
  weekInputs.forEach(input => {
    input.addEventListener('change', (e) => setWeekType(e.target.value));
  });

  const dayTabs = document.querySelectorAll('.day-tab');
  dayTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      state.selectedDay = parseInt(e.currentTarget.dataset.day);
      updateDayTabsUI();
    });
  });

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  document.querySelectorAll('.notify-toggle-btn').forEach(btn => {
    btn.addEventListener('click', handlePushSubscribe);
  });

  const desktopProfileBtn = document.getElementById('desktopProfileBtn');
  const mobileProfileBtn = document.getElementById('mobileProfileBtn');
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

  const exportScheduleBtn = document.getElementById('exportScheduleBtn');
  if (exportScheduleBtn) {
    exportScheduleBtn.addEventListener('click', () => {
      const profile = getActiveProfile();
      if (!profile) return;

      const data = {
        numerator: profile.numerator,
        denominator: profile.denominator
      };
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const fileName = `schedule_${profile.name.replace(/[^a-z0-9а-яіїєґ]/gi, '_')}.json`;

      function fallbackDownload(b, fName) {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url;
        a.download = fName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }

      if (navigator.canShare) {
        const file = new File([blob], fileName, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({
            files: [file],
            title: `Розклад ${profile.name}`,
            text: 'Локальний розклад'
          }).catch(err => {
            console.error('Share failed:', err);
            fallbackDownload(blob, fileName);
          });
        } else {
          fallbackDownload(blob, fileName);
        }
      } else {
        fallbackDownload(blob, fileName);
      }
    });
  }

  const importScheduleBtn = document.getElementById('importScheduleBtn');
  const importScheduleInput = document.getElementById('importScheduleInput');
  if (importScheduleBtn && importScheduleInput) {
    importScheduleBtn.addEventListener('click', () => {
      importScheduleInput.click();
    });

    importScheduleInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.numerator && data.denominator) {
            const profile = getActiveProfile();
            if (profile) {
              if (confirm(`Імпортувати розклад у поточний профіль "${profile.name}"? Усі існуючі пари будуть перезаписані.`)) {
                setDB(data.numerator, data.denominator);
                const profiles = getProfiles();
                const idx = profiles.findIndex(p => p.id === profile.id);
                if (idx !== -1) {
                  profiles[idx].numerator = data.numerator;
                  profiles[idx].denominator = data.denominator;
                  setProfiles(profiles);
                }
                renderSchedule();
                alert('Розклад успішно імпортовано!');
              }
            }
          } else {
            alert('Невірний формат файлу розкладу.');
          }
        } catch (err) {
          console.error('Import parse error:', err);
          alert('Помилка читання файлу (невірний JSON).');
        }
        importScheduleInput.value = '';
      };
      reader.readAsText(file);
    });
  }

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

  const editorModalBackdrop = document.getElementById('editorModalBackdrop');
  document.getElementById('editScheduleBtn').addEventListener('click', () => {
    profileModalBackdrop.classList.remove('open');
    openEditorModal();
  });

  document.getElementById('closeEditorModal').addEventListener('click', () => {
    editorModalBackdrop.classList.remove('open');
    renderSchedule();
  });

  const editorWeekToggleContainer = document.getElementById('editorWeekToggle');
  editorWeekToggleContainer.addEventListener('click', (e) => {
    const numLabel = document.getElementById('editor-num-label');
    const denLabel = document.getElementById('editor-den-label');
    if (e.target === numLabel || e.target.id === 'editor-num-week') {
      state.editorWeekType = 'numerator';
    } else if (e.target === denLabel || e.target.id === 'editor-den-week') {
      state.editorWeekType = 'denominator';
    } else {
      const rect = editorWeekToggleContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      state.editorWeekType = (clickX < rect.width / 2) ? 'numerator' : 'denominator';
    }
    editorWeekToggleContainer.setAttribute('data-week', state.editorWeekType);
    document.getElementById('editor-num-week').checked = (state.editorWeekType === 'numerator');
    document.getElementById('editor-den-week').checked = (state.editorWeekType === 'denominator');
    renderEditorClasses();
  });

  const editorCopyWeekBtn = document.getElementById('editorCopyWeekBtn');
  if (editorCopyWeekBtn) {
    editorCopyWeekBtn.addEventListener('click', () => {
      const db = getDB();
      const currentWeek = state.editorWeekType;
      const targetKey = currentWeek === 'numerator' ? 'num' : 'den';
      const sourceKey = currentWeek === 'numerator' ? 'den' : 'num';
      const sourceName = currentWeek === 'numerator' ? 'Знаменника' : 'Чисельника';
      const targetName = currentWeek === 'numerator' ? 'Чисельник' : 'Знаменник';
      
      if (confirm(`Ви впевнені, що хочете скопіювати весь розклад зі ${sourceName} у ${targetName}? Поточні пари ${targetName} будуть видалені.`)) {
        const copiedSchedule = JSON.parse(JSON.stringify(db[sourceKey]));
        // Regenerate IDs for the copied classes to avoid collisions
        for (const day in copiedSchedule) {
          copiedSchedule[day].forEach(cls => {
            cls.id = 'cls_' + Date.now().toString() + Math.random().toString(36).substr(2, 9);
          });
        }
        db[targetKey] = copiedSchedule;
        setDB(db.num, db.den);
        renderEditorClasses();
        alert(`Розклад успішно скопійовано зі ${sourceName}!`);
      }
    });
  }

  document.querySelectorAll('#editorDaysNav .course-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#editorDaysNav .course-chip').forEach(c => c.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.editorSelectedDay = parseInt(e.currentTarget.dataset.editday);
      renderEditorClasses();
    });
  });

  document.getElementById('addClassBtn').addEventListener('click', () => {
    openEditClassModal(null);
  });

  const editClassModalBackdrop = document.getElementById('editClassModalBackdrop');
  document.getElementById('closeEditClassModal').addEventListener('click', () => {
    editClassModalBackdrop.classList.remove('open');
  });

  document.getElementById('saveClassBtn').addEventListener('click', saveClass);
  document.getElementById('deleteClassBtn').addEventListener('click', deleteClass);

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-container.open').forEach(c => c.classList.remove('open'));
  });

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
