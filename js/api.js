import { utils } from './utils.js';

export const apiManager = {
    init: () => {
        // Loaded by router
    },

    loadMarketData: async () => {
        const container = document.getElementById('market-list');
        if (!container) return;

        container.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Cargando mercado...</p>';

        try {
            // CoinGecko API
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano&vs_currencies=eur&include_24hr_change=true');
            const data = await response.json();
            apiManager.render(data);
        } catch (error) {
            container.innerHTML = '<p style="text-align:center; color:var(--danger-color); grid-column: 1/-1;">Error de conexión API</p>';
        }
    },

    render: (data) => {
        const container = document.getElementById('market-list');
        container.innerHTML = "";

        Object.keys(data).forEach(coin => {
            const info = data[coin];
            const isPositive = info.eur_24h_change >= 0;
            const changeColor = isPositive ? 'var(--success-color)' : 'var(--danger-color)';

            const card = document.createElement('div');
            card.className = 'market-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="text-transform:capitalize;">${coin}</h3>
                    <span style="background:${changeColor}; color:white; padding: 2px 8px; border-radius:10px; font-size:0.8rem;">
                        ${info.eur_24h_change.toFixed(2)}%
                    </span>
                </div>
                <div style="font-size:1.5rem; font-weight:700;">
                    ${utils.formatCurrency(info.eur)}
                </div>
            `;
            container.appendChild(card);
        });
    }
};
