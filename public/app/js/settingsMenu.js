// Handles opening/closing the settings menu and cloud sync settings

document.addEventListener('DOMContentLoaded', function() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsMenu = document.getElementById('settings-menu');
    const settingsClose = document.getElementById('settings-close');

    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener('click', function() {
            settingsMenu.classList.add('open');
            updateSettingsUI();
        });
    }
    if (settingsClose && settingsMenu) {
        settingsClose.addEventListener('click', function() {
            settingsMenu.classList.remove('open');
        });
    }
    // Optional: close menu when clicking outside
    document.addEventListener('mousedown', function(e) {
        if (settingsMenu.classList.contains('open') && !settingsMenu.contains(e.target) && e.target !== settingsBtn) {
            settingsMenu.classList.remove('open');
        }
    });

    // Initialize settings content
    initializeSettingsContent();
});

function initializeSettingsContent() {
    const settingsContent = document.querySelector('.settings-menu-content');
    if (!settingsContent) return;

    // Find or create settings sections container
    let sectionsContainer = settingsContent.querySelector('.settings-sections');
    if (!sectionsContainer) {
        sectionsContainer = document.createElement('div');
        sectionsContainer.className = 'settings-sections';
        settingsContent.appendChild(sectionsContainer);
    }

    // Add cloud sync section
    const cloudSyncSection = document.createElement('div');
    cloudSyncSection.className = 'settings-section';
    cloudSyncSection.innerHTML = `
        <h3><i class="fas fa-cloud"></i> Cloud Storage</h3>
        <div class="setting-item">
            <div class="setting-info">
                <label>Cloud Sync</label>
                <p class="setting-description">Automatically sync your sprites to the cloud</p>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="auto-sync-toggle" ${window.hybridStorage?.autoSyncEnabled ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
        <div class="setting-item">
            <div class="setting-info">
                <label>Sync Status</label>
                <p class="setting-description" id="sync-status-text">Loading...</p>
            </div>
            <button class="btn btn-primary btn-sm" id="force-sync-btn">
                <i class="fas fa-sync"></i> Sync Now
            </button>
        </div>
        <div class="setting-item">
            <div class="setting-info">
                <label>Storage Usage</label>
                <p class="setting-description" id="storage-usage-text">Calculating...</p>
            </div>
        </div>
    `;
    sectionsContainer.appendChild(cloudSyncSection);

    // Add performance section
    const performanceSection = document.createElement('div');
    performanceSection.className = 'settings-section';
    performanceSection.innerHTML = `
        <h3><i class="fas fa-tachometer-alt"></i> Performance</h3>
        <div class="setting-item">
            <div class="setting-info">
                <label>Large Image Support</label>
                <p class="setting-description">Canvas-based storage for images up to 1920x1080</p>
            </div>
            <span class="badge badge-success">Enabled</span>
        </div>
        <div class="setting-item">
            <div class="setting-info">
                <label>Compression</label>
                <p class="setting-description">PNG compression for efficient storage</p>
            </div>
            <span class="badge badge-success">Active</span>
        </div>
    `;
    sectionsContainer.appendChild(performanceSection);

    // Setup event listeners
    setupSettingsEventListeners();
}

function setupSettingsEventListeners() {
    const autoSyncToggle = document.getElementById('auto-sync-toggle');
    const forceSyncBtn = document.getElementById('force-sync-btn');

    if (autoSyncToggle) {
        autoSyncToggle.addEventListener('change', (e) => {
            if (window.hybridStorage) {
                window.hybridStorage.setAutoSync(e.target.checked);
                console.log('Auto-sync', e.target.checked ? 'enabled' : 'disabled');
            }
        });
    }

    if (forceSyncBtn) {
        forceSyncBtn.addEventListener('click', async () => {
            const user = window.currentUser;
            if (!user) {
                alert('Please sign in to sync to cloud');
                return;
            }

            forceSyncBtn.disabled = true;
            forceSyncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';

            try {
                await window.hybridStorage.forceSyncAll();
                updateSettingsUI();
                forceSyncBtn.innerHTML = '<i class="fas fa-check"></i> Synced!';
                setTimeout(() => {
                    forceSyncBtn.innerHTML = '<i class="fas fa-sync"></i> Sync Now';
                    forceSyncBtn.disabled = false;
                }, 2000);
            } catch (error) {
                console.error('Force sync failed:', error);
                forceSyncBtn.innerHTML = '<i class="fas fa-times"></i> Failed';
                setTimeout(() => {
                    forceSyncBtn.innerHTML = '<i class="fas fa-sync"></i> Sync Now';
                    forceSyncBtn.disabled = false;
                }, 2000);
            }
        });
    }
}

async function updateSettingsUI() {
    // Update sync status
    const syncStatusText = document.getElementById('sync-status-text');
    if (syncStatusText && window.hybridStorage) {
        const status = window.hybridStorage.getSyncStatus();
        const user = window.currentUser;

        if (!user) {
            syncStatusText.textContent = 'Not signed in';
            syncStatusText.style.color = '#999';
        } else if (!status.cloudAvailable) {
            syncStatusText.textContent = 'Cloud not available';
            syncStatusText.style.color = '#f39c12';
        } else if (status.syncing) {
            syncStatusText.textContent = 'Syncing...';
            syncStatusText.style.color = '#3498db';
        } else if (status.pending > 0) {
            syncStatusText.textContent = `${status.pending} sprite(s) pending sync`;
            syncStatusText.style.color = '#f39c12';
        } else {
            syncStatusText.textContent = 'All sprites synced';
            syncStatusText.style.color = '#27ae60';
        }
    }

    // Update storage usage
    const storageUsageText = document.getElementById('storage-usage-text');
    if (storageUsageText && window.hybridStorage) {
        try {
            const usage = await window.hybridStorage.getStorageUsage();
            if (usage && usage.local) {
                storageUsageText.textContent = `${usage.local.usedFormatted} of ${usage.local.quotaFormatted} (${usage.local.percentUsed}%)`;
            } else {
                storageUsageText.textContent = 'Unable to calculate';
            }
        } catch (error) {
            storageUsageText.textContent = 'Error calculating usage';
        }
    }
}
