document.addEventListener('DOMContentLoaded', function () {
    // Handle quantity changes using event delegation
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.quantity-btn');
        if (!btn) return;

        const action = btn.dataset.action;
        const itemId = btn.dataset.itemId;
        const maxQuantity = parseInt(btn.dataset.maxQuantity);
        const input = document.getElementById(`quantity-${itemId}`) ||
            document.getElementById(`modal-quantity-${itemId}`);

        if (!input) return;

        let currentValue = parseInt(input.value);

        if (action === 'increment' && currentValue < maxQuantity) {
            input.value = currentValue + 1;
        } else if (action === 'decrement' && currentValue > 1) {
            input.value = currentValue - 1;
        }
    });

    // Handle input validation
    document.addEventListener('input', function (e) {
        if (e.target.classList.contains('quantity-input')) {
            const max = parseInt(e.target.max);
            const value = parseInt(e.target.value);

            if (value > max) {
                e.target.value = max;
            } else if (value < 1) {
                e.target.value = 1;
            }
        }
    });
}); 