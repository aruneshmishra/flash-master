export default function initAuth(state) {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn');

    // Check for existing session
    const storedUser = localStorage.getItem('flashcard_user');
    if (storedUser) {
        state.user = JSON.parse(storedUser);
        updateUIForLogin();
    }

    // Global callback for Google Sign-In
    window.handleCredentialResponse = (response) => {
        try {
            // Decode JWT
            const payload = parseJwt(response.credential);

            const user = {
                name: payload.name,
                picture: payload.picture,
                email: payload.email
            };

            // Save to state and local storage
            state.user = user;
            localStorage.setItem('flashcard_user', JSON.stringify(user));

            updateUIForLogin();

        } catch (e) {
            console.error("Error decoding JWT", e);
        }
    };

    logoutBtn.addEventListener('click', () => {
        state.user = null;
        localStorage.removeItem('flashcard_user');

        // Reset UI
        loginView.classList.remove('hidden');
        loginView.classList.add('active');
        dashboardView.classList.add('hidden');
        dashboardView.classList.remove('active');

        // Note: For full logout you might want to revoke token, but for this simple app, clearing local state is enough for "logging out" of *our* app view. Google session remains.
    });

    function updateUIForLogin() {
        if (!state.user) return;

        userName.textContent = state.user.name;
        userAvatar.src = state.user.picture;

        loginView.classList.add('hidden');
        loginView.classList.remove('active');
        dashboardView.classList.remove('hidden');
        dashboardView.classList.add('active');
    }

    function parseJwt(token) {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    }
}
