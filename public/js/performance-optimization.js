/**
 * Frontend Performance Optimizations
 * This script improves the loading speed and user experience of the application
 */

document.addEventListener('DOMContentLoaded', function () {
    // Lazy load images that are not in the viewport
    if ('IntersectionObserver' in window) {
        const imgObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });

        // Target all images with data-src attribute
        document.querySelectorAll('img[data-src]').forEach(img => {
            imgObserver.observe(img);
        });
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        document.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.getAttribute('data-src');
            img.removeAttribute('data-src');
        });
    }

    // Preconnect to external domains for faster resource loading
    const domains = [
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com'
    ];

    domains.forEach(domain => {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        document.head.appendChild(link);
    });

    // Detect slow connections and simplify UI if needed
    if (navigator.connection && navigator.connection.effectiveType === 'slow-2g') {
        document.body.classList.add('lite-mode');
        console.log('Lite mode enabled for slow connection');
    }
}); 