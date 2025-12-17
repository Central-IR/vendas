require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('🚀 Servidor Vendas - Miguel iniciado');

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================
async function verificarAutenticacao(req, res, next) {
    const sessionToken = req.headers['x-session-token'];
    
    if (!sessionToken) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const response = await fetch(`${process.env.PORTAL_URL}/api/verify-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionToken })
        });

        if (!response.ok) {
            return res.status(401).json({ error: 'Sessão inválida' });
        }

        const userData = await response.json();
        req.user = userData;
        next();
    } catch (error) {
        console.error('❌ Erro na autenticação:', error);
        res.status(401).json({ error: 'Erro ao verificar sessão' });
    }
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', async (req, res) => {
    try {
        const { error } = await supabase
            .from('controle_frete')
            .select('count', { count: 'exact', head: true });
        
        res.json({
            status: error ? 'unhealthy' : 'healthy',
            database: error ? 'disconnected' : 'connected',
            timestamp: new Date().toISOString(),
            service: 'Vendas Miguel API'
        });
    } catch (error) {
        res.json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// ROTAS DA API
// ============================================
app.use('/api', verificarAutenticacao);

// STATUS (simples check)
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok' });
});

// GET - ENTREGAS (Controle de Frete)
app.get('/api/entregas', async (req, res) => {
    try {
        const vendedor = req.query.vendedor;
        
        console.log(`📦 Buscando entregas do vendedor: ${vendedor}`);

        let query = supabase
            .from('controle_frete')
            .select('*')
            .eq('status', 'ENTREGUE')
            .order('previsao_entrega', { ascending: false });

        if (vendedor) {
            query = query.eq('vendedor', vendedor);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Erro ao buscar entregas:', error);
            throw error;
        }

        console.log(`✅ ${data.length} entregas encontradas`);
        res.json(data);

    } catch (error) {
        console.error('❌ Erro ao buscar entregas:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar entregas',
            details: error.message 
        });
    }
});

// GET - LIQUIDADAS (Contas a Receber)
app.get('/api/liquidadas', async (req, res) => {
    try {
        const vendedor = req.query.vendedor;
        
        console.log(`💰 Buscando liquidações do vendedor: ${vendedor}`);

        let query = supabase
            .from('contas_receber')
            .select('*')
            .eq('status', 'PAGO')
            .order('data_pagamento', { ascending: false });

        if (vendedor) {
            query = query.eq('vendedor', vendedor);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Erro ao buscar liquidadas:', error);
            throw error;
        }

        console.log(`✅ ${data.length} notas liquidadas encontradas`);
        res.json(data);

    } catch (error) {
        console.error('❌ Erro ao buscar liquidadas:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar liquidadas',
            details: error.message 
        });
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
});
