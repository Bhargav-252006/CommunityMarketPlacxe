/**
 * Cart functionality with AJAX support
 */

// Function to add item to cart without page refresh
function addToCartAjax(itemId, quantity = 1) {
    // Show loading indicator
    const loadingToast = showToast('Adding to cart...', 'info');

    // Send AJAX request
    fetch('/cart/api/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            itemId: itemId,
            quantity: quantity
        })
    })
        .then(response => response.json())
        .then(data => {
            // Hide loading indicator
            hideToast(loadingToast);

            if (data.success) {
                // Show success message
                showToast(data.message, 'success');

                // Update cart counter if it exists
                updateCartCounter(data.cart.itemCount);
            } else {
                // Show error message
                showToast(data.message, 'danger');
            }
        })
        .catch(error => {
            // Hide loading indicator
            hideToast(loadingToast);

            // Show error message
            showToast('Error adding to cart. Please try again.', 'danger');
            console.error('Error adding to cart:', error);
        });
}

// Update cart counter in the navigation
function updateCartCounter(count) {
    const cartCounters = document.querySelectorAll('.cart-counter');

    cartCounters.forEach(counter => {
        counter.textContent = count;

        // Make the counter visible if it was hidden
        if (count > 0 && counter.classList.contains('d-none')) {
            counter.classList.remove('d-none');
        }
    });
}

// Show toast notification
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');

    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }

    // Create unique ID for this toast
    const toastId = 'toast-' + Date.now();

    // Create toast HTML
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    // Add toast to container
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);

    // Initialize and show the toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 2500 });
    toast.show();

    return toastId;
}

// Hide toast by ID
function hideToast(toastId) {
    const toastElement = document.getElementById(toastId);
    if (toastElement) {
        const toast = bootstrap.Toast.getInstance(toastElement);
        if (toast) {
            toast.hide();
        }
    }
}

// Initialize cart functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Convert all add-to-cart forms to use AJAX
    document.querySelectorAll('.add-to-cart-form').forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const itemId = this.querySelector('input[name="itemId"]').value;
            const quantityInput = this.querySelector('input[name="quantity"]');
            const quantity = quantityInput ? quantityInput.value : 1;

            addToCartAjax(itemId, quantity);
        });
    });
}); 