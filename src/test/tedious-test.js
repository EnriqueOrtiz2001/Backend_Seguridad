const Connection = require('tedious').Connection;
require('dotenv').config();

const config = {
    server: process.env.DB_SERVER,
    authentication: {
        type: 'default',
        options: {
            userName: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: true,
        port: 1433,
        database: process.env.DB_NAME,
        connectTimeout: 30000
    }
};

const connection = new Connection(config);

connection.on('connect', err => {
    if (err) {
        console.error('❌ Error de conexión:');
        console.error(err.message);
        if (err.code) console.error('Código:', err.code);
    } else {
        console.log('✅ Conectado exitosamente a SQL Server!');
        connection.close();
    }
});

connection.on('error', err => {
    console.error('❌ Error en conexión:', err);
});

console.log('Intentando conectar a:', config.server);