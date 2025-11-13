'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'vegefoods-cart-v1';
    const DELIVERY_FREE_THRESHOLD = 40000;
    const DELIVERY_FEE = 2000;
    const PROMO_CODES = {
        BIENVENUE: { type: 'percent', value: 10, label: 'Bienvenue -10%' },
    };

    const body = document.body;
    const navToggle = document.querySelector('[data-nav-toggle]');
    const navMenu = document.querySelector('[data-nav]');
    const header = document.querySelector('.site-header');
    const focusableSelectors = 'a[href], button:not([disabled]), textarea, input, select';
    const mqDesktop = window.matchMedia('(min-width: 961px)');

    /* ------------------------------------------------------------------ */
    /* Helpers  Balbino Tchoutzine (zoom-BT)                                                          */
    /* ------------------------------------------------------------------ */
    function sanitizeCartData(raw) {
        const data = { items: [], promo: null };
        if (raw && typeof raw === 'object') {
            if (Array.isArray(raw.items)) {
                data.items = raw.items
                    .map((item) => ({
                        id: String(item.id || '').trim(),
                        name: String(item.name || '').trim(),
                        price: Number(item.price) || 0,
                        quantity: Number(item.quantity) || 0,
                        image: item.image ? String(item.image) : '',
                        url: item.url ? String(item.url) : 'product-single.html',
                        category: item.category ? String(item.category) : '',
                    }))
                    .filter((item) => item.id && item.name && item.price > 0 && item.quantity > 0);
            }
            if (raw.promo && typeof raw.promo.code === 'string' && raw.promo.code.trim()) {
                data.promo = { code: raw.promo.code.trim().toUpperCase() };
            }
        }
        return data;
    }

    function loadCart() {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return sanitizeCartData(raw);
        } catch (error) {
            console.warn('Cart: données invalides, réinitialisation.', error);
            return { items: [], promo: null };
        }
    }

    function saveCart(data) {
        const sanitized = sanitizeCartData(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        return sanitized;
    }

    function formatPrice(value) {
        const number = Number(value) || 0;
        return `${number.toLocaleString('fr-FR')} FCFA`;
    }

    function announce(message) {
        if (!announce.region) {
            const region = document.createElement('div');
            region.className = 'sr-only';
            region.setAttribute('aria-live', 'polite');
            body.appendChild(region);
            announce.region = region;
        }
        announce.region.textContent = message;
    }

    function getActivePromo(data) {
        if (!data.promo || typeof data.promo.code !== 'string') {
            return null;
        }
        const promo = PROMO_CODES[data.promo.code];
        return promo ? { code: data.promo.code, ...promo } : null;
    }

    function getTotals(data) {
        const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const promo = getActivePromo(data);
        let discount = 0;

        if (promo && promo.type === 'percent') {
            discount = Math.round((subtotal * promo.value) / 100);
        }

        const delivery = subtotal === 0 || subtotal >= DELIVERY_FREE_THRESHOLD ? 0 : DELIVERY_FEE;
        const total = Math.max(0, subtotal - discount + delivery);

        return { subtotal, discount, delivery, total, promo };
    }










});