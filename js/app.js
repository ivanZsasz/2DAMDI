import { auth } from './firebase-config.js';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { i18n } from './i18n.js';
import { utils } from './utils.js';
import { firestoreManager } from './firestore.js';
import { apiManager } from './api.js';

class App {
    constructor() {
        this.currentView = 'dashboard';
        this.selectedAccountId = null;
        this.init();
    }

    async init() {
        i18n.init(); // Initialize Multilanguage

        // Listen for language changes to update chart and re-render lists
        window.addEventListener('languageChanged', (e) => {
            const lang = e.detail.lang;
            // Update Chart
            if (window.expenseChart) {
                window.expenseChart.data.labels = [
                    i18n.t('cat.home'),
                    i18n.t('cat.food'),
                    i18n.t('cat.transport'),
                    i18n.t('cat.leisure'),
                    i18n.t('cat.shopping'),
                    i18n.t('cat.health'),
                    i18n.t('cat.education'),
                    i18n.t('cat.bills'),
                    i18n.t('cat.other')
                ];
                window.expenseChart.update();
            }
            // Re-render transactions if available
            if (this.lastTransactions) {
                this.renderTransactions(this.lastTransactions);
            }
            // Re-render accounts (for badges if any text there) - optional
        });

        this.setupAuth(); // Initialize Authentication Logic
        this.setupNavigation();
        this.setupModal();
        this.setupBalanceToggle();

        onAuthStateChanged(auth, (user) => {
            if (user) {
                // Show Splash
                const splash = document.getElementById('splash-screen');
                if (splash) splash.classList.remove('splash-hidden');

                // Start loading data immediately
                this.handleUserAuthenticated(user);

                // Wait 2s before hiding splash
                setTimeout(() => {
                    if (splash) splash.classList.add('splash-hidden');
                }, 2000);
            } else {
                this.handleUserSignedOut();
            }
        });

        document.addEventListener('keydown', (e) => {
            // Close transaction detail modal on ESC
            if (e.key === 'Escape') {
                const txDetailModal = document.getElementById('tx-detail-modal');
                if (txDetailModal && txDetailModal.classList.contains('open')) {
                    txDetailModal.classList.remove('open');
                    return;
                }
            }

            const backdrop = document.getElementById('modal-backdrop');
            if (backdrop && backdrop.classList.contains('open')) {
                this.handlePhysicalKey(e);
            }
        });

        // PDF Export Button
        const exportBtn = document.getElementById('btn-export-pdf');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportAnalysisPDF());
        }

        // Voice Input Setup
        this.setupVoiceInput();

        // Barcode Scanner Setup
        this.initBarcodeScanner();

        // Load Dark Mode preference on app start
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }
    }

    setupAuth() {
        // Elements
        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const nameInput = document.getElementById('auth-name');
        const submitBtn = document.getElementById('auth-submit');
        const googleBtn = document.getElementById('google-login');
        const toggleLink = document.getElementById('auth-toggle-link');
        const toggleText = document.getElementById('auth-toggle-text');
        const title = document.getElementById('auth-title');
        const messageEl = document.getElementById('auth-message');

        let isLoginMode = true;

        // Toggle Login / Register
        if (toggleLink) {
            toggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                isLoginMode = !isLoginMode;
                title.textContent = isLoginMode ? 'Bienvenido' : 'Crear Cuenta';
                submitBtn.textContent = isLoginMode ? 'Iniciar Sesión' : 'Registrarse';
                toggleText.textContent = isLoginMode ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?';
                toggleLink.textContent = isLoginMode ? 'Crear cuenta nueva' : 'Iniciar sesión';
                messageEl.textContent = '';
                // Toggle Name Input
                if (nameInput) nameInput.style.display = isLoginMode ? 'none' : 'block';
            });
        }

        // Handle Email/Password Submit
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const email = emailInput.value;
                const password = passwordInput.value;
                const name = nameInput ? nameInput.value : '';
                messageEl.textContent = '';

                if (!email || !password) {
                    messageEl.textContent = 'Por favor completa todos los campos';
                    return;
                }

                if (!isLoginMode && !name) {
                    messageEl.textContent = 'Por favor ingresa tu nombre';
                    return;
                }

                try {
                    if (isLoginMode) {
                        await signInWithEmailAndPassword(auth, email, password);
                    } else {
                        const userCred = await createUserWithEmailAndPassword(auth, email, password);

                        // Update Profile with Name
                        await updateProfile(userCred.user, { displayName: name });

                        // Manually update Dashboard greeting to reflect new name immediately
                        const greetingEl = document.getElementById('greeting');
                        if (greetingEl) greetingEl.textContent = `Hola, ${name}`;

                        // Ensure account creation (if race condition occurred) varies by impl
                        await firestoreManager.initAccounts(userCred.user);
                    }
                } catch (error) {
                    console.error("Auth Error:", error);
                    let msg = "Error de autenticación";
                    if (error.code === 'auth/invalid-email') msg = 'Correo inválido';
                    if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado';
                    if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta';
                    if (error.code === 'auth/email-already-in-use') msg = 'El correo ya está registrado';
                    if (error.code === 'auth/weak-password') msg = 'La contraseña es muy débil';
                    messageEl.textContent = msg;
                }
            });
        }

        // Handle Google Login
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                try {
                    const provider = new GoogleAuthProvider();
                    await signInWithPopup(auth, provider);
                } catch (error) {
                    console.error("Google Auth Error:", error);
                    messageEl.textContent = "Error al iniciar con Google";
                }
            });
        }
    }

    setupNavigation() {
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }

        ['nav-mobile-item', 'sidebar-item'].forEach(cls => {
            document.querySelectorAll('.' + cls).forEach(item => {
                if (item.id === 'logout-sidebar') return;
                item.addEventListener('click', (e) => {
                    const target = item.getAttribute('data-target');
                    if (target) {
                        e.preventDefault();
                        this.switchView(target);
                        this.syncNav(target);
                    }
                });
            });
        });

        // Logout Listeners
        ['logout-sidebar', 'logout-btn-mobile'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleLogout();
                });
            }
        });
    }


    syncNav(target) {
        document.querySelectorAll('.sidebar-item, .nav-mobile-item').forEach(el => el.classList.remove('active'));
        const sbItem = document.querySelector(`.sidebar-item[data-target="${target}"]`);
        const mbItem = document.querySelector(`.nav-mobile-item[data-target="${target}"]`);
        if (sbItem) sbItem.classList.add('active');
        if (mbItem) mbItem.classList.add('active');
    }

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => {
            v.style.display = 'none';
            v.classList.remove('active');
        });
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = 'block';
            setTimeout(() => targetView.classList.add('active'), 10);
        }
        this.currentView = viewId;
        if (viewId === 'market') {
            this.initCryptoTicker();
            this.initCurrencyConverter();
            this.loadStocks();
        }
        if (viewId === 'profile') this.initProfile();
        if (viewId === 'analysis') this.loadAnalysis();
        if (viewId === 'expense-map') this.loadExpenseMap();
        if (viewId === 'transfers') this.initTransfers();
        if (viewId === 'wallet') this.initWallet();
    }

    // ==========================================
    // WALLET / MULTI-ACCOUNT VIEW
    // ==========================================
    initWallet() {
        this.renderAccountCards(firestoreManager.accounts);

        // Bind "Nueva Cuenta" button (one-time)
        const newAccBtn = document.getElementById('btn-new-account');
        if (newAccBtn && !newAccBtn.dataset.bound) {
            newAccBtn.dataset.bound = 'true';
            newAccBtn.addEventListener('click', () => this.openCreateAccountModal());
        }
    }

    renderAccountCards(accounts) {
        const grid = document.getElementById('accounts-grid');
        const netWorthEl = document.getElementById('net-worth');
        if (!grid) return;

        // Net Worth
        const totalNet = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
        if (netWorthEl) netWorthEl.textContent = utils.formatCurrency(totalNet);

        grid.innerHTML = '';
        if (accounts.length === 0) {
            grid.innerHTML = '<p class="text-sm" style="opacity:0.6;">No tienes cuentas aún.</p>';
            return;
        }

        const typeMap = { bank: 'Banco', cash: 'Efectivo', savings: 'Ahorro', investment: 'Inversión' };
        const brandNames = ['VISA', 'Mastercard', 'VISA'];

        accounts.forEach((acc, i) => {
            const card = document.createElement('div');
            card.className = 'account-card';
            if (acc.type === 'investment') card.classList.add('investment-card');
            if (acc.type === 'savings') card.classList.add('savings-card');
            card.style.background = `linear-gradient(135deg, ${acc.color || '#1a1a2e'} 0%, ${this.lightenColor(acc.color || '#1a1a2e', 30)} 100%)`;

            const fakeNumber = `•••• •••• •••• ${acc.id.slice(-4).toUpperCase()}`;
            const brand = brandNames[i % brandNames.length];

            // Try Clearbit logo only for known bank names
            const knownBanks = ['bbva', 'santander', 'caixabank', 'ing', 'bankinter', 'unicaja', 'sabadell', 'openbank', 'revolut', 'n26', 'wise', 'paypal'];
            const nameClean = acc.name.toLowerCase().replace(/\s+/g, '').replace(/banco/gi, '');
            const hasLogo = knownBanks.some(b => nameClean.includes(b));
            const logoUrl = hasLogo ? `https://logo.clearbit.com/${nameClean}.com` : '';

            const interestBadge = (acc.type === 'investment' || acc.type === 'savings') && acc.interestRate
                ? `<span class="card-interest-badge">Generando ${acc.interestRate}% TAE</span>` : '';

            card.innerHTML = `
                ${interestBadge}
                ${acc.isMain ? '<span class="card-main-badge">⭐ Principal</span>' : ''}
                <div class="card-actions">
                    <button class="card-action-btn" onclick="window.app.openTransferModal('${acc.id}')" title="Mover dinero">
                        <i class="ph ph-arrows-clockwise"></i>
                    </button>
                </div>
                <div class="card-top" style="margin-top: ${acc.isMain ? '24px' : '0'}">
                    <div class="card-chip"></div>
                    ${hasLogo ? `<img class="card-logo" src="${logoUrl}" onerror="this.style.display='none'" alt="">` : ''}
                </div>
                <div class="card-number">${fakeNumber}</div>
                <div class="card-bottom">
                    <div>
                        <div class="card-type-badge">${typeMap[acc.type] || acc.type}</div>
                        <div class="card-name">${acc.name}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="card-balance">${utils.formatCurrency(acc.balance || 0)}</div>
                        <div class="card-brand">${brand}</div>
                    </div>
                </div>
            `;
            // Click to select account
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-action-btn')) return; // Don't select on transfer btn
                this.selectAccount(acc.id, card);
            });
            // Restore active state if this card was selected
            if (this.selectedAccountId === acc.id) card.classList.add('card-active');
            grid.appendChild(card);
        });
    }

    openProductModal(type) {
        const modal = document.getElementById(`modal-${type}`);
        if (modal) {
            // Reset checkbox and button
            const check = document.getElementById(`check-${type}`);
            const btn = document.getElementById(`btn-confirm-${type}`);
            if (check) check.checked = false;
            if (btn) btn.disabled = true;
            modal.style.display = 'flex';
        }
    }

    async confirmProduct(type) {
        const user = auth.currentUser;
        if (!user) return;

        const products = {
            fondo: { name: 'Fondo Monetario', type: 'investment', interestRate: 1.20, color: '#1a3a2e' },
            remunerada: { name: 'Cuenta Remunerada', type: 'savings', interestRate: 1.25, color: '#1a2a3e' }
        };

        const product = products[type];
        if (!product) return;

        try {
            await firestoreManager.createAccount(user, {
                name: product.name,
                balance: 0,
                type: product.type,
                color: product.color,
                interestRate: product.interestRate
            });

            // Close modal
            const modal = document.getElementById(`modal-${type}`);
            if (modal) modal.style.display = 'none';

            // Update button to "Ya contratado"
            this.updateProductButtons();

            this.showToast('¡Enhorabuena! Tu cuenta se ha creado. Ve a la pestaña Cartera para ingresar tu primer depósito. 🎉');
        } catch (error) {
            console.error('Error contratando producto:', error);
            this.showToast('Error al contratar el producto.');
        }
    }

    updateProductButtons() {
        const accounts = firestoreManager.accounts || [];
        const hasFondo = accounts.some(a => a.name === 'Fondo Monetario');
        const hasRemunerada = accounts.some(a => a.name === 'Cuenta Remunerada');

        const btnFondo = document.getElementById('btn-contract-fondo');
        const btnRemunerada = document.getElementById('btn-contract-remunerada');

        if (btnFondo && hasFondo) {
            btnFondo.disabled = true;
            btnFondo.innerHTML = '<i class="ph ph-check"></i> Ya contratado';
        }
        if (btnRemunerada && hasRemunerada) {
            btnRemunerada.disabled = true;
            btnRemunerada.innerHTML = '<i class="ph ph-check"></i> Ya contratado';
        }
    }

    selectAccount(accountId, cardEl) {
        // Deselect all
        document.querySelectorAll('.account-card.card-active').forEach(c => c.classList.remove('card-active'));

        // Select clicked
        if (cardEl) cardEl.classList.add('card-active');
        this.selectedAccountId = accountId;

        // Show interest simulator button if applicable
        const acc = firestoreManager.accounts.find(a => a.id === accountId);
        const actionsEl = document.getElementById('account-interest-actions');
        if (actionsEl) {
            if (acc && (acc.type === 'investment' || acc.type === 'savings') && acc.interestRate) {
                actionsEl.innerHTML = `
                    <button class="btn-simulate-interest" onclick="window.app.simulateDailyInterest('${accountId}')">
                        ⏱️ Simular 1 Día (Interés Diario)
                    </button>`;
            } else {
                actionsEl.innerHTML = '';
            }
        }

        // Load history
        this.loadAccountHistory(accountId);
    }

    async loadAccountHistory(accountId) {
        const listEl = document.getElementById('account-history-list');
        if (!listEl) return;
        listEl.innerHTML = '<p class="text-sm" style="opacity:0.5; text-align:center; padding:16px;">Cargando...</p>';

        try {
            const user = auth.currentUser;
            if (!user) return;

            // Filter transactions for this account
            const txs = firestoreManager.transactions.filter(t => t.accountId === accountId);

            if (txs.length === 0) {
                listEl.innerHTML = '<p class="text-sm" style="opacity:0.5; text-align:center; padding:24px;">No hay movimientos en esta cuenta.</p>';
                return;
            }

            // Sort by date desc
            txs.sort((a, b) => new Date(b.date) - new Date(a.date));

            listEl.innerHTML = '';
            txs.forEach(t => {
                const isIncome = t.type === 'income';
                const sign = isIncome ? '+' : '-';
                const colorClass = isIncome ? 'income' : 'expense';
                const dateStr = new Date(t.date).toLocaleDateString('es-ES', {
                    day: '2-digit', month: 'short', year: 'numeric'
                });
                const item = document.createElement('div');
                item.className = 'acc-history-item';
                item.innerHTML = `
                    <div class="acc-history-left">
                        <span class="acc-history-category">${t.category || t.description || 'Movimiento'}</span>
                        <span class="acc-history-date">${dateStr}</span>
                    </div>
                    <span class="acc-history-amount ${colorClass}">${sign}${utils.formatCurrency(t.amount)}</span>
                `;
                listEl.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading account history:', error);
            listEl.innerHTML = '<p class="text-sm" style="color:#f87171;">Error cargando movimientos.</p>';
        }
    }

    async simulateDailyInterest(accountId) {
        const user = auth.currentUser;
        if (!user) return;

        const acc = firestoreManager.accounts.find(a => a.id === accountId);
        if (!acc || !acc.interestRate) {
            this.showToast('Esta cuenta no genera intereses.');
            return;
        }

        let ganancia = acc.balance * (acc.interestRate / 100) / 365;
        // Demo hack: ensure at least 0.01 if balance > 0
        if (acc.balance > 0) ganancia = Math.max(0.01, ganancia);
        ganancia = parseFloat(ganancia.toFixed(2));

        if (ganancia <= 0) {
            this.showToast('El saldo es 0. Deposita dinero primero.');
            return;
        }

        try {
            await firestoreManager.simulateDailyInterest(user, accountId, ganancia);
            this.showToast(`¡Has generado +${utils.formatCurrency(ganancia)} hoy! 💰`);
            // History will auto-refresh via onSnapshot
            // Refresh account history manually too
            setTimeout(() => this.loadAccountHistory(accountId), 500);
        } catch (error) {
            console.error('Error simulating interest:', error);
            this.showToast('Error al simular intereses.');
        }
    }

    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    }

    openCreateAccountModal() {
        const modal = document.getElementById('modal-create-account');
        if (modal) modal.classList.add('open');

        // Close button
        const closeBtn = document.getElementById('close-account-modal');
        if (closeBtn && !closeBtn.dataset.bound) {
            closeBtn.dataset.bound = 'true';
            closeBtn.addEventListener('click', () => modal.classList.remove('open'));
        }

        // Click outside to close
        if (modal && !modal.dataset.bound) {
            modal.dataset.bound = 'true';
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('open');
            });
        }

        // Save button
        const saveBtn = document.getElementById('btn-save-account');
        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = 'true';
            saveBtn.addEventListener('click', () => this.handleCreateAccount());
        }
    }

    async handleCreateAccount() {
        const user = auth.currentUser;
        if (!user) return;

        const name = document.getElementById('acc-name').value.trim();
        const type = document.getElementById('acc-type').value;
        const balance = document.getElementById('acc-balance').value;
        const color = document.getElementById('acc-color').value;

        if (!name) { this.showToast('Nombre requerido'); return; }

        try {
            await firestoreManager.createAccount(user, { name, type, balance, color });
            this.showToast('Cuenta creada ✨');
            document.getElementById('modal-create-account').classList.remove('open');
            // Clear form
            document.getElementById('acc-name').value = '';
            document.getElementById('acc-balance').value = '';
        } catch (err) {
            console.error(err);
            this.showToast(err.message || 'Error al crear cuenta');
        }
    }

    openTransferModal(fromAccountId) {
        const modal = document.getElementById('modal-internal-transfer');
        if (!modal) return;
        modal.classList.add('open');

        const fromAcc = firestoreManager.accounts.find(a => a.id === fromAccountId);
        document.getElementById('xfer-from-name').value = fromAcc ? fromAcc.name : '';
        document.getElementById('xfer-from-id').value = fromAccountId;
        document.getElementById('xfer-amount').value = '';

        // Populate destination dropdown
        const destSelect = document.getElementById('xfer-to');
        destSelect.innerHTML = '<option value="">Seleccionar cuenta...</option>';
        firestoreManager.accounts.filter(a => a.id !== fromAccountId).forEach(a => {
            destSelect.innerHTML += `<option value="${a.id}">${a.name} (${utils.formatCurrency(a.balance)})</option>`;
        });

        // Close button
        const closeBtn = document.getElementById('close-transfer-modal');
        if (closeBtn && !closeBtn.dataset.bound) {
            closeBtn.dataset.bound = 'true';
            closeBtn.addEventListener('click', () => modal.classList.remove('open'));
        }

        // Click outside to close
        if (!modal.dataset.bound) {
            modal.dataset.bound = 'true';
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('open');
            });
        }

        // Execute button
        const execBtn = document.getElementById('btn-exec-transfer');
        if (execBtn && !execBtn.dataset.bound) {
            execBtn.dataset.bound = 'true';
            execBtn.addEventListener('click', () => this.handleInternalTransfer());
        }
    }

    async handleInternalTransfer() {
        const user = auth.currentUser;
        if (!user) return;

        const fromId = document.getElementById('xfer-from-id').value;
        const toId = document.getElementById('xfer-to').value;
        const amount = parseFloat(document.getElementById('xfer-amount').value);

        if (!toId) { this.showToast('Selecciona destino'); return; }
        if (!amount || amount <= 0) { this.showToast('Cantidad inválida'); return; }

        try {
            await firestoreManager.internalTransfer(user, fromId, toId, amount);
            this.showToast('Traspaso realizado 🔄');
            document.getElementById('modal-internal-transfer').classList.remove('open');
        } catch (err) {
            console.error(err);
            this.showToast(err.message || 'Error en traspaso');
        }
    }

    populateAccountSelector() {
        const select = document.getElementById('t-account');
        if (!select) return;
        const main = firestoreManager.getMainAccount();
        select.innerHTML = '';
        firestoreManager.accounts.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = `${a.name} (${utils.formatCurrency(a.balance)})`;
            if (main && a.id === main.id) opt.selected = true;
            select.appendChild(opt);
        });
    }

    // ==========================================
    // P2P TRANSFERS VIEW
    // ==========================================
    initTransfers() {
        const user = auth.currentUser;
        if (!user) return;

        // Initialize Balance (Welcome Bonus Check)
        firestoreManager.initUserBalance(user);

        // Listen to Live Balance
        if (this.balanceUnsubscribe) this.balanceUnsubscribe();
        this.balanceUnsubscribe = firestoreManager.listenToBalance(user, (balance) => {
            const el = document.getElementById('transfer-balance');
            if (el) el.textContent = utils.formatCurrency(balance);
        });

        // Bind Send Button (One-time binding)
        const sendBtn = document.getElementById('btn-send-money');
        if (sendBtn && !sendBtn.dataset.bound) {
            sendBtn.dataset.bound = 'true';
            sendBtn.addEventListener('click', () => this.handleSendMoney());
        }

        this.loadTransferHistory(user);
    }

    async handleSendMoney() {
        const user = auth.currentUser;
        if (!user) return;

        const emailInput = document.getElementById('transfer-email');
        const amountInput = document.getElementById('transfer-amount');
        const subjectInput = document.getElementById('transfer-subject');
        const btn = document.getElementById('btn-send-money');

        const email = emailInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const subject = subjectInput ? subjectInput.value.trim() : '';

        if (!email || !utils.validateEmail(email)) {
            this.showToast('Email inválido');
            return;
        }
        if (!amount || amount <= 0) {
            this.showToast('Cantidad inválida');
            return;
        }

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Enviando...';

            await firestoreManager.sendMoney(user, email, amount, subject);

            this.showToast('¡Envío Exitoso! 💸');

            // Reset Form
            emailInput.value = '';
            amountInput.value = '';
            if (subjectInput) subjectInput.value = '';

            // Refresh History
            this.loadTransferHistory(user);

        } catch (error) {
            console.error(error);
            this.showToast(error.message || 'Error al enviar');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-currency-eur"></i> Enviar Dinero Ahora';
        }
    }

    loadTransferHistory(user) {
        // We reuse the firestore transactions, filtering for transfers
        const list = document.getElementById('transfers-list');
        if (!list) return;

        // Filter: isTransfer property or Category name check
        const transfers = firestoreManager.transactions.filter(t =>
            t.category.includes('Transferencia') || t.isTransfer
        );

        if (transfers.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-clock-counter-clockwise"></i>
                    <p>No hay transferencias recientes</p>
                </div>`;
            return;
        }

        list.innerHTML = '';
        transfers.slice(0, 10).forEach(t => {
            const isSent = t.type === 'expense';
            const item = document.createElement('div');
            item.className = 'transfer-item';
            item.innerHTML = `
                <div class="transfer-info">
                    <span class="transfer-user">${t.description || (isSent ? 'A: Desconocido' : 'De: Desconocido')}</span>
                    <span class="transfer-date">${utils.formatDate(t.date)}</span>
                </div>
                <span class="transfer-amount ${isSent ? 'amount-sent' : 'amount-received'}">
                    ${isSent ? '-' : '+'} ${utils.formatCurrency(t.amount)}
                </span>
            `;
            list.appendChild(item);
        });
    }

    // Analysis Screen Logic
    loadAnalysis() {
        const transactions = firestoreManager.transactions;
        const emptyEl = document.getElementById('analysis-empty');
        const contentEl = document.getElementById('analysis-content');

        // Filter expenses only (exclude income)
        const expenses = transactions.filter(t => t.type === 'expense');

        // Filter for current month
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthlyExpenses = expenses.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        // Handle empty state
        if (monthlyExpenses.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            if (contentEl) contentEl.style.display = 'none';
            return;
        }

        if (emptyEl) emptyEl.classList.add('hidden');
        if (contentEl) contentEl.style.display = 'flex';

        // Calculate KPIs
        let total = 0;
        const categoryTotals = {};

        monthlyExpenses.forEach(t => {
            total += t.amount;
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        });

        // Find top category
        let topCategory = '--';
        let maxAmount = 0;
        for (const cat in categoryTotals) {
            if (categoryTotals[cat] > maxAmount) {
                maxAmount = categoryTotals[cat];
                topCategory = cat;
            }
        }

        // Daily average (days elapsed in month)
        const dayOfMonth = now.getDate();
        const dailyAvg = total / dayOfMonth;

        // Update KPI DOM
        document.getElementById('kpi-total').textContent = `€${total.toFixed(2)}`;
        document.getElementById('kpi-top').textContent = topCategory;
        document.getElementById('kpi-avg').textContent = `€${dailyAvg.toFixed(2)}`;

        // Chart.js Doughnut
        const ctx = document.getElementById('expenseChart');
        if (!ctx) return;

        const chartLabels = Object.keys(categoryTotals);
        const chartData = Object.values(categoryTotals);

        // Color palette matching app theme
        const chartColors = [
            '#059669', // Emerald
            '#6366F1', // Indigo
            '#F59E0B', // Amber
            '#EC4899', // Pink
            '#8B5CF6', // Violet
            '#10B981'  // Teal
        ];

        // Destroy existing chart if any
        if (this.expenseChart) {
            this.expenseChart.destroy();
        }

        this.expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: chartColors.slice(0, chartLabels.length),
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        align: 'center',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            color: '#FFFFFF',
                            font: {
                                size: 13,
                                weight: '600',
                                family: "'Outfit', sans-serif"
                            },
                            boxWidth: 12,
                            boxHeight: 12
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        cornerRadius: 10,
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                const percent = ((value / total) * 100).toFixed(1);
                                return ` €${value.toFixed(2)} (${percent}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Store data for PDF export
        this.analysisData = { total, topCategory, dailyAvg, categoryTotals, monthlyExpenses };
    }

    // PDF Export Function (Bank Statement Style)
    exportAnalysisPDF() {
        const transactions = firestoreManager.transactions;

        if (!transactions || transactions.length === 0) {
            alert('No hay movimientos para exportar.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const now = new Date();
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const currentMonthName = monthNames[now.getMonth()];
        const currentYear = now.getFullYear();

        // ===== CORPORATE HEADER =====
        // Logo/Brand Name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(28);
        doc.setTextColor(15, 23, 42); // Dark blue
        doc.text('VELUT', 20, 25);

        // Tagline
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Finance App', 20, 32);

        // User info (right side)
        doc.setFontSize(10);
        doc.setTextColor(60);
        const userName = auth.currentUser?.displayName || 'Usuario';
        doc.text(`Cliente: ${userName}`, 140, 20, { align: 'left' });
        doc.text(`Fecha de emisión: ${now.toLocaleDateString('es-ES')}`, 140, 26, { align: 'left' });
        doc.text(`Período: ${currentMonthName} ${currentYear}`, 140, 32, { align: 'left' });

        // Separator line
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.5);
        doc.line(20, 40, 190, 40);

        // ===== EXTRACTO DE MOVIMIENTOS TITLE =====
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('EXTRACTO DE MOVIMIENTOS', 20, 52);

        // ===== TRANSACTIONS TABLE =====
        // Prepare table data
        const tableData = transactions.map(t => {
            const date = new Date(t.date).toLocaleDateString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
            const tipo = t.type === 'income' ? 'INGRESO' : 'GASTO';
            const signo = t.type === 'income' ? '+' : '-';
            const importe = `${signo} €${t.amount.toFixed(2)}`;
            return [date, t.category || 'Sin categoría', tipo, importe];
        });

        doc.autoTable({
            startY: 58,
            head: [['FECHA', 'CATEGORÍA', 'TIPO', 'IMPORTE']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'left'
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [40, 40, 40]
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 60 },
                2: { cellWidth: 30, halign: 'center' },
                3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
            },
            styles: {
                cellPadding: 4,
                lineColor: [200, 200, 200],
                lineWidth: 0.1
            },
            margin: { left: 20, right: 20 }
        });

        // ===== BALANCE TOTAL =====
        let balance = 0;
        transactions.forEach(t => {
            if (t.type === 'income') balance += t.amount;
            else balance -= t.amount;
        });

        const finalY = doc.lastAutoTable.finalY + 15;

        // Balance box
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(120, finalY - 5, 70, 18, 3, 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('SALDO TOTAL:', 125, finalY + 5);

        const balanceText = `€${balance.toFixed(2)}`;
        const balanceColor = balance >= 0 ? [16, 185, 129] : [239, 68, 68]; // Green or Red
        doc.setTextColor(...balanceColor);
        doc.setFontSize(12);
        doc.text(balanceText, 185, finalY + 5, { align: 'right' });

        // ===== FOOTER =====
        const pageHeight = doc.internal.pageSize.height;

        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        doc.line(20, pageHeight - 25, 190, pageHeight - 25);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Documento generado automáticamente por VELUT App.', 20, pageHeight - 18);
        doc.text('Este extracto no tiene valor fiscal ni legal.', 20, pageHeight - 13);
        doc.text(`© ${currentYear} VELUT Finance`, 190, pageHeight - 13, { align: 'right' });

        // ===== DOWNLOAD =====
        doc.save(`VELUT_Extracto_${currentMonthName}_${currentYear}.pdf`);
    }

    // ===== VOICE INPUT (Web Speech API) =====
    setupVoiceInput() {
        const voiceBtn = document.getElementById('btn-voice');
        if (!voiceBtn) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            voiceBtn.style.display = 'none';
            console.warn('Web Speech API not supported');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = false;
        recognition.interimResults = false;

        voiceBtn.addEventListener('click', () => {
            voiceBtn.classList.add('listening');
            recognition.start();
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            console.log('Voice:', transcript);
            this.processVoiceCommand(transcript);
            this.showToast(`Entendido: "${transcript}"`);
        };

        recognition.onerror = (event) => {
            console.error('Speech error:', event.error);
            voiceBtn.classList.remove('listening');
            this.showToast('Error de reconocimiento de voz');
        };

        recognition.onend = () => {
            voiceBtn.classList.remove('listening');
        };
    }

    processVoiceCommand(text) {
        // Extract amount (numbers)
        const amountMatch = text.match(/(\d+(?:[.,]\d+)?)/);
        if (amountMatch) {
            const amount = parseFloat(amountMatch[1].replace(',', '.'));
            document.getElementById('t-amount').value = amount;
            document.getElementById('keypad-display').textContent = amount;
        }

        // Extract category by keywords
        const categoryMap = {
            'comida': ['supermercado', 'pan', 'comida', 'mercadona', 'restaurante', 'cena', 'almuerzo', 'desayuno'],
            'transporte': ['gasolina', 'uber', 'taxi', 'bus', 'metro', 'tren', 'transporte', 'gasolinera'],
            'ocio': ['cine', 'netflix', 'spotify', 'concierto', 'ocio', 'juego', 'entretenimiento'],
            'salud': ['farmacia', 'médico', 'hospital', 'salud', 'dentista', 'medicina'],
            'hogar': ['luz', 'agua', 'gas', 'alquiler', 'hogar', 'casa', 'internet', 'factura'],
            'ingreso': ['sueldo', 'nómina', 'ingreso', 'transferencia', 'cobro', 'pago recibido']
        };

        let foundCategory = null;
        for (const [category, keywords] of Object.entries(categoryMap)) {
            if (keywords.some(k => text.includes(k))) {
                foundCategory = category.charAt(0).toUpperCase() + category.slice(1);
                break;
            }
        }

        if (foundCategory) {
            document.getElementById('t-category').value = foundCategory;
            // Update chip selection
            document.querySelectorAll('.category-chip').forEach(chip => {
                chip.classList.remove('selected');
                if (chip.getAttribute('data-cat') === foundCategory) {
                    chip.classList.add('selected');
                }
            });
        }
    }

    // ===== EXPENSE MAP (Google Maps iframe) =====
    loadExpenseMap() {
        const container = document.getElementById('map-container');
        const iframe = document.getElementById('gmap-iframe');
        const emptyMsg = document.getElementById('map-empty');
        const locationsList = document.getElementById('map-locations');
        if (!container || !iframe) return;

        // Filter transactions with coordinates
        const geoTransactions = firestoreManager.transactions.filter(t => t.lat && t.lng);

        // Show container always as per user request
        container.style.display = 'block';

        if (geoTransactions.length === 0) {
            if (locationsList) locationsList.style.display = 'none';
            if (emptyMsg) emptyMsg.style.display = 'block';

            // Set default view (Madrid) if no transactions
            if (!iframe.src || iframe.src === 'about:blank' || iframe.src === '') {
                iframe.src = `https://maps.google.com/maps?q=40.4168,-3.7038&z=5&output=embed`;
            }
            return;
        }

        container.style.display = 'block';
        if (emptyMsg) emptyMsg.style.display = 'none';
        if (locationsList) locationsList.style.display = 'flex';

        // Show most recent transaction marker on map
        this.showMapMarker(geoTransactions[0].lat, geoTransactions[0].lng);

        // Render clickable location list
        if (locationsList) {
            locationsList.innerHTML = '';
            geoTransactions.forEach((t, i) => {
                const date = new Date(t.date).toLocaleDateString('es-ES');
                const item = document.createElement('div');
                item.className = 'map-location-item';
                if (i === 0) item.classList.add('map-location-active');
                item.innerHTML = `
                    <div class="map-loc-info">
                        <i class="ph ph-map-pin"></i>
                        <div>
                            <div class="map-loc-category">${t.category}</div>
                            <div class="map-loc-date">${date}</div>
                        </div>
                    </div>
                    <span class="map-loc-amount ${t.type === 'income' ? 'income' : 'expense'}">
                        ${t.type === 'income' ? '+' : '-'}${utils.formatCurrency(t.amount)}
                    </span>
                `;
                item.addEventListener('click', () => {
                    // Highlight active item
                    locationsList.querySelectorAll('.map-location-item').forEach(el => el.classList.remove('map-location-active'));
                    item.classList.add('map-location-active');
                    this.showMapMarker(t.lat, t.lng);
                });
                locationsList.appendChild(item);
            });
        }
    }

    showMapMarker(lat, lng) {
        const iframe = document.getElementById('gmap-iframe');
        if (!iframe) return;
        // q=lat,lng places a red marker pin at the coordinates
        iframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
    }

    // ===== CRYPTO TICKER (CoinGecko API) =====
    async initCryptoTicker() {
        const track = document.getElementById('ticker-track');
        if (!track || this.tickerLoaded) return;

        try {
            const response = await fetch(
                'https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=10&page=1&sparkline=false'
            );
            const coins = await response.json();

            // Build ticker HTML
            let html = '';
            coins.forEach(coin => {
                const change = coin.price_change_percentage_24h || 0;
                const changeClass = change >= 0 ? 'up' : 'down';
                const changeSign = change >= 0 ? '+' : '';

                html += `
                    <div class="ticker-item">
                        <img src="${coin.image}" alt="${coin.name}">
                        <span class="ticker-symbol">${coin.symbol.toUpperCase()}</span>
                        <span class="ticker-price">€${coin.current_price.toLocaleString('es-ES')}</span>
                        <span class="ticker-change ${changeClass}">${changeSign}${change.toFixed(2)}%</span>
                    </div>
                `;
            });

            // Duplicate for seamless loop
            track.innerHTML = html + html;
            this.tickerLoaded = true;

        } catch (err) {
            console.error('CoinGecko error:', err);
            track.innerHTML = '<span class="ticker-loading">Error al cargar datos</span>';
        }
    }

    // ===== CURRENCY CONVERTER (Frankfurter API) =====
    initCurrencyConverter() {
        if (this.converterInitialized) return;
        this.converterInitialized = true;

        // Currency map with flags and names
        const CURRENCIES = {
            'EUR': { flag: '🇪🇺', name: 'Euro' },
            'USD': { flag: '🇺🇸', name: 'Dólar USA' },
            'GBP': { flag: '🇬🇧', name: 'Libra Esterlina' },
            'JPY': { flag: '🇯🇵', name: 'Yen Japonés' },
            'MXN': { flag: '🇲🇽', name: 'Peso Mexicano' },
            'CHF': { flag: '🇨🇭', name: 'Franco Suizo' },
            'CAD': { flag: '🇨🇦', name: 'Dólar Canadiense' },
            'AUD': { flag: '🇦🇺', name: 'Dólar Australiano' }
        };

        const amountInput = document.getElementById('fx-amount');
        const fromSelect = document.getElementById('fx-from');
        const toSelect = document.getElementById('fx-to');
        const swapBtn = document.getElementById('fx-swap');
        const resultEl = document.getElementById('fx-result');

        if (!amountInput || !fromSelect || !toSelect || !resultEl) return;

        // Populate selects with flags
        const populateSelect = (select, defaultVal) => {
            select.innerHTML = '';
            Object.entries(CURRENCIES).forEach(([code, { flag, name }]) => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = `${flag} ${name}`;
                if (code === defaultVal) option.selected = true;
                select.appendChild(option);
            });
        };

        populateSelect(fromSelect, 'EUR');
        populateSelect(toSelect, 'USD');

        let debounceTimer;

        const convert = async () => {
            const amount = parseFloat(amountInput.value) || 1;
            const from = fromSelect.value;
            const to = toSelect.value;

            if (from === to) {
                resultEl.textContent = `${amount.toFixed(2)} ${to}`;
                return;
            }

            try {
                resultEl.textContent = '...';
                const response = await fetch(
                    `https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`
                );
                const data = await response.json();

                if (data.rates && data.rates[to]) {
                    const result = data.rates[to].toFixed(2);
                    resultEl.textContent = `${result} ${to}`;
                }
            } catch (err) {
                console.error('Frankfurter error:', err);
                resultEl.textContent = 'Error';
            }
        };

        const debouncedConvert = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(convert, 500);
        };

        // Event listeners
        amountInput.addEventListener('input', debouncedConvert);
        fromSelect.addEventListener('change', convert);
        toSelect.addEventListener('change', convert);

        swapBtn.addEventListener('click', () => {
            const temp = fromSelect.value;
            fromSelect.value = toSelect.value;
            toSelect.value = temp;
            convert();
        });

        // Initial conversion
        convert();
    }

    // ===== BIG TECH STOCKS (Finnhub API with Fallback) =====
    async loadStocks() {
        const grid = document.getElementById('stocks-grid');
        if (!grid || this.stocksLoaded) return;

        const FINNHUB_KEY = 'sand_c1s0qfiad3i891000000';
        const STOCKS = [
            { symbol: 'AAPL', name: 'Apple', minPrice: 180, maxPrice: 195 },
            { symbol: 'TSLA', name: 'Tesla', minPrice: 210, maxPrice: 230 },
            { symbol: 'AMZN', name: 'Amazon', minPrice: 140, maxPrice: 160 }
        ];

        // Helper for random fallback
        const getRandomPrice = (min, max) => {
            return (Math.random() * (max - min) + min).toFixed(2);
        };
        const getRandomChange = () => {
            return ((Math.random() - 0.5) * 6).toFixed(2); // -3% to +3%
        };

        let html = '';

        for (const stock of STOCKS) {
            let price = 0;
            let changePercent = 0;

            try {
                const response = await fetch(
                    `https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${FINNHUB_KEY}`
                );
                const data = await response.json();

                // Use real data ONLY if valid
                if (data.c && data.c > 0) {
                    price = data.c;
                    changePercent = data.dp || 0;
                }
            } catch (e) {
                console.warn(`Finnhub failed for ${stock.symbol}, using fallback`);
            }

            // FALLBACK: If price is 0 or null, generate realistic mock
            if (!price || price === 0) {
                price = parseFloat(getRandomPrice(stock.minPrice, stock.maxPrice));
                changePercent = parseFloat(getRandomChange());
            }

            const changeClass = changePercent >= 0 ? 'up' : 'down';
            const changeSign = changePercent >= 0 ? '+' : '';

            html += `
                <div class="stock-item">
                    <div class="stock-symbol">${stock.symbol}</div>
                    <div class="stock-price">$${price.toFixed(2)}</div>
                    <span class="stock-change ${changeClass}">${changeSign}${changePercent.toFixed(2)}%</span>
                </div>
            `;
        }

        grid.innerHTML = html;
        this.stocksLoaded = true;
    }

    // ===== PROFILE SCREEN =====
    initProfile() {
        // Get user from imported auth module
        const user = auth.currentUser;

        const nameEl = document.getElementById('profile-name');
        const emailEl = document.getElementById('profile-email');
        const qrEl = document.getElementById('profile-qr');

        if (user) {
            const userName = user.displayName || user.email?.split('@')[0] || 'Usuario';
            const userEmail = user.email || 'sin-correo';

            if (nameEl) nameEl.textContent = userName;
            if (emailEl) emailEl.textContent = userEmail;

            // Generate QR Code with email
            if (qrEl) {
                qrEl.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(userEmail);
            }
        } else {
            if (nameEl) nameEl.textContent = 'No conectado';
            if (emailEl) emailEl.textContent = 'Inicia sesión';
        }

        // Load dark mode state for toggle
        const darkModeToggle = document.getElementById('toggle-darkmode');
        if (darkModeToggle) {
            darkModeToggle.checked = localStorage.getItem('theme') === 'dark';
        }
    }

    exportUserData() {
        // Get user from imported auth module
        const user = auth.currentUser;

        if (!user) {
            this.showToast('Debes iniciar sesión');
            return;
        }

        try {
            // Get transactions
            const transactions = firestoreManager.transactions || [];

            const exportData = {
                exportDate: new Date().toISOString(),
                user: {
                    email: user.email,
                    displayName: user.displayName || 'Usuario',
                    uid: user.uid
                },
                totalTransactions: transactions.length,
                transactions: transactions
            };

            // Create and trigger download
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = 'backup_velut.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            this.showToast('✅ Datos exportados correctamente');
        } catch (err) {
            console.error('Export error:', err);
            this.showToast('Error al exportar');
        }
    }

    // ===== BARCODE SCANNER (html5-qrcode + OpenFoodFacts) =====
    initBarcodeScanner() {
        const barcodeBtn = document.getElementById('btn-barcode');
        const readerEl = document.getElementById('barcode-reader');
        if (!barcodeBtn || !readerEl) return;

        let html5QrCode = null;
        let isScanning = false;

        barcodeBtn.addEventListener('click', async () => {
            if (isScanning) {
                // Stop scanning
                if (html5QrCode) {
                    await html5QrCode.stop();
                    html5QrCode = null;
                }
                readerEl.style.display = 'none';
                isScanning = false;
                barcodeBtn.innerHTML = '<i class="ph ph-barcode"></i> Escanear Producto';
                return;
            }

            // Start scanning
            readerEl.style.display = 'block';
            barcodeBtn.innerHTML = '<i class="ph ph-x"></i> Cancelar';
            isScanning = true;

            html5QrCode = new Html5Qrcode('barcode-reader');
            try {
                await html5QrCode.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 100 } },
                    async (decodedText) => {
                        // Barcode detected
                        console.log('Barcode:', decodedText);
                        await html5QrCode.stop();
                        readerEl.style.display = 'none';
                        isScanning = false;
                        barcodeBtn.innerHTML = '<i class="ph ph-barcode"></i> Escanear Producto';

                        // Fetch product from OpenFoodFacts
                        this.fetchProductInfo(decodedText);
                    },
                    (errorMessage) => {
                        // Scanning, no result yet
                    }
                );
            } catch (err) {
                console.error('Camera error:', err);
                readerEl.style.display = 'none';
                isScanning = false;
                barcodeBtn.innerHTML = '<i class="ph ph-barcode"></i> Escanear Producto';
                this.showToast('Error al acceder a la cámara');
            }
        });
    }

    async fetchProductInfo(barcode) {
        try {
            this.showToast('Buscando producto...');
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
            const data = await response.json();

            if (data.status === 1 && data.product) {
                const product = data.product;
                const name = product.product_name || 'Producto desconocido';
                const image = product.image_url || product.image_front_url || '';

                // Update UI
                document.getElementById('t-product-name').value = name;

                const previewEl = document.getElementById('product-preview');
                const imgEl = document.getElementById('product-image');
                const nameEl = document.getElementById('product-name');

                if (image) {
                    imgEl.src = image;
                    previewEl.style.display = 'block';
                }
                nameEl.textContent = name;
                previewEl.style.display = 'block';

                this.showToast(`Producto: ${name}`);
            } else {
                this.showToast('Producto no encontrado');
            }
        } catch (err) {
            console.error('OpenFoodFacts error:', err);
            this.showToast('Error al buscar producto');
        }
    }


    setupModal() {
        const fabMobile = document.getElementById('fab-mobile');
        const fabDesktop = document.getElementById('fab-desktop');
        const backdrop = document.getElementById('modal-backdrop');
        const closeModal = document.getElementById('close-modal');
        const keypad = document.querySelector('.keypad');
        const btnSave = document.getElementById('btn-save');
        const setTodayBtn = document.getElementById('set-today');



        const open = () => {
            document.getElementById('modal-backdrop').classList.add('open');
            // If we are NOT in edit mode (no ID set), reset the form specific for new entry
            if (!this.editTransactionId) {
                this.resetModalForm();
            }
        };

        const close = () => {
            document.getElementById('modal-backdrop').classList.remove('open');
            this.resetModalForm(); // Always reset on close to avoid stale state
            delete this.editTransactionId;
        };

        if (fabMobile) fabMobile.addEventListener('click', open);
        if (fabDesktop) fabDesktop.addEventListener('click', open);
        if (closeModal) closeModal.addEventListener('click', close);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

        if (setTodayBtn) {
            setTodayBtn.addEventListener('click', () => {
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                document.getElementById('t-date').value = now.toISOString().slice(0, 16);
            });
        }

        // Preview & AI Scan Handlers
        document.getElementById('t-image').addEventListener('change', (e) => {
            const span = document.getElementById('t-filename');
            span.textContent = e.target.files[0] ? e.target.files[0].name : '';
        });



        keypad.addEventListener('click', (e) => {
            const target = e.target.closest('.key');
            if (!target) return;
            const key = target.getAttribute('data-key');
            if (key !== 'save') {
                this.processInput(key);
            } else {
                this.handleSaveAction(close);
            }
        });

        if (btnSave) {
            btnSave.addEventListener('click', () => this.handleSaveAction(close));
        }

        document.querySelectorAll('.category-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                document.getElementById('t-category').value = chip.getAttribute('data-cat');
            });
        });

        window.closeModal = close;
        window.handleSaveAction = this.handleSaveAction.bind(this);
    }

    resetModalForm() {
        // Clear Edit Mode
        delete this.editTransactionId;
        delete this.originalEditData;

        this.updateDisplay('0');
        document.getElementById('t-amount').value = '0';
        document.getElementById('t-image').value = '';
        document.getElementById('t-filename').textContent = '';

        // Reset Account Selector to Main
        const mainAcc = firestoreManager.accounts.find(a => a.isMain);
        /*
          The account selector logic is likely handled in populateAccountSelector
          or HTML default, but we ensure it resets here if needed.
          For now, just letting default behavior or specific populate call handle it.
        */
        const accSelect = document.getElementById('t-account');
        if (accSelect && mainAcc) accSelect.value = mainAcc.id;

        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('t-date').value = now.toISOString().slice(0, 16);

        const btn = document.getElementById('btn-save');
        if (btn) {
            btn.innerHTML = '<i class="ph ph-check"></i> Guardar';
            btn.classList.remove('btn-warning'); // Remove edit style if any
        }
    }

    // ===== EDIT TRANSACTION UI =====
    editTransaction(id) {
        const tx = firestoreManager.transactions.find(t => t.id === id);
        if (!tx) return;

        this.editTransactionId = id;
        this.originalEditData = { ...tx }; // Keep original to check for restricted changes

        // Populate Modal
        document.getElementById('t-amount').value = tx.amount;
        this.updateDisplay(tx.amount.toString());

        // Date format for datetime-local
        const d = new Date(tx.date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        document.getElementById('t-date').value = d.toISOString().slice(0, 16);

        // Account
        const accSelect = document.getElementById('t-account');
        if (accSelect) accSelect.value = tx.accountId;

        // Category (Chips)
        const chip = document.querySelector(`.category-chip[data-cat="${tx.category}"]`);
        if (chip) chip.click();

        // Button State
        const btn = document.getElementById('btn-save');
        if (btn) {
            btn.innerHTML = '<i class="ph ph-pencil"></i> Actualizar Movimiento';
        }

        // Open Modal
        document.getElementById('modal-backdrop').classList.add('open');
    }

    // ===== TRANSACTION CONTEXT MENU =====
    toggleTxMenu(id) {
        // Close all other menus and reset z-index
        document.querySelectorAll('.tx-context-menu').forEach(el => {
            if (el.id !== `menu-${id}`) el.style.display = 'none';
        });
        document.querySelectorAll('.t-item').forEach(el => el.classList.remove('z-active'));

        const menu = document.getElementById(`menu-${id}`);
        if (menu) {
            const isOpening = menu.style.display !== 'block';
            menu.style.display = isOpening ? 'block' : 'none';

            if (isOpening) {
                // Raise z-index of the row so menu appears on top of subsequent rows
                const item = menu.closest('.t-item');
                if (item) item.classList.add('z-active');
            }
        }
    }

    closeAllMenus() {
        document.querySelectorAll('.tx-context-menu').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.t-item').forEach(el => el.classList.remove('z-active'));
    }

    // ===== TRANSACTION DETAIL VIEW =====
    showTransactionDetail(id) {
        const t = firestoreManager.transactions.find(tx => tx.id === id);
        if (!t) return;

        const body = document.getElementById('tx-detail-body');
        if (!body) return;

        const sign = t.type === 'income' ? '+' : '-';
        const amountClass = t.type === 'income' ? 'income' : 'expense';

        // Find account name
        const account = firestoreManager.accounts.find(a => a.id === t.accountId);
        const accountName = account ? account.name : (t.isTransfer ? 'Transferencia P2P' : 'Sin cuenta');

        let html = '';

        // Amount header
        html += `<div class="tx-detail-amount ${amountClass}">${sign} ${utils.formatCurrency(t.amount)}</div>`;

        // Category
        html += `
            <div class="tx-detail-row">
                <span class="tx-detail-label"><i class="ph ph-tag"></i> Categoría</span>
                <span class="tx-detail-value">${t.category}</span>
            </div>`;

        // Date
        html += `
            <div class="tx-detail-row">
                <span class="tx-detail-label"><i class="ph ph-calendar"></i> Fecha</span>
                <span class="tx-detail-value">${utils.formatDate(t.date)}</span>
            </div>`;

        // Account
        html += `
            <div class="tx-detail-row">
                <span class="tx-detail-label"><i class="ph ph-wallet"></i> Cuenta</span>
                <span class="tx-detail-value">${accountName}</span>
            </div>`;

        // Type
        html += `
            <div class="tx-detail-row">
                <span class="tx-detail-label"><i class="ph ph-arrows-down-up"></i> Tipo</span>
                <span class="tx-detail-value">${t.type === 'income' ? 'Ingreso' : (t.type === 'transfer' ? 'Traspaso' : 'Gasto')}</span>
            </div>`;

        // Transfer-specific: Description (A: / De:)
        if (t.isTransfer && t.description) {
            html += `
                <div class="tx-detail-row">
                    <span class="tx-detail-label"><i class="ph ph-user"></i> Destinatario</span>
                    <span class="tx-detail-value">${t.description}</span>
                </div>`;
        }

        // Transfer Subject
        if (t.isTransfer && t.subject) {
            html += `
                <div class="tx-detail-subject">
                    <div class="tx-detail-label"><i class="ph ph-chat-text"></i> Asunto</div>
                    <div class="tx-detail-value">${t.subject}</div>
                </div>`;
        }

        // Ticket/Image
        if (t.ticketUrl || t.imageUrl) {
            html += `
                <div class="tx-detail-row">
                    <span class="tx-detail-label"><i class="ph ph-image"></i> Ticket</span>
                    <span class="tx-detail-value"><a href="${t.ticketUrl || t.imageUrl}" target="_blank" style="color:var(--accent-primary)">Ver imagen</a></span>
                </div>`;
        }

        // Hidden status
        if (t.hidden) {
            html += `
                <div class="tx-detail-row">
                    <span class="tx-detail-label"><i class="ph ph-eye-slash"></i> Estado</span>
                    <span class="tx-detail-value" style="color: var(--text-muted)">Oculto</span>
                </div>`;
        }

        // Location Map
        if (t.lat && t.lng) {
            html += `
                <div class="tx-detail-row">
                    <span class="tx-detail-label"><i class="ph ph-map-pin"></i> Ubicación</span>
                    <span class="tx-detail-value">${t.lat.toFixed(4)}, ${t.lng.toFixed(4)}</span>
                </div>
                <div class="tx-detail-map">
                    <iframe src="https://maps.google.com/maps?q=${t.lat},${t.lng}&z=15&output=embed"></iframe>
                </div>`;
        }

        body.innerHTML = html;
        document.getElementById('tx-detail-modal').classList.add('open');
    }

    // ===== HIDE/UNHIDE TRANSACTION =====
    async toggleTransactionVisibility_OLD_UNUSED(id, hide) {
        // If hiding, ask for confirmation (since it affects balance)
        if (hide && !confirm('¿Ocultar este movimiento? Se revertirá su impacto en el saldo.')) return;

        try {
            const user = auth.currentUser;
            if (!user) return;

            // We need amount/type/accountId to adjust balance. 
            // Finding them from local list is easiest.
            const tx = firestoreManager.transactions.find(t => t.id === id);
            if (!tx) return;

            await firestoreManager.toggleTransactionVisibility(user, id, tx.accountId, tx.amount, tx.type, hide);

            this.showToast(hide ? 'Movimiento ocultado 👁️‍🗨️' : 'Movimiento restaurado 👁️');
            this.closeAllMenus();
        } catch (error) {
            console.error("Error toggling visibility: ", error);
            this.showToast('Error al actualizar');
        }
    }

    async handleSaveAction(closeCallback) {
        const btn = document.getElementById('btn-save');
        const amount = parseFloat(document.getElementById('t-amount').value);
        const category = document.getElementById('t-category').value;
        const dateStr = document.getElementById('t-date').value;
        const accountId = document.getElementById('t-account').value;

        if (!amount || amount <= 0) {
            alert('Por favor, ingresa un monto válido.');
            return;
        }

        // --- UPDATE MODE ---
        if (this.editTransactionId) {
            const user = auth.currentUser;
            if (btn) btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Actualizando...';

            try {
                // Determine type based on category
                const type = category === 'Ingreso' ? 'income' : 'expense';

                await firestoreManager.updateTransaction(user, this.editTransactionId, {
                    category,
                    date: dateStr,
                    amount,
                    accountId,
                    type
                });

                this.showToast('Movimiento actualizado ✏️');
                if (closeCallback) closeCallback();
                this.resetModalForm();
            } catch (e) {
                console.error(e);
                alert('Error al actualizar: ' + e.message);
                if (btn) btn.innerHTML = '<i class="ph ph-pencil"></i> Actualizar Movimiento';
            }
            return;
        }

        // --- CREATE MODE ---
        if (btn) btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';

        try {
            await firestoreManager.saveTransactionFromSheet();
            this.showToast('Movimiento guardado');
            if (closeCallback) closeCallback();
            this.resetModalForm();
        } catch (error) {
            alert('Error al guardar: ' + error.message);
            if (btn) btn.innerHTML = '<i class="ph ph-check"></i> Guardar';
        }
    }

    handlePhysicalKey(e) {
        const key = e.key;
        if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key)) this.processInput(key);
        else if (key === '.' || key === ',') this.processInput('.');
        else if (key === 'Backspace') this.processInput('backspace');
        else if (key === 'Enter') {
            window.handleSaveAction(window.closeModal);
        }
    }

    processInput(key) {
        const display = document.getElementById('keypad-display');
        const amountInput = document.getElementById('t-amount');
        let currentVal = display.textContent;

        if (key === 'clear') {
            currentVal = '0';
        } else if (key === 'backspace') {
            currentVal = currentVal.length > 1 ? currentVal.slice(0, -1) : '0';
        } else {
            if (currentVal === '0' && key !== '.') currentVal = key;
            else {
                if (key === '.' && currentVal.includes('.')) return;
                if (currentVal.length < 10) currentVal += key;
            }
        }
        this.updateDisplay(currentVal);
        amountInput.value = parseFloat(currentVal);
    }

    updateDisplay(val) {
        document.getElementById('keypad-display').textContent = val;
    }

    showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = msg;
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
        }
    }

    setupBalanceToggle() {
        const toggle = document.getElementById('toggle-balance');
        const amount = document.getElementById('total-balance');
        const icon = toggle ? toggle.querySelector('i') : null;
        let visible = true;
        if (toggle) {
            toggle.addEventListener('click', () => {
                visible = !visible;
                if (visible) {
                    amount.style.filter = 'none';
                    if (icon) icon.className = "ph ph-eye";
                } else {
                    amount.style.filter = 'blur(8px)';
                    if (icon) icon.className = "ph ph-eye-slash";
                }
            });
        }
    }

    handleUserAuthenticated(user) {
        document.getElementById('app-layout').style.display = 'flex';
        document.getElementById('auth-section').style.display = 'none';

        // Initialize Accounts (Creates default if none exist)
        firestoreManager.initAccounts(user);

        // Listen to Accounts (Multi-Account)
        firestoreManager.listenToAccounts(user, (accounts) => {
            // If we're on wallet view, re-render cards
            if (this.currentView === 'wallet') {
                this.renderAccountCards(accounts);
            }
            // Populate account selector for modal
            this.populateAccountSelector();
            // Update product buttons (Ya contratado)
            this.updateProductButtons();
        });

        this.switchView('dashboard');
        const greeting = document.getElementById('greeting');
        if (greeting) greeting.textContent = `${i18n.t('home.greeting')}, ${user.displayName || 'Usuario'}`;

        firestoreManager.loadTransactions(user);
    }

    handleUserSignedOut() {
        document.getElementById('app-layout').style.display = 'none';
        document.getElementById('auth-section').style.display = 'grid';

        // Unsubscribe from updates
        if (firestoreManager.accountsUnsubscribe) firestoreManager.accountsUnsubscribe();
        if (firestoreManager.unsubscribe) firestoreManager.unsubscribe();
    }

    async handleLogout() {
        try {
            await signOut(auth);
            this.showToast('Sesión cerrada');
            // handleUserSignedOut is triggered by onAuthStateChanged
        } catch (error) {
            console.error("Logout Error:", error);
            this.showToast('Error al cerrar sesión');
        }
    }
    // ===== HIDE/UNHIDE TRANSACTION =====
    async toggleTransactionVisibility(id, hide) {
        if (hide) {
            this.showConfirm('¿Ocultar este movimiento?', async () => {
                await this._executeVisibilityToggle(id, hide);
            });
        } else {
            this.showConfirm('¿Mostrar este movimiento?', async () => {
                await this._executeVisibilityToggle(id, hide);
            });
        }
    }

    async _executeVisibilityToggle(id, hide) {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const tx = firestoreManager.transactions.find(t => t.id === id);
            if (!tx) return;

            await firestoreManager.toggleTransactionVisibility(user, id, tx.accountId, tx.amount, tx.type, hide);

            this.showToast(hide ? 'Movimiento ocultado 👁️‍🗨️' : 'Movimiento restaurado 👁️');
            this.closeAllMenus();
        } catch (error) {
            console.error("Error toggling visibility: ", error);
            this.showToast('Error al actualizar');
        }
    }

    // ===== PERMANENT DELETE =====
    deleteTransaction(id) {
        this.showConfirm('¿Eliminar DEFINITIVAMENTE? Esta acción no se puede deshacer.', async () => {
            try {
                const user = auth.currentUser;
                if (!user) return;

                const tx = firestoreManager.transactions.find(t => t.id === id);
                if (!tx) return;

                await firestoreManager.permanentlyDeleteTransaction(user, id, tx.accountId, tx.amount, tx.type, tx.hidden);

                this.showToast('Movimiento eliminado 🗑️');
                this.closeAllMenus();
            } catch (error) {
                console.error("Error deleting: ", error);
                this.showToast('Error al eliminar');
            }
        });
    }

    // ===== SHOW HIDDEN TOGGLE =====
    toggleShowHidden(checked) {
        firestoreManager.showHidden = checked;
        firestoreManager.renderRecentTransactions();
    }

    // ===== CUSTOM CONFIRM MODAL =====
    showConfirm(msg, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        if (modal && msgEl) {
            msgEl.textContent = msg;
            modal.classList.add('open');

            const btn = document.getElementById('btn-confirm-yes');
            if (btn) {
                // Clone to remove old listeners
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', () => {
                    onConfirm();
                    this.closeConfirmModal();
                });
            }
        }
    }

    closeConfirmModal() {
        const modal = document.getElementById('confirm-modal');
        if (modal) modal.classList.remove('open');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();

    // Close menus on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.t-menu-container')) {
            window.app.closeAllMenus();
        }
    });
});
