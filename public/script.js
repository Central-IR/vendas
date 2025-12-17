// ============================================
// CONFIGURAÇÃO
// ============================================
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : '/api';

let vendas = [];
let isOnline = false;
let lastDataHash = '';
let sessionToken = null;
let currentYear = new Date().getFullYear();
let monitoramentoYear = new Date().getFullYear();
let currentView = 'painel';

const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

console.log('Vendas App iniciada');

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
});

// ============================================
// NAVEGAÇÃO PRINCIPAL
// ============================================
window.switchMainView = function(view) {
    currentView = view;
    
    document.getElementById('btnPainel').classList.toggle('active', view === 'painel');
    document.getElementById('btnMonitoramento').classList.toggle('active', view === 'monitoramento');
    
    document.getElementById('painelVendas').style.display = view === 'painel' ? 'block' : 'none';
    document.getElementById('monitoramento').style.display = view === 'monitoramento' ? 'block' : 'none';
    
    if (view === 'painel') {
        renderAllDashboards();
    } else {
        renderMonitoramento();
    }
};

// ============================================
// NAVEGAÇÃO POR ANOS - PAINEL
// ============================================
function updateYearDisplay() {
    const display = document.getElementById('currentYearDisplay');
    if (display) {
        display.textContent = currentYear;
    }
}

window.previousYear = function() {
    currentYear--;
    updateYearDisplay();
    renderAllDashboards();
};

window.nextYear = function() {
    currentYear++;
    updateYearDisplay();
    renderAllDashboards();
};

// ============================================
// NAVEGAÇÃO POR ANOS - MONITORAMENTO
// ============================================
function updateMonitoramentoYearDisplay() {
    const display = document.getElementById('monitoramentoYearDisplay');
    if (display) {
        display.textContent = monitoramentoYear;
    }
}

window.previousYearMonitoramento = function() {
    monitoramentoYear--;
    updateMonitoramentoYearDisplay();
    renderMonitoramento();
};

window.nextYearMonitoramento = function() {
    monitoramentoYear++;
    updateMonitoramentoYearDisplay();
    renderMonitoramento();
};

// ============================================
// AUTENTICAÇÃO
// ============================================
function verificarAutenticacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');

    if (tokenFromUrl) {
        sessionToken = tokenFromUrl;
        sessionStorage.setItem('vendasSession', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        sessionToken = sessionStorage.getItem('vendasSession');
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
    updateMonitoramentoYearDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
}

// ============================================
// CONEXÃO E STATUS
// ============================================
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/vendas`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            }
        });

        if (response.status === 401) {
            sessionStorage.removeItem('vendasSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }

        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('Servidor ONLINE');
            await loadVendas();
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
async function loadVendas() {
    if (!isOnline) return;

    try {
        const response = await fetch(`${API_URL}/vendas`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            }
        });

        if (response.status === 401) {
            sessionStorage.removeItem('vendasSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }

        if (!response.ok) return;

        const data = await response.json();
        vendas = data;
        
        const newHash = JSON.stringify(vendas.map(v => v.id));
        if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            console.log(`${vendas.length} vendas carregadas`);
            updateAllFilters();
            
            if (currentView === 'painel') {
                renderAllDashboards();
            } else {
                renderMonitoramento();
            }
        }
    } catch (error) {
        console.error('Erro ao carregar:', error);
    }
}

function startPolling() {
    loadVendas();
    setInterval(() => {
        if (isOnline) loadVendas();
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
        const entregasResponse = await fetch(`${API_URL}/sync-entregas`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            }
        });

        if (!entregasResponse.ok) throw new Error('Erro ao sincronizar entregas');
        const entregasData = await entregasResponse.json();

        const pagamentosResponse = await fetch(`${API_URL}/sync-pagamentos`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            }
        });

        if (!pagamentosResponse.ok) throw new Error('Erro ao sincronizar pagamentos');
        const pagamentosData = await pagamentosResponse.json();

        await loadVendas();

        const totalSynced = entregasData.synced + pagamentosData.updated;
        showMessage(`Sincronização concluída! ${totalSynced} registros atualizados.`, 'success');

    } catch (error) {
        console.error('Erro na sincronização:', error);
        showMessage('Erro ao sincronizar dados.', 'error');
    } finally {
        syncBtn.disabled = false;
        syncBtn.style.opacity = '1';
    }
};

// ============================================
// PAINEL DE VENDAS - TODOS OS DASHBOARDS
// ============================================
function renderAllDashboards() {
    const container = document.getElementById('dashboardsContainer');
    if (!container) return;

    let html = '';

    for (let mes = 0; mes < 12; mes++) {
        const stats = calcularEstatisticasMes(mes, currentYear);
        html += gerarDashboardHTML(meses[mes], stats);
    }

    const statsTotal = calcularEstatisticasTotal(currentYear);
    html += gerarDashboardHTML('Total', statsTotal);

    container.innerHTML = html;
}

function calcularEstatisticasMes(mes, ano) {
    const vendasPagasNoMes = vendas.filter(v => {
        if (!v.data_pagamento) return false;
        const dataPagamento = new Date(v.data_pagamento + 'T00:00:00');
        return dataPagamento.getMonth() === mes && dataPagamento.getFullYear() === ano;
    });

    const vendasDoAno = vendas.filter(v => {
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        return dataEmissao.getFullYear() === ano;
    });

    const pagas = vendasPagasNoMes.length;
    const pendentes = vendasDoAno.filter(v => v.status_pagamento === false).length;
    
    const valorPago = vendasPagasNoMes
        .reduce((sum, v) => sum + parseFloat(v.valor_nf || 0), 0);
    
    const valorPendente = vendasDoAno
        .filter(v => v.status_pagamento === false)
        .reduce((sum, v) => sum + parseFloat(v.valor_nf || 0), 0);

    return { pagas, pendentes, valorPago, valorPendente };
}

function calcularEstatisticasTotal(ano) {
    const vendasPagasNoAno = vendas.filter(v => {
        if (!v.data_pagamento) return false;
        const dataPagamento = new Date(v.data_pagamento + 'T00:00:00');
        return dataPagamento.getFullYear() === ano;
    });

    const todasVendasAno = vendas.filter(v => {
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        return dataEmissao.getFullYear() === ano;
    });

    const pagas = vendasPagasNoAno.length;
    const pendentes = todasVendasAno.filter(v => v.status_pagamento === false).length;
    
    const valorPago = vendasPagasNoAno
        .reduce((sum, v) => sum + parseFloat(v.valor_nf || 0), 0);
    
    const valorPendente = todasVendasAno
        .filter(v => v.status_pagamento === false)
        .reduce((sum, v) => sum + parseFloat(v.valor_nf || 0), 0);

    return { pagas, pendentes, valorPago, valorPendente };
}

function gerarDashboardHTML(titulo, stats) {
    const temPendentes = stats.pendentes > 0;
    
    return `
        <div class="card month-dashboard">
            <h3 class="month-title">${titulo}</h3>
            <div class="dashboard-grid">
                <div class="stat-card">
                    <div class="stat-label">Notas Pagas</div>
                    <div class="stat-value stat-success">${stats.pagas}</div>
                </div>
                <div class="stat-card ${temPendentes ? 'stat-card-alert has-alert' : ''}">
                    <div class="stat-label">Pendentes</div>
                    <div class="stat-value stat-danger">${stats.pendentes}</div>
                    ${temPendentes ? `<div class="pulse-badge">${stats.pendentes}</div>` : ''}
                </div>
                <div class="stat-card">
                    <div class="stat-label">Valor Pago</div>
                    <div class="stat-value stat-success">R$ ${stats.valorPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Valor Pendente</div>
                    <div class="stat-value stat-gray">R$ ${stats.valorPendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// MONITORAMENTO - SEPARADO POR MÊS DE EMISSÃO
// ============================================
window.renderMonitoramento = function() {
    const container = document.getElementById('monitoramentoContainer');
    if (!container) return;

    const searchTerm = document.getElementById('search')?.value.toLowerCase() || '';
    const filterVendedor = document.getElementById('filterVendedor')?.value || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';

    let vendasFiltradas = vendas.filter(v => {
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        return dataEmissao.getFullYear() === monitoramentoYear;
    });

    if (filterVendedor) {
        vendasFiltradas = vendasFiltradas.filter(v => v.vendedor === filterVendedor);
    }

    if (filterStatus) {
        if (filterStatus === 'PAGO') {
            vendasFiltradas = vendasFiltradas.filter(v => v.status_pagamento === true);
        } else if (filterStatus === 'PENDENTE') {
            vendasFiltradas = vendasFiltradas.filter(v => v.status_pagamento === false);
        }
    }

    if (searchTerm) {
        vendasFiltradas = vendasFiltradas.filter(v => 
            v.numero_nf?.toLowerCase().includes(searchTerm) ||
            v.nome_orgao?.toLowerCase().includes(searchTerm) ||
            v.cidade_destino?.toLowerCase().includes(searchTerm)
        );
    }

    const vendasPorMes = {};
    for (let mes = 0; mes < 12; mes++) {
        vendasPorMes[mes] = [];
    }

    vendasFiltradas.forEach(v => {
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        const mes = dataEmissao.getMonth();
        vendasPorMes[mes].push(v);
    });

    for (let mes = 0; mes < 12; mes++) {
        vendasPorMes[mes].sort((a, b) => {
            return new Date(a.data_emissao) - new Date(b.data_emissao);
        });
    }

    let html = '';
    for (let mes = 0; mes < 12; mes++) {
        if (vendasPorMes[mes].length > 0) {
            html += `
                <div class="card">
                    <h3 class="month-section-title">${meses[mes]} ${monitoramentoYear}</h3>
                    ${renderTabelaVendas(vendasPorMes[mes])}
                </div>
            `;
        }
    }

    if (html === '') {
        html = '<div class="card"><p style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma venda encontrada</p></div>';
    }

    container.innerHTML = html;
};

function renderTabelaVendas(vendas) {
    return `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>NF</th>
                        <th>Vendedor</th>
                        <th>Órgão</th>
                        <th>Cidade-UF</th>
                        <th>Data Emissão</th>
                        <th>Data Entrega</th>
                        <th>Data Pagamento</th>
                        <th>Valor NF</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${vendas.map(v => {
                        const isPago = v.status_pagamento === true;
                        const rowClass = isPago ? 'row-pago' : '';
                        return `
                        <tr class="${rowClass}">
                            <td><strong>${v.numero_nf}</strong></td>
                            <td>${v.vendedor}</td>
                            <td style="max-width: 200px; word-wrap: break-word;">${v.nome_orgao}</td>
                            <td>${v.cidade_destino}</td>
                            <td>${formatDate(v.data_emissao)}</td>
                            <td>${formatDate(v.data_entrega)}</td>
                            <td>${v.data_pagamento ? formatDate(v.data_pagamento) : '-'}</td>
                            <td><strong>R$ ${parseFloat(v.valor_nf).toFixed(2)}</strong></td>
                            <td>${getStatusBadge(isPago)}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================
// FILTROS
// ============================================
function updateAllFilters() {
    updateVendedoresFilter();
}

function updateVendedoresFilter() {
    const vendedores = new Set();
    vendas.forEach(v => {
        if (v.vendedor?.trim()) {
            vendedores.add(v.vendedor.trim());
        }
    });

    const select = document.getElementById('filterVendedor');
    if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Todos</option>';
        Array.from(vendedores).sort().forEach(v => {
            const option = document.createElement('option');
            option.value = v;
            option.textContent = v;
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

function getStatusBadge(isPago) {
    return isPago 
        ? '<span class="badge entregue">PAGO</span>' 
        : '<span class="badge aguardando">PENDENTE</span>';
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
