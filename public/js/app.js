// Modal functions
function showAddClientModal() {
  document.getElementById('addClientModal').classList.add('active');
  document.getElementById('clientName').focus();
}

function closeModal() {
  document.getElementById('addClientModal').classList.remove('active');
  document.getElementById('addClientForm').reset();
}

function closeEditModal() {
  document.getElementById('editClientModal').classList.remove('active');
  document.getElementById('editClientForm').reset();
}

function closeQRModal() {
  document.getElementById('qrModal').classList.remove('active');
}

// Edit client
async function editClient(id) {
  const clients = Array.from(document.querySelectorAll('.client-card'));
  const clientCard = clients.find(c => c.getAttribute('data-id') === id);
  
  if (!clientCard) return;
  
  // Get current notes from the card
  const notesElement = clientCard.querySelector('.client-notes');
  const currentNotes = notesElement ? notesElement.textContent : '';
  
  // Populate the form
  document.getElementById('editClientId').value = id;
  document.getElementById('editClientNotes').value = currentNotes;
  
  // Show modal
  document.getElementById('editClientModal').classList.add('active');
}

// Update client
async function updateClient(event) {
  event.preventDefault();
  
  const form = event.target;
  const id = document.getElementById('editClientId').value;
  const formData = new FormData(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  
  // Disable button and show loading
  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Saving...';
  
  try {
    const response = await fetch(`/api/client/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notes: formData.get('notes'),
        expiryDays: formData.get('expiryDays')
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('✅ Client updated successfully!', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification('❌ Error: ' + (data.error || 'Unknown error'), 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Save Changes';
    }
  } catch (err) {
    showNotification('❌ Error: ' + err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Save Changes';
  }
}

// Search functionality
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.client-card');
    
    cards.forEach(card => {
      const name = card.getAttribute('data-name');
      if (name.includes(searchTerm)) {
        card.style.display = 'block';
        card.style.animation = 'fadeIn 0.3s ease-out';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

// Add client
async function addClient(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  
  // Disable button and show loading
  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Creating...';
  
  try {
    const response = await fetch('/api/client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: formData.get('name'),
        expiryDays: formData.get('expiryDays'),
        notes: formData.get('notes')
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('✅ Client created successfully!', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification('❌ Error: ' + (data.error || 'Unknown error'), 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create Client';
    }
  } catch (err) {
    showNotification('❌ Error: ' + err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Create Client';
  }
}

// Delete client
async function deleteClient(id, name) {
  if (!confirm(`🗑️ Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/client/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('✅ Client deleted successfully!', 'success');
      // Animate card removal
      const card = document.querySelector(`[data-id="${id}"]`);
      if (card) {
        card.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => location.reload(), 300);
      }
    } else {
      showNotification('❌ Error: ' + (data.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showNotification('❌ Error: ' + err.message, 'error');
  }
}

// Toggle client
async function toggleClient(id) {
  try {
    const response = await fetch(`/api/client/${id}/toggle`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      const status = data.enabled ? 'enabled' : 'disabled';
      showNotification(`✅ Client ${status} successfully!`, 'success');
      setTimeout(() => location.reload(), 800);
    } else {
      showNotification('❌ Error: ' + (data.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showNotification('❌ Error: ' + err.message, 'error');
  }
}

// Download config
function downloadConfig(id) {
  window.location.href = `/api/client/${id}/config`;
  showNotification('⬇️ Downloading configuration...', 'success');
}

// Show QR code
async function showQRCode(id) {
  const modal = document.getElementById('qrModal');
  const spinner = document.getElementById('qrSpinner');
  const image = document.getElementById('qrCodeImage');
  
  // Show modal with spinner
  modal.classList.add('active');
  spinner.style.display = 'block';
  image.style.display = 'none';
  
  try {
    const response = await fetch(`/api/client/${id}/qrcode`);
    const data = await response.json();
    
    if (data.qrcode) {
      image.src = data.qrcode;
      spinner.style.display = 'none';
      image.style.display = 'block';
    } else {
      showNotification('❌ Error: ' + (data.error || 'Unknown error'), 'error');
      closeQRModal();
    }
  } catch (err) {
    showNotification('❌ Error: ' + err.message, 'error');
    closeQRModal();
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existing = document.querySelectorAll('.notification');
  existing.forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === 'success' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 0, 85, 0.2)'};
    color: ${type === 'success' ? 'var(--accent-success)' : 'var(--accent-danger)'};
    border: 1px solid ${type === 'success' ? 'var(--accent-success)' : 'var(--accent-danger)'};
    border-radius: 10px;
    z-index: 10000;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease-out;
    font-family: 'Rajdhani', sans-serif;
    letter-spacing: 0.5px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Close modals on background click
document.addEventListener('DOMContentLoaded', () => {
  const modals = document.querySelectorAll('.modal');
  
  modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
  
  // Close modals on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modals.forEach(modal => modal.classList.remove('active'));
    }
  });
  
  // Setup search
  setupSearch();
  
  // Add fade out animation to CSS if not exists
  if (!document.querySelector('#dynamic-animations')) {
    const style = document.createElement('style');
    style.id = 'dynamic-animations';
    style.textContent = `
      @keyframes fadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.9); }
      }
    `;
    document.head.appendChild(style);
  }
  
  console.log('%c⚡ CyberWG v2.0', 'color: #00f0ff; font-size: 20px; font-weight: bold;');
  console.log('%cAdvanced WireGuard Management', 'color: #ff00aa; font-size: 12px;');
});
