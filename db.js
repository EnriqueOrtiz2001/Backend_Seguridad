const sql = require("mssql/msnodesqlv8");

const config = {
  server: "Enrique8725\\TABULAR",
  database: "testeoSeguridad",
  driver: "msnodesqlv8",
  options: {
    trustedConnection: true
  },
  connectionString: "Driver={ODBC Driver 17 for SQL Server};Server=Enrique8725\\TABULAR;Database=testeoSeguridad;Trusted_Connection=Yes;"
};


const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

poolConnect
  .then(() => {
    console.log("Conectado a SQL Server con autenticación de Windows.");
  })
  .catch((err) => {
    console.error("Error al conectar a la base de datos:", err);
  });

module.exports = {
  sql,
  pool,
  poolConnect,
};
