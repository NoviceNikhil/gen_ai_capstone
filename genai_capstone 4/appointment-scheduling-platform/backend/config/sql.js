const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.SQL_DB_NAME,
  process.env.SQL_DB_USER,
  process.env.SQL_PASSWORD,
  {
    host: process.env.SQL_HOST,
    port: process.env.SQL_PORT,
    dialect: "mysql",
    logging: false,
    ...(process.env.SQL_SSL === "true" && {
      dialectOptions: {
        ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      },
    }),
  }
);

// Test connection
const connectSQL = async () => {
  try {
    await sequelize.authenticate();
    console.log("  MySQL connected successfully");
  } catch (error) {
    console.error("  MySQL connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectSQL };
