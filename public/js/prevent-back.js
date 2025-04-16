// Prevent back-button navigation
(function () {
    // Check if we're on a protected page
    const protectedPages = ['/dashboard', '/vendor/dashboard', '/admin/dashboard'];
    const currentPath = window.location.pathname;

    if (protectedPages.some(page => currentPath.includes(page))) {
        // Add event listener for beforeunload
        window.addEventListener('beforeunload', function () {
            // Clear any existing session data
            sessionStorage.setItem('lastPage', currentPath);
        });

        // Check session on page load
        window.addEventListener('load', function () {
            const lastPage = sessionStorage.getItem('lastPage');
            if (lastPage && lastPage !== currentPath) {
                // If we're coming from a different page, check session
                fetch('/api/check-session')
                    .then(response => response.json())
                    .then(data => {
                        if (!data.authenticated) {
                            // If not authenticated, redirect to login
                            window.location.href = '/login';
                        }
                    })
                    .catch(() => {
                        window.location.href = '/login';
                    });
            }
        });

        // Prevent back-button navigation
        history.pushState(null, null, location.href);
        window.onpopstate = function () {
            history.pushState(null, null, location.href);
            // Check session when back button is pressed
            fetch('/api/check-session')
                .then(response => response.json())
                .then(data => {
                    if (!data.authenticated) {
                        window.location.href = '/login';
                    }
                })
                .catch(() => {
                    window.location.href = '/login';
                });
        };
    }
})(); 