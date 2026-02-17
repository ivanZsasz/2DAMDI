import { utils } from './utils.js';

const translations = {
    es: {
        appTitle: "Gestión Finanzas",
        dashboard: "Inicio",
        movements: "Movimientos",
        market: "Mercado",
        profile: "Perfil",
        totalBalance: "Balance Total",
        income: "Ingresos",
        expense: "Gastos",
        addTransaction: "Añadir Transacción",
        login: "Iniciar Sesión",
        logout: "Cerrar Sesión",
        email: "Correo electrónico",
        password: "Contraseña",
        save: "Guardar",
        cancel: "Cancelar",
        amount: "Monto",
        category: "Categoría",
        date: "Fecha",
        description: "Descripción",
        settings: "Configuración",
        darkMode: "Modo Oscuro",
        language: "Idioma",
        loading: "Cargando...",
        error: "Error",
        success: "Éxito"
    },
    en: {
        appTitle: "Finance Manager",
        dashboard: "Dashboard",
        movements: "Movements",
        market: "Market",
        profile: "Profile",
        totalBalance: "Total Balance",
        income: "Income",
        expense: "Expenses",
        addTransaction: "Add Transaction",
        login: "Login",
        logout: "Logout",
        email: "Email",
        password: "Password",
        save: "Save",
        cancel: "Cancel",
        amount: "Amount",
        category: "Category",
        date: "Date",
        description: "Description",
        settings: "Settings",
        darkMode: "Dark Mode",
        language: "Language",
        loading: "Loading...",
        error: "Error",
        success: "Success"
    }
};

export class I18n {
    constructor() {
        this.currentLang = utils.storage.get('appLang', 'es');
        this.applyLanguage();
    }

    setLanguage(lang) {
        if (translations[lang]) {
            this.currentLang = lang;
            utils.storage.set('appLang', lang);
            this.applyLanguage();
            // Dispatch event for components to update
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
        }
    }

    t(key) {
        return translations[this.currentLang][key] || key;
    }

    applyLanguage() {
        document.documentElement.lang = this.currentLang;
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                // Handle inputs placeholders and regular text
                if (el.placeholder) {
                    el.placeholder = this.t(key);
                } else {
                    el.textContent = this.t(key);
                }
            }
        });
    }
}

export const i18n = new I18n();
