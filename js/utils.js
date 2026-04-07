// Utility Functions Module
// Common utility functions for the P2MT application

// Attendance code constants and labels
export const ATTENDANCE_CODES = {
  P: { label: 'Present', color: '#4CAF50', icon: 'fa-check' },
  T: { label: 'Tardy', color: '#FFC107', icon: 'fa-clock' },
  E: { label: 'Excused', color: '#2196F3', icon: 'fa-file-alt' },
  U: { label: 'Unexcused', color: '#F44336', icon: 'fa-times' },
  Q: { label: 'Quarantine', color: '#9C27B0', icon: 'fa-shield-alt' },
  W: { label: 'Withdrawn', color: '#757575', icon: 'fa-arrow-right' },
  H: { label: 'Homebound', color: '#FF9800', icon: 'fa-home' },
  L: { label: 'Late Start', color: '#FFEB3B', icon: 'fa-arrow-down' }
};

// Format ISO date to MM/DD/YYYY
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    // Parse YYYY-MM-DD manually to avoid UTC-to-local timezone shift
    // (new Date('2026-03-11') is treated as UTC midnight, which rolls back
    //  to March 10 in any US timezone — this avoids that entirely)
    const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
    }
    // Fallback for non-ISO formats
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr;
  }
}

// Convert date string to ISO format (YYYY-MM-DD)
export function toISODate(dateStr) {
  if (!dateStr) return '';
  try {
    // Handle MM/DD/YYYY format
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/');
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    // Already in ISO format or other format
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error converting to ISO date:', error);
    return dateStr;
  }
}

// Get current school year (e.g., "2025-2026")
export function getCurrentSchoolYear() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  // School year starts in August (month 7)
  if (currentMonth >= 7) {
    return `${currentYear}-${currentYear + 1}`;
  } else {
    return `${currentYear - 1}-${currentYear}`;
  }
}

// Get current semester (Fall or Spring)
export function getCurrentSemester() {
  const today = new Date();
  const currentMonth = today.getMonth();
  
  // Fall: August (7) - December (11)
  // Spring: January (0) - July (6)
  if (currentMonth >= 7) {
    return 'Fall';
  } else {
    return 'Spring';
  }
}

// Export data as CSV file using PapaParse
export function exportCSV(data, filename) {
  if (!window.Papa) {
    console.error('PapaParse not loaded');
    showToast('Error: CSV library not loaded', 'error');
    return;
  }
  
  try {
    const csv = window.Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${data.length} records to ${filename}`, 'success');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    showToast('Error exporting CSV file', 'error');
  }
}

// Import CSV file using PapaParse
export function importCSV(file) {
  return new Promise((resolve, reject) => {
    if (!window.Papa) {
      reject(new Error('PapaParse not loaded'));
      return;
    }
    
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    
    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

// Show a toast notification
export function showToast(message, type = 'info') {
  // Ensure container exists
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const iconMap = {
    success: 'fa-check-circle',
    error:   'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info:    'fa-info-circle'
  };
  const bgMap = {
    success: 'linear-gradient(135deg,#059669,#10B981)',
    error:   'linear-gradient(135deg,#DC2626,#EF4444)',
    warning: 'linear-gradient(135deg,#D97706,#F59E0B)',
    info:    'linear-gradient(135deg,#3730A3,#4F46E5)'
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    display:flex; align-items:center; gap:10px;
    padding:12px 18px; border-radius:10px;
    font-family:inherit; font-size:13px; font-weight:500;
    color:white; box-shadow:0 8px 24px rgba(0,0,0,0.18);
    background:${bgMap[type] || bgMap.info};
    animation:toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
    max-width:340px; pointer-events:auto; cursor:pointer;
    transition:opacity 0.2s, transform 0.2s;
  `;
  toast.innerHTML = `<i class="fas ${iconMap[type] || iconMap.info}" style="font-size:14px;opacity:0.9;flex-shrink:0;"></i><span>${message}</span>`;
  toast.addEventListener('click', () => dismissToast(toast));
  container.appendChild(toast);

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(toast), 4000);
  toast._timer = timer;
}

function dismissToast(toast) {
  clearTimeout(toast._timer);
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(20px)';
  setTimeout(() => toast.remove(), 220);
}

// Show a modal dialog with confirmation
export function showModal(title, content, onConfirm) {
  const modalId = 'confirm-modal-' + generateId();
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'w3-modal';
  modal.style.display = 'flex';

  modal.innerHTML = `
    <div class="w3-modal-content" style="max-width:420px;">
      <header class="modal-header">
        <h3 style="margin:0;font-size:16px;font-weight:700;">${title}</h3>
        <button class="modal-close-btn" onclick="document.getElementById('${modalId}').remove()">&times;</button>
      </header>
      <div class="modal-body" style="font-size:14px;color:var(--text-secondary);">
        ${content}
      </div>
      <div class="modal-footer">
        <button class="w3-button btn-ghost" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
        <button class="w3-button btn-primary" id="confirm-btn-${modalId}">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById(`confirm-btn-${modalId}`).addEventListener('click', () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Close the currently open modal
export function closeModal() {
  const modals = document.querySelectorAll('.w3-modal');
  modals.forEach(modal => {
    if (modal.style.display === 'block') {
      modal.style.display = 'none';
    }
  });
}

// Debounce function to limit function calls
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// Generate a unique ID string
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format a timestamp to readable format
export function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp.toDate ? timestamp.toDate() : timestamp);
    return date.toLocaleString();
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
}

// Check if value is numeric
export function isNumeric(value) {
  return value !== '' && !isNaN(value);
}

// Capitalize first letter of a string
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Convert name to initials
export function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p.charAt(0).toUpperCase()).join('');
}

// Show a "type DELETE to confirm" modal. Returns a Promise<boolean>.
// Usage: if (await confirmTypedDelete('Delete student John Doe?')) { ...do delete... }
export function confirmTypedDelete(message = 'This action cannot be undone.') {
  return new Promise((resolve) => {
    const id = 'typed-delete-modal-' + generateId();

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.55); backdrop-filter:blur(3px);
      display:flex; align-items:center; justify-content:center;
    `;

    overlay.innerHTML = `
      <div style="
        background:#fff; border-radius:14px; padding:28px 32px; max-width:420px; width:90%;
        box-shadow:0 20px 60px rgba(0,0,0,0.25); font-family:inherit;
        animation:toastIn 0.2s cubic-bezier(0.34,1.56,0.64,1);
      ">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div style="
            width:42px;height:42px;border-radius:50%;background:#FEE2E2;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;
          ">
            <i class="fas fa-exclamation-triangle" style="color:#DC2626;font-size:18px;"></i>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#111;">Confirm Deletion</div>
            <div style="font-size:12px;color:#6B7280;margin-top:2px;">This action is permanent and cannot be undone.</div>
          </div>
        </div>
        <p style="font-size:13px;color:#374151;margin:0 0 18px;line-height:1.5;">${message}</p>
        <p style="font-size:13px;color:#6B7280;margin:0 0 8px;">
          Type <strong style="color:#DC2626;font-family:monospace;">DELETE</strong> to confirm:
        </p>
        <input id="${id}-input" type="text" autocomplete="off" placeholder="DELETE"
          style="
            width:100%;box-sizing:border-box;padding:10px 12px;border:2px solid #E5E7EB;
            border-radius:8px;font-size:14px;font-family:monospace;outline:none;
            transition:border-color 0.15s;
          "
        />
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
          <button id="${id}-cancel" style="
            padding:9px 20px;border-radius:8px;border:none;cursor:pointer;
            background:#F3F4F6;color:#374151;font-size:13px;font-weight:600;
            transition:background 0.15s;
          ">Cancel</button>
          <button id="${id}-confirm" disabled style="
            padding:9px 20px;border-radius:8px;border:none;cursor:not-allowed;
            background:#FCA5A5;color:#fff;font-size:13px;font-weight:600;
            transition:background 0.15s, opacity 0.15s; opacity:0.6;
          ">Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input   = document.getElementById(`${id}-input`);
    const confirmBtn = document.getElementById(`${id}-confirm`);
    const cancelBtn  = document.getElementById(`${id}-cancel`);

    // Enable confirm button only when user typed exactly "DELETE"
    input.addEventListener('input', () => {
      const ready = input.value === 'DELETE';
      confirmBtn.disabled = !ready;
      confirmBtn.style.background  = ready ? '#DC2626' : '#FCA5A5';
      confirmBtn.style.cursor      = ready ? 'pointer'  : 'not-allowed';
      confirmBtn.style.opacity     = ready ? '1'        : '0.6';
      input.style.borderColor      = input.value.length === 0 ? '#E5E7EB'
                                   : ready               ? '#059669'
                                   :                       '#F87171';
    });

    function cleanup(result) {
      overlay.remove();
      resolve(result);
    }

    confirmBtn.addEventListener('click', () => { if (input.value === 'DELETE') cleanup(true); });
    cancelBtn.addEventListener('click',  () => cleanup(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });

    // Focus the input after mount
    requestAnimationFrame(() => input.focus());
  });
}
