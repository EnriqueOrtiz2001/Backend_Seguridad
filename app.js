const express = require("express");
const { sql, pool, poolConnect } = require("./db");

const app = express();
const port = 3000;

app.get("/", async (req, res) => {
  try {
    await poolConnect; // espera a que la conexión esté lista
    const result = await pool.request().query("SELECT * FROM Testeo1");
    res.send(result.recordset);
  } catch (err) {
    console.error("Error al hacer la consulta:", err);
    res.status(500).send("Error al consultar la base de datos");
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
