<div align="center">
  <br />
  <img src="./assets/logo.png" alt="Розклад+ Logo" width="120" />
  
  <h1><strong>Розклад+</strong></h1>
  <p>
    <em>A fast, offline-first student schedule with Web Push notifications.</em>
  </p>
  <p>
    <img src="https://img.shields.io/badge/PWA-Ready-333333?style=for-the-badge&logo=pwa&logoColor=FFB143" alt="PWA" />
    <img src="https://img.shields.io/badge/Web_Push-Enabled-FFB143?style=for-the-badge&logo=googlechrome&logoColor=333333" alt="Push" />
    <img src="https://img.shields.io/badge/Backend-Node.js_|_SQLite-333333?style=for-the-badge&logo=nodedotjs&logoColor=FFB143" alt="Backend" />
  </p>
</div>

---

## Overview
Розклад+ is a PWA (Progressive Web App) designed to manage student schedules. It operates completely offline using `localStorage` and includes a backend service to send Web Push notifications 10 minutes before classes.

## Features
- **PWA Support:** Installable on iOS, Android, and PC.
- **Offline Mode:** Fully cached frontend.
- **Push Notifications:** Automated alerts via a custom Node.js backend.
- **Visual Editor:** Built-in tools to create and modify schedules.

## Tech Stack
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Database:** SQLite (`better-sqlite3`)
- **Push Provider:** `web-push` (VAPID)