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
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `w3-card w3-padding w3-margin w3-animate-bottom w3-text-white`;
  
  let backgroundColor = '#2196F3'; // info
  if (type === 'success') backgroundColor = '#4CAF50';
  if (type === 'error') backgroundColor = '#F44336';
  if (type === 'warning') backgroundColor = '#FFC107';
  
  toast.style.backgroundColor = backgroundColor;
  toast.textContent = message;
  
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Show a modal dialog with confirmation
export function showModal(title, content, onConfirm) {
  const modalId = 'confirm-modal-' + generateId();
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'w3-modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="w3-modal-content w3-card-4">
      <header class="w3-container w3-light-blue">
        <span class="w3-button w3-display-topright w3-large" onclick="document.getElementById('${modalId}').style.display='none'">&times;</span>
        <h2>${title}</h2>
      </header>
      <div class="w3-container w3-padding">
        ${content}
      </div>
      <footer class="w3-container w3-light-gray w3-padding">
        <button class="w3-button w3-blue w3-right" onclick="document.getElementById('${modalId}').style.display='none'">Cancel</button>
        <button class="w3-button w3-green w3-right w3-margin-right" id="confirm-btn-${modalId}">Confirm</button>
      </footer>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const confirmBtn = document.getElementById(`confirm-btn-${modalId}`);
  confirmBtn.addEventListener('click', () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });
  
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.remove();
    }
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
