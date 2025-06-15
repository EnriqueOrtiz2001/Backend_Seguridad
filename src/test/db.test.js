// Cargar dotenv primero
require('dotenv').config({ path: '../.env' }); // Ajusta la ruta según tu estructura

const { getConnection, closePool } = require('../config/Conecction_SQL_Server');

async function testConnection() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT 1 AS test');
        console.log('✅ Conexión exitosa. Resultado:', result.recordset);
    } catch (error) {
        console.error('❌ Error de conexión:', error);
    } finally {
        await closePool();
    }
}

testConnection();