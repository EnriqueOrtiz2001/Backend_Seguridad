const express = require("express");
const { getConnection } = require("./config/Connection_SQL_Server");
const usuarioRoutes = require("./routes/usuarios.routes");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Rutas de usuarios (registro, login, gestión)
app.use("/api/usuarios", usuarioRoutes);

// Ruta de prueba de conexión a la base de datos
app.get("/", async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query("SELECT 1 as test");
    res.send("✅ Conexión a SQL Server establecida correctamente");
  } catch (err) {
    console.error("Error de conexión:", err);
    res.status(500).send("❌ Error al conectar con SQL Server");
  }
});

// Middleware para manejar errores
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar el servidor con verificación de conexión a la BD
async function startServer() {
  try {
    // Verificar conexión a la base de datos primero
    const pool = await getConnection();
    const result = await pool.request().query("SELECT 1 as test");
    console.log("✅ Conexión a SQL Server verificada");
    
    app.listen(port, () => {
      console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
      console.log(`🔒 Endpoints de seguridad:`);
      console.log(`   POST   http://localhost:${port}/api/usuarios/register`);
      console.log(`   GET    http://localhost:${port}/api/usuarios`);
      console.log(`   GET    http://localhost:${port}/api/usuarios/{id}`);
      console.log(`   PUT    http://localhost:${port}/api/usuarios/{id}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

startServer();