require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURAÇÃO DO SUPABASE
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase configurado:', supabaseUrl);

// MIDDLEWARES
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições
app.use((req, res, next) => {
    console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// AUTENTICAÇÃO
const PORTAL_URL = process.env.PORTAL_URL || 'https://ir-comercio-portal-zcan.onrender.com';

async function verificarAutenticacao(req, res, next) {
    const publicPaths = ['/', '/health'];
    if (publicPaths.includes(req.path)) {
        return next();
    }

    const sessionToken = req.headers['x-session-token'];

    if (!sessionToken) {
        return res.status(401).json({
            error: 'Não autenticado',
            message: 'Token de sessão não encontrado'
        });
    }

    try {
        const verifyResponse = await fetch(`${PORTAL_URL}/api/verify-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken })
        });

        if (!verifyResponse.ok) {
            return res.status(401).json({
                error: 'Sessão inválida',
                message: 'Sua sessão expirou'
            });
        }

        const sessionData = await verifyResponse.json();

        if (!sessionData.valid) {
            return res.status(401).json({
                error: 'Sessão inválida',
                message: sessionData.message || 'Sua sessão expirou'
            });
        }

        req.user = sessionData.session;
        req.sessionToken = sessionToken;
        next();
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
        return res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao verificar autenticação'
        });
    }
}

// SERVIR ARQUIVOS ESTÁTICOS
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// HEALTH CHECK
app.get('/health', async (req, res) => {
    try {
        const { error } = await supabase
            .from('vendas')
            .select('count', { count: 'exact', head: true });
        
        res.json({
            status: error ? 'unhealthy' : 'healthy',
            database: error ? 'disconnected' : 'connected',
            timestamp: new Date().toISOString(),
            service: 'Vendas API'
        });
    } catch (error) {
        res.json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ROTAS DA API
app.use('/api', verificarAutenticacao);

// GET - Buscar todas as vendas (com filtro por vendedor)
app.get('/api/vendas', async (req, res) => {
    try {
        const username = req.user?.username?.toLowerCase();
        
        // Administradores veem tudo
        const isAdmin = username === 'roberto' || username === 'rosemeire';

        let query = supabase
            .from('vendas')
            .select('*')
            .order('data_entrega', { ascending: false });

        // Filtrar por vendedor se não for admin
        if (!isAdmin) {
            const vendedorMap = {
                'vendas': 'ISAQUE',
                'vendas2': 'MIGUEL'
            };
            const vendedor = vendedorMap[username] || username.toUpperCase();
            query = query.eq('vendedor', vendedor);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar vendas:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar vendas',
            details: error.message 
        });
    }
});

// GET - Sincronizar notas entregues do Controle de Frete
app.get('/api/sync-entregas', async (req, res) => {
    try {
        console.log('🔄 Sincronizando entregas do Controle de Frete...');

        // Buscar notas entregues do controle frete
        const { data: fretesEntregues, error: freteError } = await supabase
            .from('controle frete')
            .select('*')
            .eq('status', 'ENTREGUE');

        if (freteError) {
            console.error('Erro ao buscar fretes:', freteError);
            throw freteError;
        }

        if (!fretesEntregues || fretesEntregues.length === 0) {
            return res.json({ 
                message: 'Nenhuma entrega nova encontrada',
                synced: 0 
            });
        }

        console.log(`${fretesEntregues.length} fretes entregues encontrados`);

        // Buscar notas já sincronizadas
        const { data: vendasExistentes, error: vendasError } = await supabase
            .from('vendas')
            .select('numero_nf');

        if (vendasError) {
            console.error('Erro ao buscar vendas existentes:', vendasError);
            throw vendasError;
        }

        const nfsExistentes = new Set(vendasExistentes?.map(v => v.numero_nf) || []);
        console.log(`${nfsExistentes.size} notas já existem em vendas`);

        // Filtrar apenas novas entregas
        const novasEntregas = fretesEntregues.filter(f => !nfsExistentes.has(f.numero_nf));

        if (novasEntregas.length === 0) {
            return res.json({ 
                message: 'Todas as entregas já estão sincronizadas',
                synced: 0 
            });
        }

        console.log(`${novasEntregas.length} novas entregas para sincronizar`);

        // Buscar status de pagamento do contas receber
        const { data: contasReceber, error: contasError } = await supabase
            .from('contas receber')
            .select('numero_nf, status, data_pagamento');

        if (contasError) {
            console.error('Erro ao buscar contas receber:', contasError);
            throw contasError;
        }

        const pagamentosMap = new Map();
        contasReceber?.forEach(c => {
            pagamentosMap.set(c.numero_nf, {
                pago: c.status === 'PAGO',
                data_pagamento: c.data_pagamento
            });
        });

        // Inserir novas vendas
        const vendasParaInserir = novasEntregas.map(frete => {
            const pagamento = pagamentosMap.get(frete.numero_nf) || { pago: false, data_pagamento: null };
            
            return {
                numero_nf: frete.numero_nf,
                vendedor: frete.vendedor,
                valor_nf: parseFloat(frete.valor_nf),
                data_emissao: frete.data_emissao,
                data_entrega: frete.previsao_entrega,
                nome_orgao: frete.nome_orgao,
                cidade_destino: frete.cidade_destino,
                status_pagamento: pagamento.pago,
                data_pagamento: pagamento.data_pagamento
            };
        });

        console.log('Inserindo vendas:', vendasParaInserir);

        const { data: inserted, error: insertError } = await supabase
            .from('vendas')
            .insert(vendasParaInserir)
            .select();

        if (insertError) {
            console.error('Erro ao inserir vendas:', insertError);
            throw insertError;
        }

        console.log(`✅ ${inserted.length} novas vendas sincronizadas`);
        res.json({ 
            message: 'Sincronização concluída',
            synced: inserted.length,
            data: inserted
        });

    } catch (error) {
        console.error('❌ Erro ao sincronizar entregas:', error);
        res.status(500).json({ 
            error: 'Erro ao sincronizar entregas',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// GET - Atualizar status de pagamento do Contas a Receber
app.get('/api/sync-pagamentos', async (req, res) => {
    try {
        console.log('🔄 Sincronizando pagamentos do Contas a Receber...');

        // Buscar todas as vendas
        const { data: vendas, error: vendasError } = await supabase
            .from('vendas')
            .select('*');

        if (vendasError) throw vendasError;

        if (!vendas || vendas.length === 0) {
            return res.json({ 
                message: 'Nenhuma venda para atualizar',
                updated: 0 
            });
        }

        // Buscar status de pagamento
        const { data: contasReceber, error: contasError } = await supabase
            .from('contas receber')
            .select('numero_nf, status, data_pagamento');

        if (contasError) throw contasError;

        const pagamentosMap = new Map();
        contasReceber?.forEach(c => {
            pagamentosMap.set(c.numero_nf, {
                pago: c.status === 'PAGO',
                data_pagamento: c.data_pagamento
            });
        });

        // Atualizar vendas que mudaram de status
        let updated = 0;
        for (const venda of vendas) {
            const pagamento = pagamentosMap.get(venda.numero_nf);
            
            if (pagamento && venda.status_pagamento !== pagamento.pago) {
                const { error: updateError } = await supabase
                    .from('vendas')
                    .update({
                        status_pagamento: pagamento.pago,
                        data_pagamento: pagamento.data_pagamento
                    })
                    .eq('id', venda.id);

                if (!updateError) updated++;
            }
        }

        console.log(`✅ ${updated} vendas atualizadas`);
        res.json({ 
            message: 'Sincronização de pagamentos concluída',
            updated 
        });

    } catch (error) {
        console.error('❌ Erro ao sincronizar pagamentos:', error);
        res.status(500).json({ 
            error: 'Erro ao sincronizar pagamentos',
            details: error.message 
        });
    }
});

// ROTA PRINCIPAL
app.get('/', (req, res) => {
    res.json({ 
        status: 'online',
        service: 'Vendas API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ROTA 404
app.use((req, res) => {
    res.status(404).json({
        error: '404 - Rota não encontrada',
        path: req.path
    });
});

// TRATAMENTO DE ERROS
app.use((error, req, res, next) => {
    console.error('💥 Erro no servidor:', error);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
    });
});

// INICIAR SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 ================================');
    console.log(`🚀 Vendas API v1.0.0`);
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔗 Supabase URL: ${supabaseUrl}`);
    console.log(`📁 Public folder: ${publicPath}`);
    console.log(`🔐 Autenticação: Ativa`);
    console.log(`🌐 Portal URL: ${PORTAL_URL}`);
    console.log('🚀 ================================\n');
});
