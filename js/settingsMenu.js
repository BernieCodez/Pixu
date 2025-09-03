// Handles opening/closing the settings menu

document.addEventListener('DOMContentLoaded', function() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsMenu = document.getElementById('settings-menu');
    const settingsClose = document.getElementById('settings-close');

    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener('click', function() {
            settingsMenu.classList.add('open');
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
});
