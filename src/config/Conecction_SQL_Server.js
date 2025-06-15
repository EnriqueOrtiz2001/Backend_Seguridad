const sql = require('mssql');
const winston = require('winston');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Validación de variables de entorno
const requiredVars = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME', 'SECRET_KEY'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missingVars.join(', ')}`);
}

// Configuración de conexión mejorada
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,  // Puerto explícito
    options: {
        encrypt: true,
        trustServerCertificate: true,
        // instanceName: 'SQLEXPRESS'  // Comenta si usas IP directa
    }
};

// Logger mejorado
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ 
            filename: 'logs/database-error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'logs/database.log' 
        })
    ]
});

// Pool de conexiones
let pool;
let isConnecting = false;

// Función para probar conectividad antes de crear el pool
async function testConnectivity() {
    const testConfig = {
        ...dbConfig,
        options: {
            ...dbConfig.options,
            connectTimeout: 10000, // Solo 10 segundos para prueba rápida
        }
    };
    
    try {
        const testPool = new sql.ConnectionPool(testConfig);
        await testPool.connect();
        logger.info('✓ Prueba de conectividad exitosa');
        await testPool.close();
        return true;
    } catch (error) {
        logger.error('✗ Prueba de conectividad falló:', error.message);
        return false;
    }
}

// Función mejorada para obtener conexión con reintentos
async function getConnection(retries = 3) {
    if (pool && pool.connected) {
        return pool;
    }

    if (isConnecting) {
        // Si ya se está conectando, esperar un poco y reintentar
        await new Promise(resolve => setTimeout(resolve, 1000));
        return getConnection(retries);
    }

    isConnecting = true;

    try {
        logger.info(`Intentando conectar a SQL Server (${retries} intentos restantes)...`);
        logger.info(`Servidor: ${dbConfig.server}\\${dbConfig.options.instanceName}`);
        logger.info(`Base de datos: ${dbConfig.database}`);
        logger.info(`Usuario: ${dbConfig.user}`);
        logger.info(`Puerto: ${dbConfig.port}`);

        // Primero probar conectividad básica
        const canConnect = await testConnectivity();
        if (!canConnect && retries > 1) {
            logger.warn('Conectividad falló, reintentando...');
            isConnecting = false;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
            return getConnection(retries - 1);
        }

        if (pool) {
            try {
                await pool.close();
            } catch (closeError) {
                logger.warn('Error cerrando pool anterior:', closeError.message);
            }
        }

        pool = new sql.ConnectionPool(dbConfig);
        
        // Eventos del pool para monitoreo
        pool.on('connect', () => {
            logger.info('✓ Conexión establecida al pool');
        });

        pool.on('error', (error) => {
            logger.error('Error en el pool de conexiones:', error);
        });

        const connectionPromise = pool.connect();
        
        // Timeout personalizado con Promise.race
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Timeout de conexión personalizado (60s)'));
            }, 60000);
        });

        await Promise.race([connectionPromise, timeoutPromise]);
        
        logger.info('✓ Conexión a SQL Server establecida exitosamente');
        
        // Probar con una consulta simple
        await pool.request().query('SELECT 1 as test');
        logger.info('✓ Consulta de prueba exitosa');
        
        isConnecting = false;
        return pool;

    } catch (err) {
        isConnecting = false;
        logger.error(`Error de conexión (intento ${4-retries}):`, {
            message: err.message,
            code: err.code,
            server: dbConfig.server,
            instance: dbConfig.options.instanceName,
            port: dbConfig.port
        });

        if (retries > 1) {
            logger.info(`Reintentando en 3 segundos... (${retries-1} intentos restantes)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return getConnection(retries - 1);
        }

        // Sugerencias de troubleshooting
        const suggestions = [
            '1. Verificar que SQL Server esté ejecutándose',
            '2. Confirmar que SQL Server Browser esté habilitado',
            '3. Verificar configuración de red y firewall',
            '4. Confirmar que TCP/IP esté habilitado en SQL Server',
            '5. Verificar puerto 1433 o puerto dinámico de SQLEXPRESS',
            '6. Confirmar que la instancia SQLEXPRESS esté corriendo',
            '7. Probar conexión con SQL Server Management Studio'
        ];

        logger.error('Sugerencias para resolver el problema:');
        suggestions.forEach(suggestion => logger.error(suggestion));

        throw new Error(`Error al conectar a SQL Server después de ${3} intentos: ${err.message}`);
    }
}

// Función para verificar estado de conexión
async function checkConnection() {
    try {
        if (!pool || !pool.connected) {
            return { connected: false, message: 'No hay pool o no está conectado' };
        }
        
        await pool.request().query('SELECT 1');
        return { connected: true, message: 'Conexión activa' };
    } catch (error) {
        return { connected: false, message: error.message };
    }
}

// Función mejorada para cerrar pool
async function closePool() {
    if (pool) {
        try {
            await pool.close();
            logger.info('✓ Conexión cerrada correctamente');
        } catch (error) {
            logger.error('Error cerrando conexión:', error.message);
        } finally {
            pool = null;
        }
    }
}

// Manejo de cierre de aplicación
process.on('SIGINT', async () => {
    logger.info('Cerrando aplicación...');
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Terminando aplicación...');
    await closePool();
    process.exit(0);
});

module.exports = {
    getConnection,
    closePool,
    checkConnection,
    testConnectivity,
    sql
};