export const utils = {
    // LocalStorage Helper
    storage: {
        get: (key, defaultValue = null) => {
            const item = localStorage.getItem(key);
            try {
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                return item;
            }
        },
        set: (key, value) => {
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
        },
        remove: (key) => localStorage.removeItem(key)
    },

    // Format Currency
    formatCurrency: (amount, currency = 'EUR') => {
        return new Intl.NumberFormat(navigator.language, {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    // Format Date
    formatDate: (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(navigator.language, options);
    },

    // Element Selector Helper
    $: (selector) => document.querySelector(selector),
    $$: (selector) => document.querySelectorAll(selector),

    // Email Validation
    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
};
