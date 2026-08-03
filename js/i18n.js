export const i18n = {
    translations: {
        es: {
            "nav.home": "Inicio",
            "nav.analysis": "Análisis",
            "nav.wallet": "Cartera",
            "nav.market": "Mercado",
            "nav.transfers": "Transferencias",
            "nav.map": "Mapa",
            "nav.profile": "Perfil",

            "home.greeting": "Hola",

            "action.edit": "Editar",
            "action.hide": "Ocultar",
            "action.unhide": "Mostrar",
            "action.delete": "Borrar",
            "home.balance": "Balance Total",
            "home.income": "Ingresos",
            "home.expense": "Gastos",
            "home.recent": "Actividad Reciente",
            "home.seeAll": "Ver todo",
            "home.newTransaction": "Nuevo Movimiento",
            "home.empty": "No hay movimientos recientes",

            "wallet.netWorth": "Patrimonio Neto",
            "wallet.newAccount": "Nueva Cuenta",
            "wallet.history": "Movimientos de la cuenta",
            "wallet.select": "Selecciona una cuenta para ver sus movimientos",

            "analysis.title": "Análisis Mensual",
            "analysis.download": "Descargar Reporte",
            "analysis.totalExpense": "Gasto Total",
            "analysis.topExpense": "Mayor Gasto",
            "analysis.dailyAvg": "Promedio Diario",
            "analysis.distribution": "Distribución de Gastos",
            "analysis.empty": "Añade movimientos para ver tus estadísticas 📊",

            "market.title": "Mercado",
            "market.stocks": "Big Tech Stocks",
            "market.products": "Productos VELUT",
            "market.contract": "Contratar ahora",
            "market.loading": "Cargando acciones...",
            "market.crypto": "Criptomonedas",
            "market.forex": "Divisas",

            "transfers.title": "Enviar Dinero",
            "transfers.email": "Email del Destinatario",
            "transfers.amount": "Cantidad (€)",
            "transfers.concept": "Concepto",
            "transfers.send": "Enviar Dinero",
            "transfers.history": "Historial de Transferencias",
            "transfers.placeholder.email": "ejemplo@correo.com",
            "transfers.placeholder.amount": "0.00",
            "transfers.placeholder.concept": "Cena, regalo, alquiler...",

            "map.title": "Mapa de Gastos",

            "profile.title": "Mi Perfil",
            "profile.paymentId": "Mi ID de Pago",
            "profile.settings": "Ajustes",
            "profile.darkMode": "Modo Oscuro",
            "profile.notifications": "Notificaciones",
            "profile.language": "Idioma",
            "profile.visualization": "Visualización",
            "profile.showHidden": "Mostrar movimientos ocultos",
            "profile.privacy": "Privacidad y Datos",
            "profile.export": "Exportar mis datos (JSON)",
            "profile.logout": "Cerrar Sesión",

            "cat.food": "Comida",
            "cat.transport": "Transporte",
            "cat.leisure": "Ocio",
            "cat.shopping": "Compras",
            "cat.health": "Salud",
            "cat.education": "Educación",
            "cat.home": "Hogar",
            "cat.bills": "Facturas",
            "cat.other": "Otro",
            "type.income": "Ingreso",
            "type.expense": "Gasto",
            "type.transfer": "Traspaso",
            "type.transfer_sent": "Transferencia enviada",
            "type.transfer_received": "Transferencia recibida",

            "common.loading": "Cargando...",
            "common.error": "Error"
        },
        en: {
            "nav.home": "Home",
            "nav.analysis": "Analysis",
            "nav.wallet": "Wallet",
            "nav.market": "Market",
            "nav.transfers": "Transfers",
            "nav.map": "Map",
            "nav.profile": "Profile",

            "home.greeting": "Hello",
            "home.balance": "Total Balance",
            "home.income": "Income",
            "home.expense": "Expenses",
            "home.recent": "Recent Activity",
            "home.seeAll": "See All",
            "home.newTransaction": "New Transaction",
            "home.empty": "No recent transactions",

            "wallet.netWorth": "Net Worth",
            "wallet.newAccount": "New Account",
            "wallet.history": "Account History",
            "wallet.select": "Select an account to view history",

            "analysis.title": "Monthly Analysis",
            "analysis.download": "Download Report",
            "analysis.totalExpense": "Total Expense",
            "analysis.topExpense": "Top Expense",
            "analysis.dailyAvg": "Daily Average",
            "analysis.distribution": "Expense Distribution",
            "analysis.empty": "Add transactions to see your stats 📊",

            "market.title": "Market",
            "market.stocks": "Big Tech Stocks",
            "market.products": "VELUT Products",
            "market.contract": "Contract Now",
            "market.loading": "Loading stocks...",
            "market.crypto": "Cryptocurrency",
            "market.forex": "Currencies",

            "transfers.title": "Send Money",
            "transfers.email": "Recipient Email",
            "transfers.amount": "Amount (€)",
            "transfers.concept": "Concept",
            "transfers.send": "Send Money",
            "transfers.history": "Transfer History",
            "transfers.placeholder.email": "example@email.com",
            "transfers.placeholder.amount": "0.00",
            "transfers.placeholder.concept": "Dinner, gift, rent...",

            "map.title": "Expense Map",

            "profile.title": "My Profile",
            "profile.paymentId": "My Payment ID",
            "profile.settings": "Settings",
            "profile.darkMode": "Dark Mode",
            "profile.notifications": "Notifications",
            "profile.language": "Language",

            "action.edit": "Edit",
            "action.hide": "Hide",
            "action.unhide": "Unhide",
            "action.delete": "Delete",

            "profile.visualization": "Visualization",
            "profile.showHidden": "Show hidden transactions",
            "profile.privacy": "Privacy & Data",
            "profile.export": "Export my data (JSON)",
            "profile.logout": "Log Out",

            "cat.food": "Food",
            "cat.transport": "Transport",
            "cat.leisure": "Leisure",
            "cat.shopping": "Shopping",
            "cat.health": "Health",
            "cat.education": "Education",
            "cat.home": "Home",
            "cat.bills": "Bills",
            "cat.other": "Other",
            "type.income": "Income",
            "type.expense": "Expense",
            "type.transfer": "Transfer",
            "type.transfer_sent": "Transfer Sent",
            "type.transfer_received": "Transfer Received",

            "common.loading": "Loading...",
            "common.error": "Error"
        }
    },

    currentLang: 'es',

    init() {
        const savedLang = localStorage.getItem('velut_lang');
        if (savedLang) {
            this.currentLang = savedLang;
        } else {
            // Default to Spanish
            this.currentLang = 'es';
        }
        this.applyLanguage(this.currentLang);

        // Update selector if exists
        const selector = document.getElementById('language-selector');
        if (selector) {
            selector.value = this.currentLang;
            selector.addEventListener('change', (e) => {
                this.changeLanguage(e.target.value);
            });
        }
    },

    changeLanguage(lang) {
        if (!this.translations[lang]) return;
        this.currentLang = lang;
        localStorage.setItem('velut_lang', lang);
        this.applyLanguage(lang);

        // Trigger chart update
        if (window.expenseChart) {
            // Re-render chart logic if simple update isn't enough, 
            // but for labels we need to update the data.
            // Dispatch event for App to handle
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
        }

        // Update dynamic greeting
        const user = window.auth?.currentUser;
        if (user) {
            const greeting = document.getElementById('greeting');
            if (greeting) greeting.textContent = `${this.t('home.greeting')}, ${user.displayName || 'Usuario'}`;
        }
    },

    applyLanguage(lang) {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.translations[lang][key];
            if (text) {
                if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
                    el.placeholder = text;
                } else {
                    el.textContent = text;
                }
            }
        });

        // Handle placeholders specifically
        const inputs = document.querySelectorAll('[data-i18n-placeholder]');
        inputs.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const text = this.translations[lang][key];
            if (text) {
                el.placeholder = text;
            }
        });

        // Update selector value (in case changed programmatically)
        const selector = document.getElementById('language-selector');
        if (selector) selector.value = lang;
    },

    // Helper to get text in code
    t(key) {
        return this.translations[this.currentLang][key] || key;
    }
};
