export function initTheme() {
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

export function setTheme(theme) {
  const metaThemeColor = document.getElementById('meta-theme-color');
  const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
  
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (metaThemeColor) metaThemeColor.setAttribute('content', '#000000');
    themeToggleBtns.forEach(btn => {
      const icon = btn.querySelector('i');
      if (icon) icon.className = 'ph ph-sun';
    });
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (metaThemeColor) metaThemeColor.setAttribute('content', '#f5f5f7');
    themeToggleBtns.forEach(btn => {
      const icon = btn.querySelector('i');
      if (icon) icon.className = 'ph ph-moon';
    });
  }
  localStorage.setItem('theme', theme);
}

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}
