// ============================================
// CONFIGURAÇÃO
// ============================================
const DEVELOPMENT_MODE = false; // PRODUÇÃO
const API_URL = window.location.origin + '/api';
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';

let isOnline = false;
let lastDataHash = '';
let currentMonth = new Date();
let allVendas = [];
let sessionToken = null;
let calendarYear = new Date().getFullYear();
let currentVendedorModal = 'ROBERTO';

console.log('🚀 Vendas Consolidada iniciada');
console.log('📍 API URL:', API_URL);
console.log('🔧 Modo desenvolvimento:', DEVELOPMENT_MODE);

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DESENVOLVIMENTO');
        sessionToken = 'dev-mode';
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        sessionToken = urlParams.get('sessionToken') || sessionStorage.getItem('vendasSession');
        
        if (!sessionToken) {
            console.log('⚠️ Sem token de sessão - continuando sem autenticação');
            sessionToken = 'no-auth'; // Continua mesmo sem token
        }
        
        if (urlParams.get('sessionToken')) {
            sessionStorage.setItem('vendasSession', sessionToken);
        }
    }
    
    inicializarApp();
});

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

// ============================================
// MODAL VALOR PAGO POR MÊS COM NAVEGAÇÃO DE VENDEDORES
// ============================================
window.showValorPagoModal = function() {
    const modal = document.getElementById('valorPagoModal');
    if (!modal) return;
    
    renderValorPagoModal();
    modal.style.display = 'flex';
};

window.closeValorPagoModal = function() {
    const modal = document.getElementById('valorPagoModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

function renderValorPagoModal() {
    const bodyElem = document.getElementById('valorPagoModalBody');
    if (!bodyElem) return;
    
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    // Calcular valores pagos por mês para o vendedor atual
    const dadosPorMes = {};
    
    monthNames.forEach((_, idx) => {
        dadosPorMes[idx] = { valor: 0, comissao: 0 };
    });
    
    allVendas.forEach(v => {
        if (v.origem !== 'CONTAS_RECEBER' || !v.data_pagamento) return;
        if (v.vendedor !== currentVendedorModal) return;
        
        const dataPagamento = new Date(v.data_pagamento + 'T00:00:00');
        const ano = dataPagamento.getFullYear();
        
        // Apenas considerar o ano atual do modal (ano do mês selecionado)
        if (ano !== currentMonth.getFullYear()) return;
        
        const mes = dataPagamento.getMonth();
        const valor = parseFloat(v.valor_nf) || 0;
        dadosPorMes[mes].valor += valor;
        dadosPorMes[mes].comissao = dadosPorMes[mes].valor * 0.01; // 1% de comissão
    });
    
    // HTML da navegação de vendedores e grid de meses
    const vendedores = ['ROBERTO', 'ISAQUE', 'MIGUEL'];
    const currentIndex = vendedores.indexOf(currentVendedorModal);
    const prevVendedor = vendedores[(currentIndex - 1 + vendedores.length) % vendedores.length];
    const nextVendedor = vendedores[(currentIndex + 1) % vendedores.length];
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding: 0 1rem;">
            <button onclick="changeVendedorModal('${prevVendedor}')" 
                    style="background: none; border: none; color: #CC7000; font-size: 2rem; cursor: pointer; padding: 0.5rem;"
                    title="Vendedor anterior">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
            
            <h2 style="color: #CC7000; font-size: 1.8rem; font-weight: 700; margin: 0;">${currentVendedorModal}</h2>
            
            <button onclick="changeVendedorModal('${nextVendedor}')" 
                    style="background: none; border: none; color: #CC7000; font-size: 2rem; cursor: pointer; padding: 0.5rem;"
                    title="Próximo vendedor">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>
        </div>
        
        <div class="month-cards-grid">
    `;
    
    // Primeira linha - Jan a Jun
    monthNames.slice(0, 6).forEach((nome, idx) => {
        const dados = dadosPorMes[idx];
        const temValor = dados.valor > 0;
        
        html += `
            <div class="month-card ${!temValor ? 'empty' : ''}">
                <div class="month-name">${nome.substring(0, 3).toUpperCase()}</div>
                <div class="month-values">
                    <div class="valor-total">${formatCurrency(dados.valor)}</div>
                    <div class="valor-secundario">${formatCurrency(dados.comissao)}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div><div class="month-cards-grid">';
    
    // Segunda linha - Jul a Dez
    monthNames.slice(6, 12).forEach((nome, idx) => {
        const dados = dadosPorMes[idx + 6];
        const temValor = dados.valor > 0;
        
        html += `
            <div class="month-card ${!temValor ? 'empty' : ''}">
                <div class="month-name">${nome.substring(0, 3).toUpperCase()}</div>
                <div class="month-values">
                    <div class="valor-total">${formatCurrency(dados.valor)}</div>
                    <div class="valor-secundario">${formatCurrency(dados.comissao)}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Totais
    const totalAnual = Object.values(dadosPorMes).reduce((sum, d) => sum + d.valor, 0);
    const comissaoAnual = totalAnual * 0.01;
    
    html += `
        <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid rgba(204, 112, 0, 0.3);">
            <div style="display: flex; justify-content: space-between; gap: 1rem;">
                <div style="flex: 1; padding: 1.5rem; background: rgba(204, 112, 0, 0.1); border-radius: 12px; border: 2px solid rgba(204, 112, 0, 0.3);">
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px;">Valor Total</div>
                    <div style="font-size: 2rem; font-weight: 700; color: #CC7000;">${formatCurrency(totalAnual)}</div>
                </div>
                <div style="flex: 1; padding: 1.5rem; background: rgba(34, 197, 94, 0.1); border-radius: 12px; border: 2px solid rgba(34, 197, 94, 0.3);">
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px;">Comissão Total</div>
                    <div style="font-size: 2rem; font-weight: 700; color: #22C55E;">${formatCurrency(comissaoAnual)}</div>
                </div>
            </div>
        </div>
    `;
    
    bodyElem.innerHTML = html;
}

window.changeVendedorModal = function(novoVendedor) {
    currentVendedorModal = novoVendedor;
    renderValorPagoModal();
};

// ============================================
// GERAR PDF
// ============================================
window.gerarPDF = function() {
    const filterVendedor = document.getElementById('filterVendedor');
    const vendedorSelecionado = filterVendedor ? filterVendedor.value : '';
    
    if (!vendedorSelecionado) {
        showToast('Selecione um Vendedor para gerar o PDF', 'error');
        return;
    }
    
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    // Filtrar vendas pagas do vendedor selecionado no mês atual
    const vendasPagas = allVendas.filter(v => {
        if (v.origem !== 'CONTAS_RECEBER' || !v.data_pagamento) return false;
        if (v.vendedor !== vendedorSelecionado) return false;
        
        const dataPagamento = new Date(v.data_pagamento + 'T00:00:00');
        return dataPagamento.getMonth() === currentMonth.getMonth() && 
               dataPagamento.getFullYear() === currentMonth.getFullYear();
    });
    
    if (vendasPagas.length === 0) {
        showToast('Nenhum pagamento encontrado para este vendedor e mês', 'error');
        return;
    }
    
    // Criar PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('RELATÓRIO DE PAGAMENTOS', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Vendedor: ${vendedorSelecionado}`, 105, 30, { align: 'center' });
    doc.text(`Período: ${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`, 105, 37, { align: 'center' });
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, 44, { align: 'center' });
    
    // Preparar dados da tabela
    const tableData = vendasPagas.map(v => [
        v.numero_nf,
        formatDate(v.data_emissao),
        formatDate(v.data_pagamento),
        formatCurrency(v.valor_nf)
    ]);
    
    // Calcular total
    const totalPago = vendasPagas.reduce((sum, v) => sum + (parseFloat(v.valor_nf) || 0), 0);
    
    // Adicionar tabela
    doc.autoTable({
        startY: 55,
        head: [['NF', 'Emissão', 'Data Pagamento', 'Valor']],
        body: tableData,
        foot: [['', '', '', 'TOTAL:', formatCurrency(totalPago)]],
        theme: 'grid',
        headStyles: {
            fillColor: [100, 100, 100],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        footStyles: {
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'right'
        },
        styles: {
            fontSize: 10,
            cellPadding: 3
        },
        columnStyles: {
            0: { halign: 'center' },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'right' }
        }
    });
    
    // Salvar PDF
    const fileName = `Pagamentos_${vendedorSelecionado}_${monthNames[currentMonth.getMonth()]}_${currentMonth.getFullYear()}.pdf`;
    doc.save(fileName);
    
    showToast('PDF gerado com sucesso!', 'success');
};

// ============================================
// FUNÇÕES DE SINCRONIZAÇÃO E CARREGAMENTO
// ============================================
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/health`, { 
            method: 'GET',
            mode: 'cors'
        });
        
        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        const statusElem = document.getElementById('connectionStatus');
        if (statusElem) {
            if (isOnline) {
                statusElem.classList.remove('offline');
                statusElem.classList.add('online');
            } else {
                statusElem.classList.remove('online');
                statusElem.classList.add('offline');
            }
        }
        
        if (wasOffline && isOnline) {
            console.log('✅ Conexão restaurada');
            await loadVendas();
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status do servidor:', error);
        isOnline = false;
        const statusElem = document.getElementById('connectionStatus');
        if (statusElem) {
            statusElem.classList.remove('online');
            statusElem.classList.add('offline');
        }
    }
}

async function loadVendas() {
    try {
        console.log('🔄 Carregando vendas...');
        
        const response = await fetch(`${API_URL}/vendas-consolidadas`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ ${data.length} vendas carregadas`);
        
        const newHash = JSON.stringify(data.map(v => v.id));
        
        if (newHash !== lastDataHash) {
            allVendas = data;
            lastDataHash = newHash;
            updateDisplay();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
        showToast('Erro ao carregar dados', 'error');
    }
}

function syncData() {
    loadVendas();
    showToast('Sincronizando dados...', 'success');
}

function updateDisplay() {
    loadDashboard();
    updateTable();
}

function loadDashboard() {
    let monthVendas = allVendas.filter(v => {
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        return dataEmissao.getMonth() === currentMonth.getMonth() && 
               dataEmissao.getFullYear() === currentMonth.getFullYear();
    });
    
    let totalPago = 0;
    let totalAReceber = 0;
    let totalEntregue = 0;
    let totalFaturado = 0;
    
    monthVendas.forEach(v => {
        const valor = parseFloat(v.valor_nf) || 0;
        totalFaturado += valor;
        
        if (v.origem === 'CONTAS_RECEBER' && v.data_pagamento) {
            totalPago += valor;
        } else if (v.origem === 'CONTAS_RECEBER' && !v.data_pagamento) {
            totalAReceber += valor;
        }
        
        if (v.origem === 'CONTROLE_FRETE' && v.status_frete === 'ENTREGUE') {
            totalEntregue++;
        } else if (v.origem === 'CONTAS_RECEBER' && v.data_pagamento) {
            totalEntregue++;
        }
    });
    
    document.getElementById('totalPago').textContent = formatCurrency(totalPago);
    document.getElementById('totalAReceber').textContent = formatCurrency(totalAReceber);
    document.getElementById('totalEntregue').textContent = totalEntregue;
    document.getElementById('totalFaturado').textContent = formatCurrency(totalFaturado);
}

// ============================================
// RENDERIZAÇÃO DA TABELA (IGUAL AO CONTROLE DE FRETE)
// ============================================
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
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma venda encontrada</div>';
        return;
    }
    
    // Renderizar tabela igual ao Controle de Frete
    const table = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>NF</th>
                        <th>Emissão</th>
                        <th>Vendedor</th>
                        <th>Órgão</th>
                        <th>Valor NF</th>
                        <th>Status</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredVendas.map(venda => {
                        const status = getStatus(venda);
                        const statusInfo = getStatusInfo(status);
                        const rowClass = statusInfo.rowClass;
                        
                        return `
                        <tr class="${rowClass}">
                            <td><strong>${venda.numero_nf}</strong></td>
                            <td style="white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                            <td><span class="badge badge-vendedor">${venda.vendedor}</span></td>
                            <td style="max-width: 200px; word-wrap: break-word; white-space: normal;">${venda.nome_orgao}</td>
                            <td><strong>${formatCurrency(venda.valor_nf)}</strong></td>
                            <td>${getStatusBadge(status)}</td>
                            <td class="actions-cell" style="text-align: center; white-space: nowrap;">
                                <button class="action-btn view" onclick="viewVenda('${venda.id}')" title="Ver detalhes">Ver</button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = table;
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

function getStatusInfo(status) {
    const statusMap = {
        'PAGO': { rowClass: 'row-pago' },
        'ENTREGUE': { rowClass: 'row-entregue' },
        'EM_TRANSITO': { rowClass: '' },
        'AGUARDANDO_COLETA': { rowClass: '' },
        'EXTRAVIADO': { rowClass: '' },
        'DEVOLVIDO': { rowClass: '' }
    };
    
    return statusMap[status] || { rowClass: '' };
}

function getStatusBadge(status) {
    const statusMap = {
        'PAGO': { class: 'pago', text: 'PAGO' },
        'ENTREGUE': { class: 'entregue', text: 'ENTREGUE' },
        'EM_TRANSITO': { class: 'transito', text: 'EM TRÂNSITO' },
        'AGUARDANDO_COLETA': { class: 'aguardando', text: 'AGUARDANDO COLETA' },
        'EXTRAVIADO': { class: 'extraviado', text: 'EXTRAVIADO' },
        'DEVOLVIDO': { class: 'devolvido', text: 'DEVOLVIDO' },
        'SIMPLES_REMESSA': { class: 'badge-especial', text: 'SIMPLES REMESSA' },
        'REMESSA_AMOSTRA': { class: 'badge-especial', text: 'REMESSA DE AMOSTRA' }
    };
    
    const s = statusMap[status] || { class: 'transito', text: status.replace(/_/g, ' ') };
    return `<span class="badge ${s.class}">${s.text}</span>`;
}

function filterVendas() {
    updateDisplay();
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
    if (!dateString || dateString === '-') return '-';
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
