// ============================================
// CONFIGURAÇÃO
// ============================================
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : '/api';

const VENDEDOR = 'MIGUEL'; // Filtrar apenas vendas do Miguel

let entregas = []; // Dados do Controle de Frete
let liquidadas = []; // Dados do Contas a Receber
let isOnline = false;
let sessionToken = null;
let currentView = 'painel';

// Navegação de anos (Painel)
let painelYear = new Date().getFullYear();

// Navegação de meses (Entregas e Liquidadas)
let entregasMonth = new Date().getMonth();
let entregasYear = new Date().getFullYear();
let liquidadasMonth = new Date().getMonth();
let liquidadasYear = new Date().getFullYear();

const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

console.log('🚀 Vendas App - Miguel iniciada');

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
});

// ============================================
// NAVEGAÇÃO PRINCIPAL
// ============================================
window.switchMainView = function(view) {
    currentView = view;
    
    document.getElementById('btnPainel').classList.toggle('active', view === 'painel');
    document.getElementById('btnEntregas').classList.toggle('active', view === 'entregas');
    document.getElementById('btnLiquidadas').classList.toggle('active', view === 'liquidadas');
    
    document.getElementById('painelVendas').style.display = view === 'painel' ? 'block' : 'none';
    document.getElementById('entregas').style.display = view === 'entregas' ? 'block' : 'none';
    document.getElementById('liquidadas').style.display = view === 'liquidadas' ? 'block' : 'none';
    
    if (view === 'painel') {
        renderPainelVendas();
    } else if (view === 'entregas') {
        renderEntregas();
    } else if (view === 'liquidadas') {
        renderLiquidadas();
    }
};

// ============================================
// NAVEGAÇÃO POR ANOS - PAINEL
// ============================================
function updateYearDisplay() {
    const display = document.getElementById('currentYearDisplay');
    if (display) display.textContent = painelYear;
}

window.previousYear = function() {
    painelYear--;
    updateYearDisplay();
    renderPainelVendas();
};

window.nextYear = function() {
    painelYear++;
    updateYearDisplay();
    renderPainelVendas();
};

// ============================================
// NAVEGAÇÃO POR MESES - ENTREGAS
// ============================================
function updateEntregasMonthDisplay() {
    const display = document.getElementById('entregasMonthDisplay');
    if (display) display.textContent = `${meses[entregasMonth]} ${entregasYear}`;
}

window.previousMonthEntregas = function() {
    entregasMonth--;
    if (entregasMonth < 0) {
        entregasMonth = 11;
        entregasYear--;
    }
    updateEntregasMonthDisplay();
    renderEntregas();
};

window.nextMonthEntregas = function() {
    entregasMonth++;
    if (entregasMonth > 11) {
        entregasMonth = 0;
        entregasYear++;
    }
    updateEntregasMonthDisplay();
    renderEntregas();
};

// ============================================
// NAVEGAÇÃO POR MESES - LIQUIDADAS
// ============================================
function updateLiquidadasMonthDisplay() {
    const display = document.getElementById('liquidadasMonthDisplay');
    if (display) display.textContent = `${meses[liquidadasMonth]} ${liquidadasYear}`;
}

window.previousMonthLiquidadas = function() {
    liquidadasMonth--;
    if (liquidadasMonth < 0) {
        liquidadasMonth = 11;
        liquidadasYear--;
    }
    updateLiquidadasMonthDisplay();
    renderLiquidadas();
};

window.nextMonthLiquidadas = function() {
    liquidadasMonth++;
    if (liquidadasMonth > 11) {
        liquidadasMonth = 0;
        liquidadasYear++;
    }
    updateLiquidadasMonthDisplay();
    renderLiquidadas();
};

// ============================================
// AUTENTICAÇÃO
// ============================================
function verificarAutenticacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');

    if (tokenFromUrl) {
        sessionToken = tokenFromUrl;
        sessionStorage.setItem('vendasMiguelSession', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        sessionToken = sessionStorage.getItem('vendasMiguelSession');
    }

    if (!sessionToken) {
        mostrarTelaAcessoNegado();
        return;
    }

    inicializarApp();
}

function mostrarTelaAcessoNegado(mensagem = 'NÃO AUTORIZADO') {
    document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: var(--bg-primary); color: var(--text-primary); text-align: center; padding: 2rem;">
            <h1 style="font-size: 2.2rem; margin-bottom: 1rem;">${mensagem}</h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">Somente usuários autenticados podem acessar esta área.</p>
            <a href="${PORTAL_URL}" style="display: inline-block; background: var(--btn-register); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Ir para o Portal</a>
        </div>
    `;
}

function inicializarApp() {
    updateYearDisplay();
    updateEntregasMonthDisplay();
    updateLiquidadasMonthDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
}

// ============================================
// CONEXÃO E STATUS
// ============================================
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/status`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            }
        });

        if (response.status === 401) {
            sessionStorage.removeItem('vendasMiguelSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }

        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('✅ Servidor ONLINE');
            await loadAllData();
        }
        
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        isOnline = false;
        updateConnectionStatus();
        return false;
    }
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.className = isOnline ? 'connection-status online' : 'connection-status offline';
    }
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================
async function loadAllData() {
    if (!isOnline) return;

    try {
        // Carregar Entregas (Controle de Frete)
        const entregasResponse = await fetch(`${API_URL}/entregas?vendedor=${VENDEDOR}`, {
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            }
        });

        if (entregasResponse.ok) {
            entregas = await entregasResponse.json();
            console.log(`📦 ${entregas.length} entregas carregadas`);
        }

        // Carregar Liquidadas (Contas a Receber)
        const liquidadasResponse = await fetch(`${API_URL}/liquidadas?vendedor=${VENDEDOR}`, {
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            }
        });

        if (liquidadasResponse.ok) {
            liquidadas = await liquidadasResponse.json();
            console.log(`💰 ${liquidadas.length} notas liquidadas carregadas`);
        }

        updateAllFilters();
        
        if (currentView === 'painel') {
            renderPainelVendas();
        } else if (currentView === 'entregas') {
            renderEntregas();
        } else if (currentView === 'liquidadas') {
            renderLiquidadas();
        }

    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
    }
}

function startPolling() {
    loadAllData();
    setInterval(() => {
        if (isOnline) loadAllData();
    }, 30000);
}

// ============================================
// SINCRONIZAÇÃO
// ============================================
window.syncData = async function() {
    if (!isOnline) {
        showMessage('Sistema offline. Não é possível sincronizar.', 'error');
        return;
    }

    const syncBtn = document.getElementById('syncBtn');
    syncBtn.disabled = true;
    syncBtn.style.opacity = '0.5';
    
    showMessage('Sincronizando dados...', 'success');

    try {
        await loadAllData();
        showMessage('Sincronização concluída!', 'success');
    } catch (error) {
        console.error('Erro na sincronização:', error);
        showMessage('Erro ao sincronizar dados.', 'error');
    } finally {
        syncBtn.disabled = false;
        syncBtn.style.opacity = '1';
    }
};

// ============================================
// PAINEL DE VENDAS - APENAS VALORES PAGOS
// ============================================
function renderPainelVendas() {
    const container = document.getElementById('dashboardsContainer');
    if (!container) return;

    let html = '<div class="dashboards-horizontal">';

    for (let mes = 0; mes < 12; mes++) {
        const valorPago = calcularValorPagoMes(mes, painelYear);
        html += gerarDashboardMensal(meses[mes], valorPago);
    }

    const valorTotalAno = calcularValorPagoAno(painelYear);
    html += gerarDashboardMensal('Total', valorTotalAno);

    html += '</div>';
    container.innerHTML = html;
}

function calcularValorPagoMes(mes, ano) {
    return liquidadas
        .filter(l => {
            if (!l.data_pagamento) return false;
            const dataPagamento = new Date(l.data_pagamento + 'T00:00:00');
            return dataPagamento.getMonth() === mes && dataPagamento.getFullYear() === ano;
        })
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
}

function calcularValorPagoAno(ano) {
    return liquidadas
        .filter(l => {
            if (!l.data_pagamento) return false;
            const dataPagamento = new Date(l.data_pagamento + 'T00:00:00');
            return dataPagamento.getFullYear() === ano;
        })
        .reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
}

function gerarDashboardMensal(titulo, valor) {
    return `
        <div class="dashboard-mensal">
            <h3 class="dashboard-title">${titulo}</h3>
            <div class="dashboard-valor">
                R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
        </div>
    `;
}

// ============================================
// ENTREGAS - CONTROLE DE FRETE
// ============================================
window.renderEntregas = function() {
    const container = document.getElementById('entregasContainer');
    if (!container) return;

    const searchTerm = document.getElementById('searchEntregas')?.value.toLowerCase() || '';
    const filterTransportadora = document.getElementById('filterTransportadora')?.value || '';

    let filtradas = entregas.filter(e => {
        const dataEntrega = new Date(e.previsao_entrega + 'T00:00:00');
        return dataEntrega.getMonth() === entregasMonth && dataEntrega.getFullYear() === entregasYear;
    });

    if (filterTransportadora) {
        filtradas = filtradas.filter(e => e.transportadora === filterTransportadora);
    }

    if (searchTerm) {
        filtradas = filtradas.filter(e => 
            e.numero_nf?.toLowerCase().includes(searchTerm) ||
            e.nome_orgao?.toLowerCase().includes(searchTerm) ||
            e.cidade_destino?.toLowerCase().includes(searchTerm)
        );
    }

    filtradas.sort((a, b) => new Date(a.previsao_entrega) - new Date(b.previsao_entrega));

    if (filtradas.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma entrega encontrada neste período</p>';
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>NF</th>
                        <th>Data Emissão</th>
                        <th>Órgão</th>
                        <th>Cidade</th>
                        <th>Transportadora</th>
                        <th>Valor NF</th>
                        <th>Valor Frete</th>
                        <th>Data Entrega</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtradas.map(e => `
                        <tr>
                            <td><strong>${e.numero_nf}</strong></td>
                            <td>${formatDate(e.data_emissao)}</td>
                            <td style="max-width: 200px;">${e.nome_orgao}</td>
                            <td>${e.cidade_destino}</td>
                            <td>${e.transportadora}</td>
                            <td><strong>R$ ${parseFloat(e.valor_nf).toFixed(2)}</strong></td>
                            <td>R$ ${parseFloat(e.valor_frete).toFixed(2)}</td>
                            <td>${formatDate(e.previsao_entrega)}</td>
                            <td style="text-align: center;">
                                <button onclick="viewEntrega('${e.id}')" class="action-btn view">Ver</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};

// ============================================
// LIQUIDADAS - CONTAS A RECEBER
// ============================================
window.renderLiquidadas = function() {
    const container = document.getElementById('liquidadasContainer');
    if (!container) return;

    const searchTerm = document.getElementById('searchLiquidadas')?.value.toLowerCase() || '';
    const filterBanco = document.getElementById('filterBanco')?.value || '';

    let filtradas = liquidadas.filter(l => {
        if (!l.data_pagamento) return false;
        const dataPagamento = new Date(l.data_pagamento + 'T00:00:00');
        return dataPagamento.getMonth() === liquidadasMonth && dataPagamento.getFullYear() === liquidadasYear;
    });

    if (filterBanco) {
        filtradas = filtradas.filter(l => l.banco === filterBanco);
    }

    if (searchTerm) {
        filtradas = filtradas.filter(l => 
            l.numero_nf?.toLowerCase().includes(searchTerm) ||
            l.orgao?.toLowerCase().includes(searchTerm) ||
            l.banco?.toLowerCase().includes(searchTerm)
        );
    }

    filtradas.sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento));

    if (filtradas.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma nota liquidada encontrada neste período</p>';
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>NF</th>
                        <th>Órgão</th>
                        <th>Banco</th>
                        <th>Valor</th>
                        <th>Data Emissão</th>
                        <th>Data Vencimento</th>
                        <th>Data Pagamento</th>
                        <th>Tipo</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtradas.map(l => `
                        <tr class="row-pago">
                            <td><strong>${l.numero_nf}</strong></td>
                            <td style="max-width: 200px;">${l.orgao}</td>
                            <td>${l.banco}</td>
                            <td><strong>R$ ${parseFloat(l.valor).toFixed(2)}</strong></td>
                            <td>${formatDate(l.data_emissao)}</td>
                            <td>${formatDate(l.data_vencimento)}</td>
                            <td>${formatDate(l.data_pagamento)}</td>
                            <td>${l.tipo_nf}</td>
                            <td style="text-align: center;">
                                <button onclick="viewLiquidada('${l.id}')" class="action-btn view">Ver</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};

// ============================================
// MODAIS DE VISUALIZAÇÃO
// ============================================

// Ver detalhes de Entrega
window.viewEntrega = function(id) {
    const entrega = entregas.find(e => String(e.id) === String(id));
    
    if (!entrega) {
        showMessage('Entrega não encontrada!', 'error');
        return;
    }

    const modalHTML = `
        <div class="modal-overlay" id="viewModal" onclick="closeModalOnOverlay(event)">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes da Entrega</h3>
                    <button class="modal-close" onclick="closeViewModal()">×</button>
                </div>
                
                <div class="info-section">
                    <h4>Informações da Nota Fiscal</h4>
                    <p><strong>Número NF:</strong> ${entrega.numero_nf}</p>
                    <p><strong>Documento:</strong> ${entrega.documento || '-'}</p>
                    <p><strong>Data Emissão:</strong> ${formatDate(entrega.data_emissao)}</p>
                    <p><strong>Valor NF:</strong> R$ ${parseFloat(entrega.valor_nf).toFixed(2)}</p>
                    <p><strong>Vendedor:</strong> ${entrega.vendedor}</p>
                </div>

                <div class="info-section">
                    <h4>Informações do Órgão</h4>
                    <p><strong>Nome:</strong> ${entrega.nome_orgao}</p>
                    <p><strong>Contato:</strong> ${entrega.contato_orgao || '-'}</p>
                    <p><strong>Cidade:</strong> ${entrega.cidade_destino}</p>
                </div>

                <div class="info-section">
                    <h4>Informações do Transporte</h4>
                    <p><strong>Transportadora:</strong> ${entrega.transportadora}</p>
                    <p><strong>Valor Frete:</strong> R$ ${parseFloat(entrega.valor_frete).toFixed(2)}</p>
                    <p><strong>Data Coleta:</strong> ${formatDate(entrega.data_coleta)}</p>
                    <p><strong>Previsão Entrega:</strong> ${formatDate(entrega.previsao_entrega)}</p>
                    <p><strong>Status:</strong> <span class="badge entregue">${entrega.status}</span></p>
                </div>

                <div class="modal-actions">
                    <button class="secondary" onclick="closeViewModal()">Fechar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Ver detalhes de Liquidada
window.viewLiquidada = function(id) {
    const liquidada = liquidadas.find(l => String(l.id) === String(id));
    
    if (!liquidada) {
        showMessage('Nota não encontrada!', 'error');
        return;
    }

    const modalHTML = `
        <div class="modal-overlay" id="viewModal" onclick="closeModalOnOverlay(event)">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes da Nota Liquidada</h3>
                    <button class="modal-close" onclick="closeViewModal()">×</button>
                </div>
                
                <div class="info-section">
                    <h4>Informações da Nota Fiscal</h4>
                    <p><strong>Número NF:</strong> ${liquidada.numero_nf}</p>
                    <p><strong>Tipo:</strong> ${liquidada.tipo_nf}</p>
                    <p><strong>Valor:</strong> R$ ${parseFloat(liquidada.valor).toFixed(2)}</p>
                    <p><strong>Vendedor:</strong> ${liquidada.vendedor}</p>
                    <p><strong>Status:</strong> <span class="badge entregue">${liquidada.status}</span></p>
                </div>

                <div class="info-section">
                    <h4>Informações do Órgão</h4>
                    <p><strong>Nome:</strong> ${liquidada.orgao}</p>
                </div>

                <div class="info-section">
                    <h4>Informações Financeiras</h4>
                    <p><strong>Banco:</strong> ${liquidada.banco}</p>
                    <p><strong>Data Emissão:</strong> ${formatDate(liquidada.data_emissao)}</p>
                    <p><strong>Data Vencimento:</strong> ${formatDate(liquidada.data_vencimento)}</p>
                    <p><strong>Data Pagamento:</strong> ${formatDate(liquidada.data_pagamento)}</p>
                </div>

                ${liquidada.observacoes ? `
                    <div class="info-section">
                        <h4>Observações</h4>
                        <p>${liquidada.observacoes}</p>
                    </div>
                ` : ''}

                <div class="modal-actions">
                    <button class="secondary" onclick="closeViewModal()">Fechar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

function closeViewModal() {
    const modal = document.getElementById('viewModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => modal.remove(), 200);
    }
}

function closeModalOnOverlay(event) {
    if (event.target.classList.contains('modal-overlay')) {
        closeViewModal();
    }
}

// Adicionar CSS para fadeOut
if (!document.querySelector('#modalAnimations')) {
    const style = document.createElement('style');
    style.id = 'modalAnimations';
    style.textContent = `@keyframes fadeOut { to { opacity: 0; } }`;
    document.head.appendChild(style);
}

// ============================================
// FILTROS
// ============================================
function updateAllFilters() {
    updateTransportadorasFilter();
    updateBancosFilter();
}

function updateTransportadorasFilter() {
    const transportadoras = new Set();
    entregas.forEach(e => {
        if (e.transportadora?.trim()) transportadoras.add(e.transportadora.trim());
    });

    const select = document.getElementById('filterTransportadora');
    if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Todas</option>';
        Array.from(transportadoras).sort().forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = t;
            select.appendChild(option);
        });
        select.value = currentValue;
    }
}

function updateBancosFilter() {
    const bancos = new Set();
    liquidadas.forEach(l => {
        if (l.banco?.trim()) bancos.add(l.banco.trim());
    });

    const select = document.getElementById('filterBanco');
    if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Todos</option>';
        Array.from(bancos).sort().forEach(b => {
            const option = document.createElement('option');
            option.value = b;
            option.textContent = b;
            select.appendChild(option);
        });
        select.value = currentValue;
    }
}

// ============================================
// UTILIDADES
// ============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function showMessage(message, type) {
    const oldMessages = document.querySelectorAll('.floating-message');
    oldMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}
