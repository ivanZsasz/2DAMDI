import { db, storage, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    deleteDoc,
    doc,
    runTransaction,
    getDocs,
    setDoc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { utils } from './utils.js';

export const firestoreManager = {
    transactions: [],
    accounts: [],
    accountsUnsubscribe: null,
    unsubscribe: null,
    showHidden: false, // Default hidden

    init: () => { },

    saveTransactionFromSheet: async () => {
        const user = auth.currentUser;
        if (!user) throw new Error("Usuario no autenticado");

        const amountEl = document.getElementById('t-amount');
        const categoryEl = document.getElementById('t-category');
        const imageEl = document.getElementById('t-image');
        const dateEl = document.getElementById('t-date');

        const amount = parseFloat(amountEl.value);
        const category = categoryEl.value;
        const imageFile = imageEl.files ? imageEl.files[0] : null;
        const dateVal = dateEl.value;

        if (!amount || amount <= 0) throw new Error("Monto inválido");
        if (!category) throw new Error("Categoría requerida");

        const type = category === 'Ingreso' ? 'income' : 'expense';
        let ticketUrl = null;

        // Try Upload with Safe Fail
        if (imageFile) {
            try {
                // Create a race between upload and a 5s timeout
                const uploadPromise = async () => {
                    const storageRef = ref(storage, `tickets/${user.uid}/${Date.now()}_${imageFile.name}`);
                    await uploadBytes(storageRef, imageFile);
                    return await getDownloadURL(storageRef);
                };

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout subiendo imagen")), 5000)
                );

                ticketUrl = await Promise.race([uploadPromise(), timeoutPromise]);
            } catch (e) {
                console.warn("Image upload failed/timed out, saving without image:", e);
                // We proceed without ticketUrl, so the user data is not lost
            }
        }

        const txDate = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();

        // Silently capture geolocation
        let lat = null;
        let lng = null;
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 3000,
                    enableHighAccuracy: false
                });
            });
            lat = position.coords.latitude;
            lng = position.coords.longitude;
        } catch (geoError) {
            console.warn("Geolocation not available:", geoError.message);
        }

        // Get selected account ID from modal
        const accountSelect = document.getElementById('t-account');
        const accountId = accountSelect ? accountSelect.value : null;

        await addDoc(collection(db, "transactions"), {
            userId: user.uid,
            amount,
            type,
            category,
            date: txDate,
            ticketUrl,
            lat,
            lng,
            accountId: accountId || null,
            createdAt: Date.now()
        });

        // Debit/Credit from the selected account
        if (accountId) {
            const accRef = doc(db, "users", user.uid, "accounts", accountId);
            await runTransaction(db, async (transaction) => {
                const accSnap = await transaction.get(accRef);
                if (!accSnap.exists()) return;
                const current = accSnap.data().balance || 0;
                const delta = type === 'income' ? amount : -amount;
                transaction.update(accRef, { balance: current + delta });
            });
        }

        return "Success";
    },

    updateTransaction: async (user, txId, newData) => {
        const txRef = doc(db, "transactions", txId);

        await runTransaction(db, async (transaction) => {
            const txSnap = await transaction.get(txRef);
            if (!txSnap.exists()) throw new Error("Transaction not found");

            const oldTx = txSnap.data();

            const oldAmount = oldTx.amount;
            const newAmount = newData.amount !== undefined ? newData.amount : oldAmount;

            const oldType = oldTx.type;
            const newType = newData.type !== undefined ? newData.type : oldType;

            const oldAccountId = oldTx.accountId;
            const newAccountId = newData.hasOwnProperty('accountId') ? newData.accountId : oldAccountId;

            const needsBalanceUpdate = (oldAmount !== newAmount) || (oldType !== newType) || (oldAccountId !== newAccountId);

            if (needsBalanceUpdate) {
                // CASE 1: SAME ACCOUNT (Calculate NET change to avoid double update conflict)
                if (oldAccountId && newAccountId && oldAccountId === newAccountId) {
                    const accRef = doc(db, "users", user.uid, "accounts", oldAccountId);
                    const accSnap = await transaction.get(accRef);
                    if (accSnap.exists()) {
                        const current = accSnap.data().balance || 0;
                        const oldEffect = oldType === 'income' ? oldAmount : -oldAmount;
                        const newEffect = newType === 'income' ? newAmount : -newAmount;
                        const netChange = newEffect - oldEffect;
                        transaction.update(accRef, { balance: current + netChange });
                    }
                }
                // CASE 2: DIFFERENT ACCOUNTS (or one is null)
                else {
                    // Revert Old
                    if (oldAccountId) {
                        const oldAccRef = doc(db, "users", user.uid, "accounts", oldAccountId);
                        const oldAccSnap = await transaction.get(oldAccRef);
                        if (oldAccSnap.exists()) {
                            const current = oldAccSnap.data().balance || 0;
                            const reversal = oldType === 'income' ? -oldAmount : oldAmount;
                            transaction.update(oldAccRef, { balance: current + reversal });
                        }
                    }
                    // Apply New
                    if (newAccountId) {
                        const newAccRef = doc(db, "users", user.uid, "accounts", newAccountId);
                        const newAccSnap = await transaction.get(newAccRef);
                        if (newAccSnap.exists()) {
                            const current = newAccSnap.data().balance || 0;
                            const apply = newType === 'income' ? newAmount : -newAmount;
                            transaction.update(newAccRef, { balance: current + apply });
                        }
                    }
                }
            }

            // Update Transaction Data
            transaction.update(txRef, newData);
        });
    },

    toggleTransactionVisibility: async (user, txId, accountId, amount, type, hide) => {
        const txRef = doc(db, "transactions", txId);

        await runTransaction(db, async (transaction) => {
            const txSnap = await transaction.get(txRef);
            if (!txSnap.exists()) throw new Error("Transaction not found");

            // Handle Balance Update
            if (accountId) {
                const accRef = doc(db, "users", user.uid, "accounts", accountId);
                const accSnap = await transaction.get(accRef);

                if (accSnap.exists()) {
                    const currentBalance = accSnap.data().balance || 0;
                    let delta = 0;

                    if (hide) {
                        // HIDING = Deleting effect (Reverse balance)
                        // Income hidden -> Remove amount
                        // Expense hidden -> Add amount back
                        delta = type === 'income' ? -amount : amount;
                    } else {
                        // UNHIDING = Creating effect (Re-apply balance)
                        // Income unhidden -> Add amount
                        // Expense unhidden -> Deduct amount
                        delta = type === 'income' ? amount : -amount;
                    }

                    transaction.update(accRef, { balance: currentBalance + delta });
                }
            }
            transaction.update(txRef, { hidden: hide });
        });
    },

    permanentlyDeleteTransaction: async (user, txId, accountId, amount, type, isHidden) => {
        const txRef = doc(db, "transactions", txId);

        await runTransaction(db, async (transaction) => {
            const txSnap = await transaction.get(txRef);
            if (!txSnap.exists()) throw new Error("Transaction not found");

            // If it was NOT hidden, we must reverse the balance before deleting.
            // If it WAS hidden, the balance is already reversed, so we just delete.
            if (!isHidden && accountId) {
                const accRef = doc(db, "users", user.uid, "accounts", accountId);
                const accSnap = await transaction.get(accRef);

                if (accSnap.exists()) {
                    const current = accSnap.data().balance || 0;
                    // Income deleted -> Remove amount
                    // Expense deleted -> Add amount
                    const delta = type === 'income' ? -amount : amount;
                    transaction.update(accRef, { balance: current + delta });
                }
            }

            transaction.delete(txRef);
        });
    },

    loadTransactions: (user) => {
        if (firestoreManager.unsubscribe) firestoreManager.unsubscribe();

        // FIX: Removed 'orderBy' to prevent "Missing Index" error.
        // We will sort in JavaScript instead.
        const q = query(
            collection(db, "transactions"),
            where("userId", "==", user.uid)
        );

        firestoreManager.unsubscribe = onSnapshot(q, (querySnapshot) => {
            firestoreManager.transactions = [];
            querySnapshot.forEach((doc) => {
                firestoreManager.transactions.push({ id: doc.id, ...doc.data() });
            });

            // Client-side Sort (Newest First)
            firestoreManager.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            firestoreManager.renderRecentTransactions();
            firestoreManager.renderRecentTransactions();
            firestoreManager.updateDashboard();
        });
    },

    renderHiddenTransactions: () => {
        const container = document.getElementById('hidden-list');
        const emptyMsg = document.getElementById('hidden-empty');
        if (!container) return;

        const hiddenTxs = firestoreManager.transactions.filter(t => t.hidden === true);

        container.innerHTML = '';
        if (hiddenTxs.length === 0) {
            if (emptyMsg) emptyMsg.style.display = 'block';
        } else {
            if (emptyMsg) emptyMsg.style.display = 'none';
            hiddenTxs.forEach(t => {
                const item = document.createElement('div');
                item.className = 't-item hidden-item';
                item.style.opacity = '0.7';

                item.innerHTML = `
                    <div>
                        <strong>${t.category}</strong> <br>
                        <small>${utils.formatDate(t.date)}</small>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-weight:600;">${utils.formatCurrency(t.amount)}</span>
                        <div onclick="window.app.toggleTransactionVisibility('${t.id}', false)" style="color:var(--accent-primary); cursor:pointer; font-size:0.85rem; margin-top:4px;">
                            <i class="ph ph-eye"></i> Mostrar
                        </div>
                    </div>
                `;
                container.appendChild(item);
            });
        }
    },

    renderRecentTransactions: () => {
        const container = document.getElementById('recent-list');
        const emptyState = document.getElementById('empty-state');
        if (!container || !emptyState) return;

        container.innerHTML = "";

        // Filter based on showHidden Toggle
        const visibleTxs = firestoreManager.transactions.filter(t => firestoreManager.showHidden ? true : !t.hidden);

        if (visibleTxs.length === 0) {
            container.style.display = 'none';
            emptyState.classList.remove('hidden');
        } else {
            container.style.display = 'block';
            emptyState.classList.add('hidden');

            const MAX_ITEMS = firestoreManager.showHidden ? 50 : 10; // Show more if looking at hidden

            visibleTxs.slice(0, MAX_ITEMS).forEach(t => {
                const item = document.createElement('div');
                item.className = 't-item';
                if (t.hidden) item.classList.add('hidden-transaction-item');

                const iconMap = {
                    'Comida': 'ph-hamburger',
                    'Transporte': 'ph-bus',
                    'Ocio': 'ph-film-strip',
                    'Salud': 'ph-heartbeat',
                    'Hogar': 'ph-house-line',
                    'Ingreso': 'ph-money'
                };
                const iconName = iconMap[t.category] || 'ph-receipt';
                const imgLink = t.ticketUrl || t.imageUrl;

                // Amount Color
                const amountColor = t.type === 'income' ? 'var(--success)' : 'var(--text-main)';
                const sign = t.type === 'income' ? '+' : '-';

                // Styles for hidden items
                const itemStyle = t.hidden ? 'opacity: 0.6;' : '';

                item.innerHTML = `
                    <div style="display:flex; align-items:center;">
                        <div class="t-icon-box">
                            <i class="ph ${iconName}"></i>
                        </div>
                        <div>
                            <strong style="color:var(--text-main)">${t.category} ${t.hidden ? '<i class="ph-fill ph-eye-slash" style="font-size:0.8em; margin-left:4px;"></i>' : ''}</strong> <br>
                            <small style="color:var(--text-muted)">${utils.formatDate(t.date)}</small>
                            ${imgLink ? `<a href="${imgLink}" target="_blank" style="margin-left:5px; color:var(--accent-color)"><i class="ph ph-image"></i></a>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right; display:flex; flex-direction:column; align-items:flex-end; position:relative;">
                        <span style="font-weight:600; font-size:1.1rem; color: ${amountColor}">
                            ${sign} ${utils.formatCurrency(t.amount)}
                        </span>
                        
                        <!-- 3 Dots Menu -->
                        <div class="t-menu-container">
                            <button class="btn-icon-menu" onclick="event.stopPropagation(); window.app.toggleTxMenu('${t.id}')">
                                <i class="ph ph-dots-three-vertical"></i>
                            </button>
                            <div id="menu-${t.id}" class="tx-context-menu" style="display:none;">
                                <div onclick="window.app.editTransaction('${t.id}')" class="menu-option">
                                    <i class="ph ph-pencil-simple"></i> Editar
                                </div>
                                <div onclick="window.app.toggleTransactionVisibility('${t.id}', ${!t.hidden})" class="menu-option">
                                    <i class="ph ${t.hidden ? 'ph-eye' : 'ph-eye-slash'}"></i> ${t.hidden ? 'Mostrar' : 'Ocultar'}
                                </div>
                                <div onclick="window.app.deleteTransaction('${t.id}')" class="menu-option delete">
                                    <i class="ph ph-trash"></i> Borrar
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(item);
            });
        }
    },

    updateDashboard: () => {
        // Show MAIN account balance instead of computed total
        const mainAccount = firestoreManager.accounts.find(a => a.isMain);
        const balance = mainAccount ? mainAccount.balance : 0;

        const balanceEl = document.getElementById('total-balance');
        if (!balanceEl) return;
        balanceEl.textContent = utils.formatCurrency(balance);
        if (balance < 0) balanceEl.classList.add('balance-negative');
        else balanceEl.classList.remove('balance-negative');
    },

    deleteTransaction: async (id) => {
        if (confirm("¿Borrar movimiento?")) {
            await deleteDoc(doc(db, "transactions", id));
        }
    },

    // ==========================================
    // MULTI-ACCOUNT (WALLET) LOGIC
    // ==========================================

    initAccounts: async (user) => {
        const accountsRef = collection(db, "users", user.uid, "accounts");
        const snap = await getDocs(accountsRef);

        if (snap.empty) {
            // Create default main account with welcome bonus
            await addDoc(accountsRef, {
                name: 'Cuenta Principal',
                balance: 1000.00,
                type: 'bank',
                isMain: true,
                color: '#1a1a2e',
                createdAt: new Date().toISOString()
            });
        }

        // Also ensure the user doc exists for P2P
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                email: user.email,
                displayName: user.displayName,
                createdAt: new Date().toISOString()
            });
        }
    },

    listenToAccounts: (user, callback) => {
        if (firestoreManager.accountsUnsubscribe) firestoreManager.accountsUnsubscribe();
        const accountsRef = collection(db, "users", user.uid, "accounts");
        firestoreManager.accountsUnsubscribe = onSnapshot(accountsRef, (snapshot) => {
            firestoreManager.accounts = [];
            snapshot.forEach(d => {
                firestoreManager.accounts.push({ id: d.id, ...d.data() });
            });
            callback(firestoreManager.accounts);
            firestoreManager.updateDashboard();
        });
    },

    createAccount: async (user, data) => {
        const accountsRef = collection(db, "users", user.uid, "accounts");
        await addDoc(accountsRef, {
            name: data.name,
            balance: parseFloat(data.balance) || 0,
            type: data.type || 'bank',
            isMain: false,
            color: data.color || '#0f3460',
            createdAt: new Date().toISOString()
        });
    },

    internalTransfer: async (user, fromId, toId, amount) => {
        amount = parseFloat(amount);
        if (!amount || amount <= 0) throw new Error('Cantidad inválida');
        if (fromId === toId) throw new Error('Origen y destino no pueden ser iguales');

        const fromRef = doc(db, "users", user.uid, "accounts", fromId);
        const toRef = doc(db, "users", user.uid, "accounts", toId);

        await runTransaction(db, async (transaction) => {
            const fromSnap = await transaction.get(fromRef);
            const toSnap = await transaction.get(toRef);

            if (!fromSnap.exists() || !toSnap.exists()) throw new Error('Cuenta no encontrada');

            const fromBalance = fromSnap.data().balance || 0;
            if (fromBalance < amount) throw new Error('Saldo insuficiente');

            const toBalance = toSnap.data().balance || 0;

            transaction.update(fromRef, { balance: fromBalance - amount });
            transaction.update(toRef, { balance: toBalance + amount });

            // Neutral record (Traspaso)
            const txRef = doc(collection(db, "transactions"));
            transaction.set(txRef, {
                userId: user.uid,
                amount,
                type: 'transfer',
                category: 'Traspaso',
                description: `${fromSnap.data().name} → ${toSnap.data().name}`,
                date: new Date().toISOString(),
                isTransfer: true,
                isInternal: true
            });
        });
    },

    getMainAccount: () => {
        return firestoreManager.accounts.find(a => a.isMain) || firestoreManager.accounts[0] || null;
    },

    // ==========================================
    // P2P TRANSFERS LOGIC
    // ==========================================

    initUserBalance: async (user) => {
        // P2P uses main account balance now
        const mainAcc = firestoreManager.getMainAccount();
        return mainAcc ? mainAcc.balance : 0;
    },

    listenToBalance: (user, callback) => {
        // Delegate to accounts listener — balance comes from main account
        return onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            const mainAcc = firestoreManager.getMainAccount();
            callback(mainAcc ? mainAcc.balance : 0);
        });
    },

    sendMoney: async (sender, recipientEmail, amount) => {
        amount = parseFloat(amount);
        if (!amount || amount <= 0) throw new Error("Cantidad inválida");
        if (sender.email === recipientEmail) throw new Error("No puedes enviarte dinero a ti mismo");

        const q = query(collection(db, "users"), where("email", "==", recipientEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("El destinatario no existe.");
        }

        const recipientDoc = querySnapshot.docs[0];
        const recipientName = recipientDoc.data().displayName || recipientEmail;

        // Get sender's main account
        const mainAcc = firestoreManager.getMainAccount();
        if (!mainAcc) throw new Error('No tienes cuenta principal');

        const senderAccRef = doc(db, "users", sender.uid, "accounts", mainAcc.id);

        // Find recipient's main account
        const recipientAccountsSnap = await getDocs(collection(db, "users", recipientDoc.id, "accounts"));
        let recipientMainAcc = null;
        recipientAccountsSnap.forEach(d => {
            const data = d.data();
            if (data.isMain || !recipientMainAcc) recipientMainAcc = { id: d.id, ...data };
        });
        if (!recipientMainAcc) throw new Error('El destinatario no tiene cuenta');

        const recipientAccRef = doc(db, "users", recipientDoc.id, "accounts", recipientMainAcc.id);

        await runTransaction(db, async (transaction) => {
            const senderSnap = await transaction.get(senderAccRef);
            if (!senderSnap.exists()) throw new Error('Error de cuenta remitente');

            const currentBalance = senderSnap.data().balance || 0;
            if (currentBalance < amount) throw new Error('Saldo insuficiente');

            const recipientSnap = await transaction.get(recipientAccRef);
            const recipientBalance = recipientSnap.data().balance || 0;

            transaction.update(senderAccRef, { balance: currentBalance - amount });
            transaction.update(recipientAccRef, { balance: recipientBalance + amount });

            const senderTxRef = doc(collection(db, "transactions"));
            const recipientTxRef = doc(collection(db, "transactions"));

            transaction.set(senderTxRef, {
                userId: sender.uid,
                amount,
                type: 'expense',
                category: 'Transferencia Enviada',
                description: `A: ${recipientName}`,
                date: new Date().toISOString(),
                isTransfer: true
            });

            transaction.set(recipientTxRef, {
                userId: recipientDoc.id,
                amount,
                type: 'income',
                category: 'Transferencia Recibida',
                description: `De: ${sender.displayName || sender.email}`,
                date: new Date().toISOString(),
                isTransfer: true
            });
        });

        return true;
    }
};

window.deleteTx = firestoreManager.deleteTransaction;
