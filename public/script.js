<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vendas Isaque</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="splash-screen" id="splashScreen">
        <div class="loader"></div>
    </div>
const API_URL = window.location.origin + '/api';
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const DEVELOPMENT_MODE = true;

let isOnline = false;
let lastDataHash = '';
let currentMonth = new Date();
let allVendas = [];
let sessionToken = null;
let calendarYear = new Date().getFullYear();

console.log('🚀 Vendas Consolidada iniciada');
console.log('📍 API URL:', API_URL);

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (DEVELOPMENT_MODE) {
        sessionToken = 'dev-mode';
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        sessionToken = urlParams.get('sessionToken') || sessionStorage.getItem('vendasSession');
        
        if (!sessionToken) {
            mostrarMensagemNaoAutorizado();
            return;
        }
        
        if (urlParams.get('sessionToken')) {
            sessionStorage.setItem('vendasSession', sessionToken);
        }
    }
    
    inicializarApp();
});

function mostrarMensagemNaoAutorizado() {
    document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #1a1a1a; color: white; text-align: center; padding: 2rem;">
            <h1 style="font-size: 3rem; margin-bottom: 1rem; color: #CC7000;">NÃO AUTORIZADO</h1>
            <p style="font-size: 1.2rem; color: #999; margin-bottom: 2rem;">Acesso restrito. Por favor, faça login no portal.</p>
            <a href="${PORTAL_URL}" style="background: #CC7000; color: white; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1.1rem;">Ir para o Portal</a>
        </div>
    `;
}

function inicializarApp() {
    checkServerStatus();
    loadVendas();
    updateMonthDisplay();
    setInterval(checkServerStatus, 15000);
    setInterval(loadVendas, 30000);
}

function updateMonthDisplay() {
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthStr = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    const elem = document.getElementById('currentMonth');
    if (elem) elem.textContent = monthStr;
}

function changeMonth(direction) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    updateMonthDisplay();
    updateDisplay();
}

function toggleCalendar() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        calendarYear = currentMonth.getFullYear();
        renderCalendar();
        modal.classList.add('show');
    }
}

function changeCalendarYear(direction) {
    calendarYear += direction;
    renderCalendar();
}

function renderCalendar() {
    const yearElement = document.getElementById('calendarYear');
    const monthsContainer = document.getElementById('calendarMonths');
    
    if (!yearElement || !monthsContainer) return;
    
    yearElement.textContent = calendarYear;
    
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    monthsContainer.innerHTML = '';
    
    monthNames.forEach((name, index) => {
        const monthButton = document.createElement('div');
        monthButton.className = 'calendar-month';
        monthButton.textContent = name;
        
        if (calendarYear === currentMonth.getFullYear() && index === currentMonth.getMonth()) {
            monthButton.classList.add('current');
        }
        
        monthButton.onclick = () => selectMonth(index);
        monthsContainer.appendChild(monthButton);
    });
}

function selectMonth(monthIndex) {
    currentMonth = new Date(calendarYear, monthIndex, 1);
    updateMonthDisplay();
    updateDisplay();
    toggleCalendar();
}

// FUNÇÃO: Toggle do Modal de Relatório Mensal com Validação de Vendedor
function toggleRelatorioMes() {
    const filterVendedor = document.getElementById('filterVendedor');
    const vendedorSelecionado = filterVendedor ? filterVendedor.value : '';
    
    // Verificar se um vendedor específico está selecionado
    if (!vendedorSelecionado) {
        showToast('Selecione um Vendedor', 'error');
        return;
    }
    
    const modal = document.getElementById('relatorioModal');
    if (!modal) return;
    
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        gerarRelatorioMes();
        modal.classList.add('show');
    }
}

// FUNÇÃO: Gerar Relatório do Mês para o Vendedor Selecionado
function gerarRelatorioMes() {
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const filterVendedor = document.getElementById('filterVendedor');
    const vendedorSelecionado = filterVendedor ? filterVendedor.value : '';
    
    // Atualizar título do modal
    const tituloElem = document.getElementById('relatorioModalTitulo');
    if (tituloElem) {
        tituloElem.textContent = `Relatório de Pagamentos - ${vendedorSelecionado} - ${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }
    
    // Filtrar apenas vendas pagas do mês atual e do vendedor selecionado
    const vendasPagas = allVendas.filter(v => {
        if (v.origem !== 'CONTAS_RECEBER' || !v.data_pagamento) return false;
        if (v.vendedor !== vendedorSelecionado) return false;
        
        const dataPagamento = new Date(v.data_pagamento + 'T00:00:00');
        return dataPagamento.getMonth() === currentMonth.getMonth() && 
               dataPagamento.getFullYear() === currentMonth.getFullYear();
    });
    
    const bodyElem = document.getElementById('relatorioModalBody');
    if (!bodyElem) return;
    
    if (vendasPagas.length === 0) {
        bodyElem.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 1rem; opacity: 0.5;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p style="font-size: 1.1rem; font-weight: 600;">Nenhum pagamento registrado neste mês para ${vendedorSelecionado}</p>
            </div>
        `;
        return;
    }
    
    // Calcular total pago
    const totalPago = vendasPagas.reduce((sum, v) => sum + (parseFloat(v.valor_nf) || 0), 0);
    
    // Gerar HTML da tabela
    bodyElem.innerHTML = `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: var(--text-primary);">Total de Pagamentos:</span>
                <span style="font-size: 1.5rem; font-weight: 700; color: #22C55E;">${formatCurrency(totalPago)}</span>
            </div>
            <div style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                ${vendasPagas.length} pagamento${vendasPagas.length !== 1 ? 's' : ''} registrado${vendasPagas.length !== 1 ? 's' : ''}
            </div>
        </div>
        
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--th-bg); color: var(--th-color);">
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Nº NF</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Órgão</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Data Emissão</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Data Pagamento</th>
                        <th style="padding: 12px; text-align: right; border: 1px solid var(--th-border); font-weight: 600;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${vendasPagas.map((venda, index) => `
                        <tr style="background: ${index % 2 === 0 ? 'var(--bg-card)' : 'var(--table-stripe)'};">
                            <td style="padding: 12px; border: 1px solid var(--border-color);"><strong>${venda.numero_nf}</strong></td>
                            <td style="padding: 12px; border: 1px solid var(--border-color);">${venda.nome_orgao}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); white-space: nowrap;">${formatDate(venda.data_pagamento)}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); text-align: right;"><strong>${formatCurrency(venda.valor_nf)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: rgba(34, 197, 94, 0.1); border-top: 3px solid #22C55E;">
                        <td colspan="4" style="padding: 14px 12px; border: 1px solid var(--border-color); font-weight: 700; font-size: 1rem; color: var(--text-primary);">TOTAL GERAL</td>
                        <td style="padding: 14px 12px; border: 1px solid var(--border-color); text-align: right; font-weight: 700; font-size: 1.1rem; color: #22C55E;">${formatCurrency(totalPago)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// FUNÇÃO: Fechar Modal de Relatório
function closeRelatorioModal() {
    const modal = document.getElementById('relatorioModal');
    if (modal) modal.classList.remove('show');
}

document.addEventListener('click', (e) => {
    const calendarModal = document.getElementById('calendarModal');
    const relatorioModal = document.getElementById('relatorioModal');
    
    if (calendarModal && e.target === calendarModal) {
        calendarModal.classList.remove('show');
    }
    if (relatorioModal && e.target === relatorioModal) {
        relatorioModal.classList.remove('show');
    }
});

async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/../health`);
        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('✅ SERVIDOR ONLINE');
            await loadVendas();
        }
        
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        console.error('❌ Erro ao verificar servidor:', error);
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

async function syncData() {
    if (!isOnline) {
        showToast('Sistema offline', 'error');
        return;
    }

    showToast('Sincronizando...', 'success');
    
    try {
        const response = await fetch(`${API_URL}/sync`);
        if (!response.ok) throw new Error('Erro na sincronização');
        
        await loadVendas();
        showToast('Dados sincronizados!', 'success');
    } catch (error) {
        console.error('Erro ao sincronizar:', error);
        showToast('Erro ao sincronizar', 'error');
    }
}

async function loadVendas() {
    try {
        const response = await fetch(`${API_URL}/vendas`);
        if (!response.ok) throw new Error('Erro ao carregar vendas');
        
        const data = await response.json();
        allVendas = data || [];
        
        updateDisplay();
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
        isOnline = false;
        updateConnectionStatus();
    }
}

async function loadDashboard() {
    try {
        const filterVendedor = document.getElementById('filterVendedor');
        const vendedorSelecionado = filterVendedor ? filterVendedor.value : '';
        
        let monthVendas = allVendas.filter(v => {
            const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
            return dataEmissao.getMonth() === currentMonth.getMonth() && 
                   dataEmissao.getFullYear() === currentMonth.getFullYear();
        });
        
        // Filtrar por vendedor se selecionado
        if (vendedorSelecionado) {
            monthVendas = monthVendas.filter(v => v.vendedor === vendedorSelecionado);
        }

        const stats = {
            pago: 0,
            aReceber: 0,
            entregue: 0,
            faturado: 0
        };

        monthVendas.forEach(venda => {
            const valor = parseFloat(venda.valor_nf) || 0;
            stats.faturado += valor;

            if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
                stats.pago += valor;
            } else if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
                stats.aReceber += valor;
                stats.entregue += 1;
            }
        });
        
        const pagoElem = document.getElementById('totalPago');
        const receberElem = document.getElementById('totalAReceber');
        const entregueElem = document.getElementById('totalEntregue');
        const faturadoElem = document.getElementById('totalFaturado');
        
        if (pagoElem) pagoElem.textContent = formatCurrency(stats.pago);
        if (receberElem) receberElem.textContent = formatCurrency(stats.aReceber);
        if (entregueElem) entregueElem.textContent = stats.entregue;
        if (faturadoElem) faturadoElem.textContent = formatCurrency(stats.faturado);
    } catch (error) {
        console.error('❌ Erro ao carregar dashboard:', error);
    }
}

function filterVendas() {
    updateTable();
    loadDashboard();
}

function updateDisplay() {
    updateTable();
    loadDashboard();
}

function updateTable() {
    const container = document.getElementById('vendasContainer');
    if (!container) return;
    
    const filterVendedor = document.getElementById('filterVendedor');
    const vendedorSelecionado = filterVendedor ? filterVendedor.value : '';
    
    let monthVendas = allVendas.filter(v => {
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        return dataEmissao.getMonth() === currentMonth.getMonth() && 
               dataEmissao.getFullYear() === currentMonth.getFullYear();
    });
    
    let filteredVendas = [...monthVendas];
    
    // Filtrar por vendedor
    if (vendedorSelecionado) {
        filteredVendas = filteredVendas.filter(v => v.vendedor === vendedorSelecionado);
    }
    
    const searchElem = document.getElementById('search');
    const filterStatusElem = document.getElementById('filterStatus');
    
    const search = searchElem ? searchElem.value.toLowerCase() : '';
    const filterStatus = filterStatusElem ? filterStatusElem.value : '';
    
    if (search) {
        filteredVendas = filteredVendas.filter(v => 
            (v.numero_nf || '').toLowerCase().includes(search) ||
            (v.nome_orgao || '').toLowerCase().includes(search)
        );
    }
    
    if (filterStatus) {
        filteredVendas = filteredVendas.filter(v => {
            if (filterStatus === 'PAGO') return v.origem === 'CONTAS_RECEBER' && v.data_pagamento;
            if (v.origem === 'CONTROLE_FRETE') return v.status_frete === filterStatus;
            return false;
        });
    }
    
    // ORDENAR POR NÚMERO DE NF (CRESCENTE)
    filteredVendas.sort((a, b) => {
        const nfA = parseInt(a.numero_nf) || 0;
        const nfB = parseInt(b.numero_nf) || 0;
        return nfA - nfB;
    });
    
    if (filteredVendas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    Nenhuma venda encontrada
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = filteredVendas.map(venda => {
        const status = getStatus(venda);
        let statusClass = '';
        let rowClass = '';
        
        if (status === 'PAGO') {
            statusClass = 'pago';
            rowClass = 'row-pago';
        } else if (status === 'ENTREGUE') {
            statusClass = 'entregue';
            rowClass = 'row-entregue';
        } else if (status === 'EM_TRANSITO') {
            statusClass = 'transito';
        } else if (status === 'AGUARDANDO_COLETA') {
            statusClass = 'aguardando';
        } else if (status === 'EXTRAVIADO') {
            statusClass = 'extraviado';
        } else if (status === 'DEVOLVIDO') {
            statusClass = 'devolvido';
        }
        
        return `
            <tr class="${rowClass}">
                <td><strong>${venda.numero_nf}</strong></td>
                <td style="white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                <td><span class="badge badge-vendedor">${venda.vendedor}</span></td>
                <td>${venda.nome_orgao}</td>
                <td><strong>${formatCurrency(venda.valor_nf)}</strong></td>
                <td>
                    <span class="badge ${statusClass}">${status.replace(/_/g, ' ')}</span>
                </td>
                <td class="actions-cell">
                    <div class="actions">
                        <button onclick="viewVenda('${venda.id}')" class="action-btn view" title="Ver detalhes">Ver</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatus(venda) {
    if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
        return 'PAGO';
    }
    if (venda.origem === 'CONTROLE_FRETE') {
        return venda.status_frete || 'EM_TRANSITO';
    }
    return 'EM_TRANSITO';
}

function viewVenda(id) {
    const venda = allVendas.find(v => v.id === id);
    if (!venda) return;
    
    const nfElem = document.getElementById('modalNumeroNF');
    if (nfElem) nfElem.textContent = venda.numero_nf;
    
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;
    
    if (venda.origem === 'CONTAS_RECEBER') {
        modalBody.innerHTML = `
            <div class="info-section">
                <h4>Informações da Conta</h4>
                <p><strong>Número NF:</strong> ${venda.numero_nf}</p>
                <p><strong>Vendedor:</strong> <span class="badge badge-vendedor">${venda.vendedor}</span></p>
                <p><strong>Órgão:</strong> ${venda.nome_orgao}</p>
                <p><strong>Valor:</strong> ${formatCurrency(venda.valor_nf)}</p>
                <p><strong>Data Emissão:</strong> ${formatDate(venda.data_emissao)}</p>
                <p><strong>Data Vencimento:</strong> ${formatDate(venda.data_vencimento)}</p>
                <p><strong>Data Pagamento:</strong> ${venda.data_pagamento ? formatDate(venda.data_pagamento) : '-'}</p>
                <p><strong>Banco:</strong> ${venda.banco || '-'}</p>
                <p><strong>Status:</strong> <span class="badge pago">${venda.status_pagamento}</span></p>
                ${venda.observacoes ? `<p><strong>Observações:</strong> ${venda.observacoes}</p>` : ''}
            </div>
        `;
    } else {
        modalBody.innerHTML = `
            <div class="info-section">
                <h4>Informações do Frete</h4>
                <p><strong>Número NF:</strong> ${venda.numero_nf}</p>
                <p><strong>Vendedor:</strong> <span class="badge badge-vendedor">${venda.vendedor}</span></p>
                <p><strong>Órgão:</strong> ${venda.nome_orgao}</p>
                <p><strong>Valor NF:</strong> ${formatCurrency(venda.valor_nf)}</p>
                <p><strong>Data Emissão:</strong> ${formatDate(venda.data_emissao)}</p>
                ${venda.documento ? `<p><strong>Documento:</strong> ${venda.documento}</p>` : ''}
                ${venda.contato_orgao ? `<p><strong>Contato:</strong> ${venda.contato_orgao}</p>` : ''}
                <p><strong>Transportadora:</strong> ${venda.transportadora || '-'}</p>
                <p><strong>Valor Frete:</strong> ${formatCurrency(venda.valor_frete)}</p>
                ${venda.data_coleta ? `<p><strong>Data Coleta:</strong> ${formatDate(venda.data_coleta)}</p>` : ''}
                ${venda.cidade_destino ? `<p><strong>Cidade Destino:</strong> ${venda.cidade_destino}</p>` : ''}
                ${venda.previsao_entrega ? `<p><strong>Previsão Entrega:</strong> ${formatDate(venda.previsao_entrega)}</p>` : ''}
                <p><strong>Status:</strong> <span class="badge entregue">${venda.status_frete}</span></p>
            </div>
        `;
    }
    
    const modal = document.getElementById('infoModal');
    if (modal) modal.classList.add('show');
}

function closeInfoModal() {
    const modal = document.getElementById('infoModal');
    if (modal) modal.classList.remove('show');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
    if (!value) return 'R$ 0,00';
    const num = parseFloat(value);
    return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function showToast(message, type = 'success') {
    const oldMessages = document.querySelectorAll('.floating-message');
    oldMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOutBottom 0.3s ease forwards';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}
    <div class="app-content" id="mainView">
        <div class="container">
            <div class="header">
                <div class="header-left">
                    <h1>Vendas Isaque</h1>
                    <div id="connectionStatus" class="connection-status offline">
                        <span class="status-dot"></span>
                    </div>
                </div>
            </div>

            <!-- Dashboard Cards -->
            <div class="dashboard-grid">
                <div class="stat-card stat-card-success">
                    <div class="stat-icon stat-icon-success">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value stat-value-success" id="totalPago">R$ 0,00</div>
                        <div class="stat-label">Pago</div>
                    </div>
                </div>
                <div class="stat-card stat-card-warning">
                    <div class="stat-icon stat-icon-warning">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value stat-value-warning" id="totalAReceber">R$ 0,00</div>
                        <div class="stat-label">A Receber</div>
                    </div>
                </div>
                <div class="stat-card stat-card-info">
                    <div class="stat-icon stat-icon-info">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <polyline points="17 11 19 13 23 9"></polyline>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value stat-value-info" id="totalEntregue">0</div>
                        <div class="stat-label">Entregue</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon stat-icon-default">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value" id="totalFaturado">R$ 0,00</div>
                        <div class="stat-label">Faturado</div>
                    </div>
                </div>
            </div>

            <!-- Search Bar -->
            <div class="search-bar-wrapper">
                <div class="search-bar">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input type="text" id="search" placeholder="Pesquisar por NF, órgão..." oninput="filterVendas()">
                    
                    <div class="search-bar-filters">
                        <div class="filter-dropdown-inline">
                            <select id="filterStatus" onchange="filterVendas()">
                                <option value="">Todos os Status</option>
                                <option value="PAGO">Pago</option>
                                <option value="ENTREGUE">Entregue</option>
                                <option value="EM TRÂNSITO">Em Trânsito</option>
                                <option value="SIMPLES REMESSA">Simples Remessa</option>
                                <option value="REMESSA DE AMOSTRA">Remessa de Amostra</option>
                            </select>
                            <svg class="dropdown-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                        <div class="month-navigation-inline">
                            <button onclick="changeMonth(-1)" class="month-nav-arrow" title="Mês anterior">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <div class="month-display-inline">
                                <span id="currentMonth">Carregando...</span>
                            </div>
                            <button onclick="changeMonth(1)" class="month-nav-arrow" title="Próximo mês">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <button class="calendar-btn" onclick="toggleCalendar()" title="Selecionar mês">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </button>
                    <button class="calendar-btn" onclick="syncData()" title="Sincronizar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                    </button>
                    <button class="calendar-btn" onclick="toggleRelatorioMes()" title="Relatório Mês">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Calendar Modal -->
            <div class="calendar-modal" id="calendarModal">
                <div class="calendar-content">
                    <div class="calendar-header">
                        <button onclick="changeCalendarYear(-1)" class="calendar-year-nav">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                        <h3 id="calendarYear">2026</h3>
                        <button onclick="changeCalendarYear(1)" class="calendar-year-nav">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    </div>
                    <div class="calendar-months" id="calendarMonths"></div>
                </div>
            </div>

            <!-- Table Card (SEM COLUNA TIPO) -->
            <div class="card table-card">
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Nº NF</th>
                                <th>Data Emissão</th>
                                <th>Órgão</th>
                                <th>Valor NF</th>
                                <th>Status</th>
                                <th style="text-align: center;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="vendasContainer"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL DE RELATÓRIO MÊS -->
    <div class="modal-overlay" id="relatorioModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title" id="relatorioModalTitulo">Relatório Mês</h3>
                <button class="close-modal" onclick="closeRelatorioModal()">✕</button>
            </div>
            
            <div class="modal-body" id="relatorioModalBody"></div>

            <div class="modal-actions">
                <button type="button" onclick="closeRelatorioModal()" class="secondary">Fechar</button>
            </div>
        </div>
    </div>

    <!-- MODAL DE VISUALIZAÇÃO -->
    <div class="modal-overlay" id="infoModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">NF Nº <span id="modalNumeroNF"></span></h3>
                <button class="close-modal" onclick="closeInfoModal()">✕</button>
            </div>
            
            <div class="modal-body" id="modalBody"></div>

            <div class="modal-actions">
                <button type="button" onclick="closeInfoModal()" class="secondary">Fechar</button>
            </div>
        </div>
    </div>

    <script>
        setTimeout(() => {
            const splash = document.getElementById('splashScreen');
            if (splash) splash.style.display = 'none';
        }, 3000);
    </script>
    <script src="script.js"></script>
</body>
</html>
