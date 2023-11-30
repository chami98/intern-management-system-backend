// Import the "mssql" module to interact with SQL Server
const sql = require("mssql");
// Import the "dotenv" module to load environment variables from a .env file
require("dotenv").config(); 

// Define the configuration for the SQL Server connection
const config = {
    // The server name (or IP address) is loaded from an environment variable
    server: process.env.DB_SERVER,
    // The database name is loaded from an environment variable
    database: process.env.DB_NAME,
    // The username for the SQL Server connection is loaded from an environment variable
    user: process.env.DB_USER,
    // The password for the SQL Server connection is loaded from an environment variable
    password: process.env.DB_PASSWORD,
    options: {
      // The connection will be encrypted
      encrypt: true,
      // The server's SSL certificate will be trusted
      trustServerCertificate: true,
    },
};

// Define an asynchronous function to connect to the database
async function connectToDatabase() {
  try {
    // Try to establish a connection to the SQL Server
    await sql.connect(config);
    // If the connection is successful, log a success message
    console.log("Connected to the database");
  } catch (error) {
    // If there's an error during the connection, log the error
    console.error("Error connecting to the database:", error);
  }
}

// Export the "connectToDatabase" function and the "config" object
// These can be imported by other modules
module.exports = { connectToDatabase , config};