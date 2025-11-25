// ====================================
// Auth Helper - Show/Hide Tabs by Role
// ====================================

import { getCurrentUser, isAuthenticated } from './auth-simple.js';

document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();

    if (isAuthenticated() && user) {
        console.log('User role:', user.role);

        // Show scouting tab only for admin role
        if (user.role === 'admin') {
            const scoutBtns = [
                document.getElementById('scoutTabBtn'),
                document.getElementById('scoutTabBtnMobile')
            ];
            scoutBtns.forEach(btn => {
                if (btn) btn.style.display = 'flex';
            });

            console.log('✅ Showing scouting tab for admin');
        }

        // Show social media tab only for socialmediamanager role
        if (user.role === 'socialmediamanager') {
            const socialBtns = [
                document.getElementById('socialTabBtn'),
                document.getElementById('socialTabBtnMobile')
            ];
            socialBtns.forEach(btn => {
                if (btn) btn.style.display = 'flex';
            });
            console.log('✅ Showing social media tab for socialmediamanager');
        }

        // Hide login tab, show logout tab
        const loginTabBtn = document.getElementById('loginTabBtn');
        const logoutTabBtn = document.getElementById('logoutTabBtn');
        const loginTabBtnMobile = document.getElementById('loginTabBtnMobile');
        const logoutTabBtnMobile = document.getElementById('logoutTabBtnMobile');

        if (loginTabBtn) loginTabBtn.style.display = 'none';
        if (logoutTabBtn) logoutTabBtn.style.display = 'flex';
        if (loginTabBtnMobile) loginTabBtnMobile.style.display = 'none';
        if (logoutTabBtnMobile) logoutTabBtnMobile.style.display = 'flex';
    } else {
        // Show login tab, hide logout tab
        const loginTabBtn = document.getElementById('loginTabBtn');
        const logoutTabBtn = document.getElementById('logoutTabBtn');
        const loginTabBtnMobile = document.getElementById('loginTabBtnMobile');
        const logoutTabBtnMobile = document.getElementById('logoutTabBtnMobile');

        if (loginTabBtn) loginTabBtn.style.display = 'flex';
        if (logoutTabBtn) logoutTabBtn.style.display = 'none';
        if (loginTabBtnMobile) loginTabBtnMobile.style.display = 'flex';
        if (logoutTabBtnMobile) logoutTabBtnMobile.style.display = 'none';
    }
});
