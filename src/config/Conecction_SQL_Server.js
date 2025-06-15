const sql = require('mssql');
const winston = require('winston');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// DEPURACIÓN: Mostrar variables cargadas
console.log('[DEBUG] Variables de entorno cargadas:');
console.log(`DB_SERVER: ${process.env.DB_SERVER}`);
console.log(`DB_NAME: ${process.env.DB_NAME}`);
console.log(`DB_USER: ${process.env.DB_USER}`);
console.log(`DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' : 'undefined'}`);

// Validación mejorada
const requiredVars = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    const errorMsg = `Faltan variables de entorno: ${missingVars.join(', ')}`;
    console.error('[ERROR] ' + errorMsg);
    throw new Error(errorMsg);
}

// Configuración de conexión
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        //instanceName: 'SQLEXPRESS'
    }
};

console.log('[DEBUG] Configuración de conexión:', {
    ...dbConfig,
    password: '***' // No mostrar contraseña real
});

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/database.log' })
    ]
});

// Pool de conexiones
let pool;
let poolConnect;

async function getConnection() {
    if (pool) {
        return pool;
    }

    try {
        pool = new sql.ConnectionPool(dbConfig);
        poolConnect = pool.connect();
        await poolConnect;
        logger.info('Conexión a SQL Server establecida');
        return pool;
    } catch (err) {
        logger.error('Error de conexión:', err);
        throw new Error(`Error al conectar a SQL Server: ${err.message}`);
    }
}

async function closePool() {
    if (pool) {
        await pool.close();
        logger.info('Conexión cerrada');
        pool = null;
    }
}

module.exports = {
    getConnection,
    closePool,
    sql
};