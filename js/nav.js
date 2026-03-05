// Navigation Module
// Handles the top navigation bar — modern dark sidebar / top-bar

import { getCurrentUser, signOut } from './auth.js';
import { getInitials } from './utils.js';

const navItems = [
  { id: 'home',             label: 'Home',            href: './dashboard.html',         icon: 'fa-home' },
  { id: 'students',         label: 'Students',         href: './students.html',          icon: 'fa-users' },
  { id: 'daily-attendance', label: 'Daily Attendance', href: './daily-attendance.html',  icon: 'fa-clipboard-list' },
  { id: 'class-attendance', label: 'Class Attendance', href: './class-attendance.html',  icon: 'fa-calendar-check' },
  { id: 'interventions',    label: 'Interventions',    href: './interventions.html',     icon: 'fa-handshake' },
  { id: 'tmi-review',       label: 'TMI Review',       href: './tmi-review.html',        icon: 'fa-eye' },
  { id: 'tmi-approval',     label: 'TMI Approval',     href: './tmi-approval.html',      icon: 'fa-check-circle' },
  { id: 'master-schedule',  label: 'Master Schedule',  href: './master-schedule.html',   icon: 'fa-calendar-alt' },
  { id: 'schedule-admin',   label: 'Schedule Admin',   href: './schedule-admin.html',    icon: 'fa-cog' },
  { id: 'learning-lab',     label: 'Learning Lab',     href: './learning-lab.html',      icon: 'fa-flask' },
  { id: 'school-calendar',  label: 'School Calendar',  href: './school-calendar.html',   icon: 'fa-calendar' },
  { id: 'pbl-planner',      label: 'PBL Planner',      href: './pbl-planner.html',       icon: 'fa-lightbulb' },
  { id: 'admin',            label: 'Admin',            href: './admin.html',             icon: 'fa-tools' },
];

export function initNav(activePage) {
  const navContainer = document.getElementById('nav-container');
  if (!navContainer) {
    console.error('nav-container element not found');
    return;
  }

  const user = getCurrentUser();
  const userInitials  = user ? getInitials(user.displayName || user.email) : 'U';
  const userPhotoURL  = user ? (user.photoURL || '') : '';
  const userName      = user ? (user.displayName || user.email || '') : '';
  const userEmail     = user ? (user.email || '') : '';

  /* ── Nav link items ── */
  const linksHTML = navItems.map(item => {
    const isActive = activePage === item.id ? 'active' : '';
    return `<a href="${item.href}" class="p2mt-nav-link ${isActive}" title="${item.label}">
              <i class="fas ${item.icon}"></i>
              <span>${item.label}</span>
            </a>`;
  }).join('');

  /* ── Mobile menu items ── */
  const mobileLinksHTML = navItems.map(item => {
    const isActive = activePage === item.id ? 'active' : '';
    return `<a href="${item.href}" class="p2mt-nav-link ${isActive}">
              <i class="fas ${item.icon}"></i>
              <span>${item.label}</span>
            </a>`;
  }).join('');

  /* ── User avatar ── */
  const avatarHTML = userPhotoURL
    ? `<img src="${userPhotoURL}" alt="${userName}">`
    : userInitials;

  /* ── User section (right-side) ── */
  const userSectionHTML = user ? `
    <div class="p2mt-nav-divider"></div>
    <button class="p2mt-user-btn" id="user-menu-toggle" aria-label="User menu">
      <span class="p2mt-avatar">${avatarHTML}</span>
      <span class="p2mt-nav-user-name">${userName.split(' ')[0] || userName}</span>
      <i class="fas fa-chevron-down" style="font-size:10px; opacity:0.6; margin-left:2px;"></i>
    </button>

    <div class="p2mt-dropdown" id="user-dropdown" style="display:none;">
      <div class="p2mt-dropdown-header">
        <div class="name">${userName}</div>
        <div class="email">${userEmail}</div>
      </div>
      <button class="p2mt-dropdown-item danger" id="signout-btn">
        <i class="fas fa-sign-out-alt"></i>
        Sign out
      </button>
    </div>
  ` : '';

  /* ── Full nav HTML ── */
  navContainer.innerHTML = `
    <nav class="p2mt-nav">
      <!-- Brand -->
      <a href="./dashboard.html" class="p2mt-nav-brand" title="P2MT Home">
        <div class="p2mt-nav-logo">P2</div>
        <span class="p2mt-nav-name">P2MT</span>
      </a>

      <!-- Desktop links -->
      <div class="p2mt-nav-links" id="nav-links">
        ${linksHTML}
      </div>

      <!-- Right side -->
      <div class="p2mt-nav-right">
        ${userSectionHTML}
        <button class="p2mt-nav-mobile-toggle" id="mobile-toggle" aria-label="Open menu">
          <i class="fas fa-bars"></i>
        </button>
      </div>
    </nav>

    <!-- Mobile menu -->
    <div class="p2mt-nav-mobile-menu" id="mobile-nav-menu">
      ${mobileLinksHTML}
    </div>
  `;

  /* ── Event listeners ── */

  // Mobile toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileMenu   = document.getElementById('mobile-nav-menu');
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileMenu.classList.toggle('open');
      const icon = mobileToggle.querySelector('i');
      if (icon) {
        icon.className = mobileMenu.classList.contains('open')
          ? 'fas fa-times'
          : 'fas fa-bars';
      }
    });
  }

  // User dropdown toggle
  const userMenuToggle = document.getElementById('user-menu-toggle');
  const userDropdown   = document.getElementById('user-dropdown');
  if (userMenuToggle && userDropdown) {
    userMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = userDropdown.style.display !== 'none';
      userDropdown.style.display = isOpen ? 'none' : 'block';
    });
  }

  // Close dropdown / mobile menu on outside click
  document.addEventListener('click', (e) => {
    if (userDropdown && !e.target.closest('#user-menu-toggle') && !e.target.closest('#user-dropdown')) {
      userDropdown.style.display = 'none';
    }
    if (mobileMenu && !e.target.closest('#mobile-toggle') && !e.target.closest('#mobile-nav-menu')) {
      mobileMenu.classList.remove('open');
      const icon = mobileToggle && mobileToggle.querySelector('i');
      if (icon) icon.className = 'fas fa-bars';
    }
  });

  // Sign out button
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      try {
        await signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      }
    });
  }
}
