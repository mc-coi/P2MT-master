// Navigation Module
// Handles the top navigation bar with dropdown group support

import { getCurrentUser, signOut } from './auth.js';
import { getInitials } from './utils.js';

// ── Dark mode ─────────────────────────────────────────────────────────────────
(function applyThemeEarly() {
  // Run immediately (before DOMContentLoaded) so there's no flash of wrong theme
  const saved = localStorage.getItem('p2mt-theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
})();

// ── Nav structure ─────────────────────────────────────────────────────────────
// Plain items render as links; group items (group:true) render as dropdowns.
const navItems = [
  { id: 'home',     label: 'Home',     href: './dashboard.html', icon: 'fa-home' },
  { id: 'students', label: 'Students', href: './students.html',  icon: 'fa-users' },

  {
    id: 'attendance-group', label: 'Attendance', icon: 'fa-clipboard-list', group: true,
    children: [
      { id: 'class-attendance', label: 'Class',        href: './class-attendance.html', icon: 'fa-calendar-check' },
      { id: 'daily-attendance', label: 'Daily',        href: './daily-attendance.html', icon: 'fa-clipboard-list' },
      { id: 'master-schedule',  label: 'Master',       href: './master-schedule.html',  icon: 'fa-calendar-alt' },
      { id: 'learning-lab',     label: 'Learning Lab', href: './learning-lab.html',     icon: 'fa-flask' },
      { id: 'tmi-review',       label: 'TMI Review',   href: './tmi-review.html',       icon: 'fa-search' },
      { id: 'tmi-approval',     label: 'TMI Final',    href: './tmi-approval.html',     icon: 'fa-check-double' },
    ]
  },

  {
    id: 'pbl-group', label: 'Contact', icon: 'fa-paper-plane', group: true,
    children: [
      { id: 'pbl-planner',     label: 'PBL Planner', href: './pbl-planner.html',     icon: 'fa-lightbulb' },
      { id: 'email-templates', label: 'Email',        href: './email-templates.html', icon: 'fa-envelope'  },
      { id: 'er-emailer',      label: 'ER Selector',  href: './er-emailer.html',      icon: 'fa-bolt'      },
    ]
  },

  { id: 'reports', label: 'Reports', href: './reports.html', icon: 'fa-chart-bar' },

  {
    id: 'admin-group', label: 'Admin', icon: 'fa-tools', group: true,
    children: [
      { id: 'schedule-admin',  label: 'Schedule Admin', href: './schedule-admin.html',  icon: 'fa-cog' },
      { id: 'admin',           label: 'Admin',          href: './admin.html',           icon: 'fa-tools' },
      { id: 'diagnostics',     label: 'Diagnostics',    href: './diagnostics.html',     icon: 'fa-stethoscope' },
    ]
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupIsActive(group, activePage) {
  return group.children.some(c => c.id === activePage);
}

function buildDesktopItem(item, activePage) {
  if (!item.group) {
    const active = activePage === item.id ? 'active' : '';
    return `<a href="${item.href}" class="p2mt-nav-link ${active}" title="${item.label}">
              <i class="fas ${item.icon}"></i>
              <span>${item.label}</span>
            </a>`;
  }

  const active = groupIsActive(item, activePage) ? 'active' : '';
  const menuItems = item.children.map(c => {
    const childActive = activePage === c.id ? 'active' : '';
    return `<a href="${c.href}" class="${childActive}">
              <i class="fas ${c.icon}"></i>${c.label}
            </a>`;
  }).join('');

  return `
    <div class="p2mt-nav-group" data-group-id="${item.id}">
      <button class="p2mt-nav-group-btn ${active}" aria-expanded="false" aria-haspopup="true">
        <i class="fas ${item.icon} group-icon"></i>
        <span>${item.label}</span>
        <i class="fas fa-chevron-down chevron"></i>
      </button>
      <div class="p2mt-nav-group-menu" id="group-menu-${item.id}">
        ${menuItems}
      </div>
    </div>`;
}

function buildMobileItem(item, activePage) {
  if (!item.group) {
    const active = activePage === item.id ? 'active' : '';
    return `<a href="${item.href}" class="p2mt-nav-link ${active}">
              <i class="fas ${item.icon}"></i>
              <span>${item.label}</span>
            </a>`;
  }

  const childLinks = item.children.map(c => {
    const active = activePage === c.id ? 'active' : '';
    return `<a href="${c.href}" class="p2mt-nav-link ${active}" style="padding-left:28px;">
              <i class="fas ${c.icon}"></i>
              <span>${c.label}</span>
            </a>`;
  }).join('');

  return `
    <div style="padding:4px 14px 2px;font-size:10px;font-weight:700;text-transform:uppercase;
                letter-spacing:.08em;color:rgba(255,255,255,.35);margin-top:6px;">
      ${item.label}
    </div>
    ${childLinks}`;
}

// Close all open group menus
function closeAllGroupMenus() {
  document.querySelectorAll('.p2mt-nav-group-menu.open').forEach(m => {
    m.classList.remove('open');
    m.style.top  = '';
    m.style.left = '';
    const btn = m.closest('.p2mt-nav-group')?.querySelector('.p2mt-nav-group-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

// ── Main export ───────────────────────────────────────────────────────────────
export function initNav(activePage) {
  const navContainer = document.getElementById('nav-container');
  if (!navContainer) { console.error('nav-container element not found'); return; }

  const user         = getCurrentUser();
  const userInitials = user ? getInitials(user.displayName || user.email) : 'U';
  const userPhotoURL = user ? (user.photoURL || '') : '';
  const userName     = user ? (user.displayName || user.email || '') : '';
  const userEmail    = user ? (user.email || '') : '';

  const linksHTML       = navItems.map(i => buildDesktopItem(i, activePage)).join('');
  const mobileLinksHTML = navItems.map(i => buildMobileItem(i, activePage)).join('');

  const avatarHTML = userPhotoURL
    ? `<img src="${userPhotoURL}" alt="${userName}">`
    : userInitials;

  const userSectionHTML = user ? `
    <div class="p2mt-nav-divider"></div>
    <button class="p2mt-user-btn" id="user-menu-toggle" aria-label="User menu">
      <span class="p2mt-avatar">${avatarHTML}</span>
      <span class="p2mt-nav-user-name">${userName.split(' ')[0] || userName}</span>
      <i class="fas fa-chevron-down" style="font-size:10px;opacity:0.6;margin-left:2px;"></i>
    </button>
    <div class="p2mt-dropdown" id="user-dropdown" style="display:none;">
      <div class="p2mt-dropdown-header">
        <div class="name">${userName}</div>
        <div class="email">${userEmail}</div>
      </div>
      <button class="p2mt-dropdown-item danger" id="signout-btn">
        <i class="fas fa-sign-out-alt"></i>Sign out
      </button>
    </div>
  ` : '';

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  navContainer.innerHTML = `
    <nav class="p2mt-nav">
      <a href="./dashboard.html" class="p2mt-nav-brand" title="P2MT Home">
        <div class="p2mt-nav-logo">
          <img src="./img/logo.png" alt="STEM School" onerror="this.parentElement.innerHTML='<span style=&quot;font-size:14px;font-weight:800;color:white;&quot;>P2</span>'">
        </div>
        <span class="p2mt-nav-name">P2MT</span>
      </a>
      <div class="p2mt-nav-links" id="nav-links">${linksHTML}</div>
      <div class="p2mt-nav-right">
        ${userSectionHTML}
        <button class="dark-toggle" id="dark-mode-toggle" aria-label="Toggle dark mode" title="${isDark ? 'Switch to light mode' : 'Switch to dark mode'}">
          <i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}"></i>
        </button>
        <button class="p2mt-nav-mobile-toggle" id="mobile-toggle" aria-label="Open menu">
          <i class="fas fa-bars"></i>
        </button>
      </div>
    </nav>
    <div class="p2mt-nav-mobile-menu" id="mobile-nav-menu">
      ${mobileLinksHTML}
    </div>
  `;

  // ── Desktop group dropdowns ──────────────────────────────────────────────
  // Use position:fixed + getBoundingClientRect so the menu is never clipped
  // by the overflow-x:auto on .p2mt-nav-links
  document.querySelectorAll('.p2mt-nav-group').forEach(groupEl => {
    const btn  = groupEl.querySelector('.p2mt-nav-group-btn');
    const menu = groupEl.querySelector('.p2mt-nav-group-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      closeAllGroupMenus();

      if (!isOpen) {
        // Position the fixed menu just below the button
        const rect = btn.getBoundingClientRect();
        menu.style.top  = `${rect.bottom + 6}px`;
        menu.style.left = `${rect.left}px`;
        menu.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ── Mobile toggle ────────────────────────────────────────────────────────
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileMenu   = document.getElementById('mobile-nav-menu');
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileMenu.classList.toggle('open');
      const icon = mobileToggle.querySelector('i');
      if (icon) icon.className = mobileMenu.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
    });
  }

  // ── User dropdown ────────────────────────────────────────────────────────
  const userMenuToggle = document.getElementById('user-menu-toggle');
  const userDropdown   = document.getElementById('user-dropdown');
  if (userMenuToggle && userDropdown) {
    userMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllGroupMenus();
      const isOpen = userDropdown.style.display !== 'none';
      userDropdown.style.display = isOpen ? 'none' : 'block';
    });
  }

  // ── Close all on outside click ───────────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (userDropdown && !e.target.closest('#user-menu-toggle') && !e.target.closest('#user-dropdown')) {
      userDropdown.style.display = 'none';
    }
    if (!e.target.closest('.p2mt-nav-group')) {
      closeAllGroupMenus();
    }
    if (mobileMenu && !e.target.closest('#mobile-toggle') && !e.target.closest('#mobile-nav-menu')) {
      mobileMenu.classList.remove('open');
      const icon = mobileToggle?.querySelector('i');
      if (icon) icon.className = 'fas fa-bars';
    }
  });

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      try { await signOut(); } catch (error) { console.error('Error signing out:', error); }
    });
  }

  // ── Dark mode toggle ─────────────────────────────────────────────────────
  const darkToggle = document.getElementById('dark-mode-toggle');
  if (darkToggle) {
    darkToggle.addEventListener('click', () => {
      const html      = document.documentElement;
      const nowDark   = html.getAttribute('data-theme') === 'dark';
      const nextTheme = nowDark ? 'light' : 'dark';

      if (nextTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
      } else {
        html.removeAttribute('data-theme');
      }
      localStorage.setItem('p2mt-theme', nextTheme);

      // Update icon + tooltip
      const icon = darkToggle.querySelector('i');
      if (icon) icon.className = nextTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
      darkToggle.title = nextTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }
}
