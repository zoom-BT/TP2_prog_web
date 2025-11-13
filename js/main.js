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
    /* Helpers                                                            */
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

    /* ------------------------------------------------------------------ */
    /* Cart mutations                                                      */
    /* ------------------------------------------------------------------ */
    function addToCart(product, quantity = 1) {
        if (!product?.id || !product?.name) {
            return;
        }

        const finalQuantity = Math.max(1, Number(quantity) || 1);
        const data = loadCart();
        const index = data.items.findIndex((item) => item.id === product.id);

        if (index >= 0) {
            data.items[index].quantity += finalQuantity;
        } else {
            data.items.push({
                id: product.id,
                name: product.name,
                price: Math.max(0, Number(product.price) || 0),
                quantity: finalQuantity,
                image: product.image || '',
                url: product.url || 'product-single.html',
                category: product.category || '',
            });
        }

        saveCart(data);
        refreshCartUI();
        announce(`« ${product.name} » a été ajouté au panier.`);
    }

    function setCartItemQuantity(productId, quantity) {
        const data = loadCart();
        const item = data.items.find((entry) => entry.id === productId);
        if (!item) {
            return;
        }

        item.quantity = Math.max(1, Number(quantity) || 1);
        saveCart(data);
        refreshCartUI();
    }

    function removeCartItem(productId) {
        const data = loadCart();
        const index = data.items.findIndex((entry) => entry.id === productId);
        if (index === -1) {
            return;
        }

        const [removed] = data.items.splice(index, 1);
        saveCart(data);
        refreshCartUI();
        announce(`« ${removed.name} » a été retiré du panier.`);
    }

    function clearCart() {
        saveCart({ items: [], promo: null });
        refreshCartUI();
    }

    function applyPromo(code) {
        const data = loadCart();

        if (!code || !code.trim()) {
            data.promo = null;
            saveCart(data);
            refreshCartUI();
            return { success: true, message: 'Aucune promotion appliquée.' };
        }

        const normalized = code.trim().toUpperCase();
        const promo = PROMO_CODES[normalized];

        if (!promo) {
            return { success: false, message: "Ce code n'est pas valide." };
        }

        data.promo = { code: normalized };
        saveCart(data);
        refreshCartUI();
        return { success: true, message: `Code ${normalized} appliqué : ${promo.label}.` };
    }

    /* ------------------------------------------------------------------ */
    /* Rendering                                                           */
    /* ------------------------------------------------------------------ */
    function updateCartBadge(data) {
        const count = data.items.reduce((total, item) => total + item.quantity, 0);
        const label =
            count === 0 ? '0 article dans le panier' : `${count} article${count > 1 ? 's' : ''} dans le panier`;

        document.querySelectorAll('[data-cart-count]').forEach((badge) => {
            badge.textContent = count;
            badge.setAttribute('aria-label', label);
        });
    }

    function renderCartPage(data) {
        const cartTableBody = document.querySelector('[data-cart-items]');
        if (!cartTableBody) {
            return;
        }

        const cartMessage = document.querySelector('[data-cart-message]');
        const cartSubtotalEl = document.querySelector('[data-cart-subtotal]');
        const cartDeliveryEl = document.querySelector('[data-cart-delivery]');
        const cartTotalEl = document.querySelector('[data-cart-total]');
        const cartDiscountRow = document.querySelector('[data-cart-discount-row]');
        const cartDiscountEl = document.querySelector('[data-cart-discount]');
        const cartPromoToggle = document.querySelector('[data-cart-toggle-promo]');
        const cartPromoSection = document.querySelector('[data-cart-promo]');
        const cartPromoInput = document.querySelector('[data-cart-promo-input]');
        const cartPromoFeedback = document.querySelector('[data-cart-promo-feedback]');
        const cartNote = document.querySelector('[data-cart-note]');

        const totals = getTotals(data);

        if (data.items.length === 0) {
            cartTableBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="cart-empty">
                            <h2>Votre panier est vide</h2>
                            <p>Ajoutez vos fruits et légumes biologiques préférés pour commencer votre commande.</p>
                            <a class="btn btn--primary" href="shop.html">Découvrir la boutique</a>
                        </div>
                    </td>
                </tr>
            `;
            cartMessage && (cartMessage.hidden = true);
            if (cartPromoSection) {
                cartPromoSection.hidden = true;
            }
            if (cartPromoToggle) {
                cartPromoToggle.textContent = 'Ajouter un code';
            }
        } else {
            cartTableBody.innerHTML = '';
            data.items.forEach((item) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="table__meta">
                            <div class="table__thumb">
                                <img src="${item.image || 'images/product-1.jpg'}" alt="${item.name}">
                            </div>
                            <div>
                                <strong>${item.name}</strong>
                                ${item.category ? `<p class="table__note">${item.category}</p>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>${formatPrice(item.price)}</td>
                    <td>
                        <div class="quantity-selector">
                            <button type="button" aria-label="Diminuer la quantité de ${item.name}" data-cart-decrease="${item.id}">−</button>
                            <input type="number" value="${item.quantity}" min="1" aria-label="Quantité pour ${item.name}" data-cart-input="${item.id}">
                            <button type="button" aria-label="Augmenter la quantité de ${item.name}" data-cart-increase="${item.id}">+</button>
                        </div>
                    </td>
                    <td>${formatPrice(item.price * item.quantity)}</td>
                    <td><button class="link-remove" type="button" data-cart-remove="${item.id}">Retirer</button></td>
                `;
                cartTableBody.appendChild(row);
            });
            cartMessage && (cartMessage.hidden = false);
        }

        cartSubtotalEl && (cartSubtotalEl.textContent = formatPrice(totals.subtotal));
        cartDeliveryEl && (cartDeliveryEl.textContent = totals.delivery === 0 ? 'Offerte' : formatPrice(totals.delivery));
        cartTotalEl && (cartTotalEl.textContent = formatPrice(totals.total));

        if (cartDiscountRow && cartDiscountEl) {
            if (totals.discount > 0) {
                cartDiscountRow.hidden = false;
                cartDiscountEl.textContent = `- ${formatPrice(totals.discount)}`;
            } else {
                cartDiscountRow.hidden = true;
                cartDiscountEl.textContent = '-0 FCFA';
            }
        }

        if (cartPromoInput) {
            cartPromoInput.value = totals.promo ? totals.promo.code : '';
        }

        if (cartPromoFeedback) {
            cartPromoFeedback.textContent = '';
            cartPromoFeedback.classList.remove('is-success', 'is-error');
        }

        if (cartPromoToggle) {
            if (!cartPromoSection || cartPromoSection.hidden) {
                cartPromoToggle.textContent = totals.promo ? 'Modifier le code' : 'Ajouter un code';
            } else {
                cartPromoToggle.textContent = 'Masquer le code';
            }
        }

        if (cartNote) {
            if (totals.subtotal === 0) {
                cartNote.textContent = 'Paiement sécurisé · Orange Money, MTN, cartes Visa/Mastercard';
            } else if (totals.subtotal < DELIVERY_FREE_THRESHOLD) {
                const remaining = DELIVERY_FREE_THRESHOLD - totals.subtotal;
                cartNote.textContent = `Ajoutez ${formatPrice(remaining)} pour profiter de la livraison offerte.`;
            } else {
                cartNote.textContent =
                    'Livraison offerte sur votre commande. Paiement sécurisé · Orange Money, MTN, cartes Visa/Mastercard';
            }
        }
    }

    function renderCheckoutSummary(data) {
        const checkoutSummary = document.querySelector('[data-checkout-summary]');
        if (!checkoutSummary) {
            return;
        }

        const checkoutItemsList = checkoutSummary.querySelector('[data-checkout-items]');
        const checkoutSubtotalEl = checkoutSummary.querySelector('[data-checkout-subtotal]');
        const checkoutDeliveryEl = checkoutSummary.querySelector('[data-checkout-delivery]');
        const checkoutTotalEl = checkoutSummary.querySelector('[data-checkout-total]');
        const checkoutDiscountRow = checkoutSummary.querySelector('[data-checkout-discount-row]');
        const checkoutDiscountEl = checkoutSummary.querySelector('[data-checkout-discount]');
        const checkoutEmpty = checkoutSummary.querySelector('[data-checkout-empty]');
        const checkoutForm = document.querySelector('[data-checkout-form]');
        const checkoutSubmitBtn = checkoutForm?.querySelector('[type="submit"]');

        const totals = getTotals(data);

        if (checkoutItemsList) {
            checkoutItemsList.innerHTML = '';
            data.items.forEach((item) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${item.name} × ${item.quantity}</span>
                    <span>${formatPrice(item.price * item.quantity)}</span>
                `;
                checkoutItemsList.appendChild(li);
            });
        }

        if (checkoutEmpty) {
            checkoutEmpty.hidden = data.items.length > 0;
        }

        checkoutSubtotalEl && (checkoutSubtotalEl.textContent = formatPrice(totals.subtotal));
        checkoutDeliveryEl && (checkoutDeliveryEl.textContent = totals.delivery === 0 ? 'Offerte' : formatPrice(totals.delivery));
        checkoutTotalEl && (checkoutTotalEl.textContent = formatPrice(totals.total));

        if (checkoutDiscountRow && checkoutDiscountEl) {
            if (totals.discount > 0) {
                checkoutDiscountRow.hidden = false;
                checkoutDiscountEl.textContent = `- ${formatPrice(totals.discount)}`;
            } else {
                checkoutDiscountRow.hidden = true;
                checkoutDiscountEl.textContent = '-0 FCFA';
            }
        }

        if (checkoutSubmitBtn) {
            checkoutSubmitBtn.disabled = data.items.length === 0;
        }
    }

    function refreshCartUI() {
        const data = loadCart();
        updateCartBadge(data);
        renderCartPage(data);
        renderCheckoutSummary(data);
    }

    /* ------------------------------------------------------------------ */
    /* UI bindings                                                         */
    /* ------------------------------------------------------------------ */
    function getProductFromElement(trigger) {
        const card = trigger.closest('[data-product-card]');
        if (!card) {
            return null;
        }
        return {
            id: card.dataset.productId,
            name: card.dataset.productName,
            price: Number(card.dataset.productPrice) || 0,
            image: card.dataset.productImage || '',
            url: card.dataset.productUrl || 'product-single.html',
            category: card.dataset.productCategory || '',
        };
    }

    function initAddToCartButtons() {
        document.querySelectorAll('[data-add-to-cart]').forEach((button) => {
            button.addEventListener('click', () => {
                const product = getProductFromElement(button);
                if (!product) {
                    return;
                }
                let quantity = 1;
                const quantityInput = button.closest('[data-product-card]')?.querySelector('[data-quantity-input]');
                if (quantityInput) {
                    quantity = Number(quantityInput.value) || 1;
                }
                addToCart(product, quantity);
            });
        });
    }

    function initBuyNowButtons() {
        document.querySelectorAll('[data-buy-now]').forEach((button) => {
            button.addEventListener('click', () => {
                const product = getProductFromElement(button);
                if (!product) {
                    return;
                }
                let quantity = 1;
                const quantityInput = button.closest('[data-product-card]')?.querySelector('[data-quantity-input]');
                if (quantityInput) {
                    quantity = Number(quantityInput.value) || 1;
                }
                addToCart(product, quantity);
                window.location.href = 'checkout.html';
            });
        });
    }

    function initProductQuantityControls() {
        document.querySelectorAll('[data-quantity-selector]').forEach((selector) => {
            const input = selector.querySelector('[data-quantity-input]');
            const decrease = selector.querySelector('[data-quantity-decrease]');
            const increase = selector.querySelector('[data-quantity-increase]');

            if (decrease && input) {
                decrease.addEventListener('click', () => {
                    const current = Number(input.value) || 1;
                    input.value = Math.max(1, current - 1);
                });
            }

            if (increase && input) {
                increase.addEventListener('click', () => {
                    const current = Number(input.value) || 1;
                    input.value = current + 1;
                });
            }

            if (input) {
                input.addEventListener('change', () => {
                    input.value = Math.max(1, Number(input.value) || 1);
                });
            }
        });
    }

    function initCartTableListeners() {
        const cartTableBody = document.querySelector('[data-cart-items]');
        if (!cartTableBody || cartTableBody.dataset.bound === 'true') {
            return;
        }
        cartTableBody.dataset.bound = 'true';

        cartTableBody.addEventListener('click', (event) => {
            const decreaseBtn = event.target.closest('[data-cart-decrease]');
            const increaseBtn = event.target.closest('[data-cart-increase]');
            const removeBtn = event.target.closest('[data-cart-remove]');

            if (decreaseBtn) {
                const id = decreaseBtn.dataset.cartDecrease;
                const data = loadCart();
                const item = data.items.find((entry) => entry.id === id);
                if (item && item.quantity > 1) {
                    setCartItemQuantity(id, item.quantity - 1);
                }
            }

            if (increaseBtn) {
                const id = increaseBtn.dataset.cartIncrease;
                const data = loadCart();
                const item = data.items.find((entry) => entry.id === id);
                if (item) {
                    setCartItemQuantity(id, item.quantity + 1);
                }
            }

            if (removeBtn) {
                const id = removeBtn.dataset.cartRemove;
                removeCartItem(id);
            }
        });

        cartTableBody.addEventListener('change', (event) => {
            const input = event.target.closest('input[data-cart-input]');
            if (!input) {
                return;
            }
            const id = input.dataset.cartInput;
            const value = Math.max(1, Number(input.value) || 1);
            setCartItemQuantity(id, value);
        });
    }

    function initCartPromoControls() {
        const cartPromoToggle = document.querySelector('[data-cart-toggle-promo]');
        const cartPromoSection = document.querySelector('[data-cart-promo]');
        const cartPromoApply = document.querySelector('[data-cart-apply-promo]');
        const cartPromoInput = document.querySelector('[data-cart-promo-input]');
        const cartPromoFeedback = document.querySelector('[data-cart-promo-feedback]');

        if (cartPromoToggle) {
            cartPromoToggle.addEventListener('click', () => {
                if (!cartPromoSection) {
                    return;
                }
                const shouldOpen = cartPromoSection.hidden;
                cartPromoSection.hidden = !shouldOpen;
                cartPromoToggle.textContent = shouldOpen ? 'Masquer le code' : 'Ajouter un code';
                if (shouldOpen) {
                    cartPromoInput?.focus();
                } else if (cartPromoFeedback) {
                    cartPromoFeedback.textContent = '';
                    cartPromoFeedback.classList.remove('is-success', 'is-error');
                }
            });
        }

        if (cartPromoApply && cartPromoInput) {
            cartPromoApply.addEventListener('click', () => {
                const { success, message } = applyPromo(cartPromoInput.value);
                if (cartPromoFeedback) {
                    cartPromoFeedback.textContent = message;
                    cartPromoFeedback.classList.toggle('is-success', success);
                    cartPromoFeedback.classList.toggle('is-error', !success);
                }
            });
        }
    }

    function initCheckoutButton() {
        const checkoutButton = document.querySelector('[data-checkout-button]');
        if (!checkoutButton) {
            return;
        }
        checkoutButton.addEventListener('click', () => {
            const data = loadCart();
            if (data.items.length === 0) {
                announce('Votre panier est vide.');
                const cartPromoFeedback = document.querySelector('[data-cart-promo-feedback]');
                if (cartPromoFeedback) {
                    cartPromoFeedback.textContent = 'Ajoutez des produits avant de poursuivre.';
                    cartPromoFeedback.classList.add('is-error');
                }
                return;
            }
            window.location.href = 'checkout.html';
        });
    }

    function initCheckoutForm() {
        const checkoutForm = document.querySelector('[data-checkout-form]');
        if (!checkoutForm) {
            return;
        }

        const checkoutSuccess = document.querySelector('[data-checkout-success]');
        const checkoutSuccessText = document.querySelector('[data-checkout-success-text]');
        const checkoutSummary = document.querySelector('[data-checkout-summary]');
        const checkoutPromoInput = checkoutForm.querySelector('input[name="promo"]');

        const data = loadCart();
        const activePromo = getActivePromo(data);
        if (checkoutPromoInput && activePromo) {
            checkoutPromoInput.value = activePromo.code;
        }

        if (checkoutPromoInput) {
            checkoutPromoInput.addEventListener('change', () => {
                const { message } = applyPromo(checkoutPromoInput.value);
                announce(message);
            });
        }

        checkoutForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const currentData = loadCart();
            if (currentData.items.length === 0) {
                announce('Le panier est vide, la commande ne peut pas être créée.');
                return;
            }

            const formData = new FormData(checkoutForm);
            const promoValue = (formData.get('promo') || '').toString();
            if (promoValue) {
                applyPromo(promoValue);
            }
            const customerName = formData.get('firstname') || 'client·e';
            const orderId = `VEG-${Date.now().toString().slice(-6)}`;

            console.group('Commande simulée');
            console.log('Numéro de commande :', orderId);
            console.log('Données client :', Object.fromEntries(formData.entries()));
            console.log('Panier :', currentData.items);
            console.groupEnd();

            clearCart();

            checkoutForm.setAttribute('hidden', 'true');
            checkoutSummary?.setAttribute('hidden', 'true');
            if (checkoutSuccess) {
                checkoutSuccess.hidden = false;
            }
            if (checkoutSuccessText) {
                checkoutSuccessText.textContent = `Merci ${customerName}, votre commande ${orderId} a bien été enregistrée. Nous revenons vers vous sous 2 heures pour confirmer la livraison.`;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
            announce('Votre commande a été enregistrée avec succès.');
        });
    }

    function setupRevealAnimations() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const revealEls = document.querySelectorAll('[data-reveal]');

        if (prefersReducedMotion) {
            revealEls.forEach((el) => el.classList.add('is-visible'));
            return;
        }

        if (!revealEls.length) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.2,
                rootMargin: '0px 0px -10% 0px',
            }
        );

        revealEls.forEach((el, index) => {
            el.style.setProperty('--reveal-delay', `${index * 60}ms`);
            observer.observe(el);
        });
    }

    function setupNavigation() {
        if (!navToggle || !navMenu) {
            return;
        }

        const navOverlay = document.createElement('div');
        navOverlay.className = 'nav-overlay';
        body.appendChild(navOverlay);
        let isOpen = false;

        function setNavState(open) {
            isOpen = open;
            navMenu.classList.toggle('is-open', open);
            navToggle.setAttribute('aria-expanded', String(open));
            body.classList.toggle('has-nav-open', open);
            navOverlay.classList.toggle('is-visible', open);

            if (open) {
                const firstLink = navMenu.querySelector(focusableSelectors);
                firstLink?.focus({ preventScroll: true });
            } else {
                navToggle.focus({ preventScroll: true });
            }
        }

        navToggle.addEventListener('click', () => {
            setNavState(!isOpen);
        });

        navOverlay.addEventListener('click', () => setNavState(false));

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && isOpen) {
                setNavState(false);
            }
        });

        navMenu.addEventListener('keydown', (event) => {
            if (!isOpen) {
                return;
            }

            if (event.key === 'Escape') {
                setNavState(false);
                return;
            }

            if (event.key === 'Tab') {
                const focusables = Array.from(navMenu.querySelectorAll(focusableSelectors));
                const first = focusables[0];
                const last = focusables[focusables.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });

        navMenu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                if (!mqDesktop.matches) {
                    setNavState(false);
                }
            });
        });

        mqDesktop.addEventListener('change', () => {
            if (mqDesktop.matches) {
                setNavState(false);
            }
        });
    }

    function setupHeaderOnScroll() {
        if (!header) {
            return;
        }
        const toggleHeaderState = () => {
            header.classList.toggle('is-condensed', window.scrollY > 24);
        };
        toggleHeaderState();
        window.addEventListener('scroll', toggleHeaderState, { passive: true });
    }

    /* ------------------------------------------------------------------ */
    /* Initialisation                                                      */
    /* ------------------------------------------------------------------ */
    setupNavigation();
    setupHeaderOnScroll();
    setupRevealAnimations();
    initProductQuantityControls();
    initAddToCartButtons();
    initBuyNowButtons();
    initCartTableListeners();
    initCartPromoControls();
    initCheckoutButton();
    initCheckoutForm();

    refreshCartUI();

    window.addEventListener('pageshow', refreshCartUI);
    window.addEventListener('load', refreshCartUI);
    window.addEventListener('storage', refreshCartUI);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            refreshCartUI();
        }
    });
});