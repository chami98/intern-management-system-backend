const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sql = require("mssql");
const saltRounds = 10;
const jwtSecret = "xtenship";
const db = require("./db");

let users = [];

async function connectToDatabase() {
  try {
    await sql.connect(db.config);
    console.log("Connected to the database");
    await getUsers();
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

connectToDatabase();

async function getUsers() {
  try {
    const query = "SELECT * FROM Users";
    const result = await sql.query(query);
    users = result.recordset;
    console.log("Users fetched:", users);
  } catch (error) {
    console.error("Error fetching users:", error);
  }
}

async function authenticateUser(email, password) {
  try {
    await sql.connect(db.config);

    const query = `SELECT * FROM Users WHERE email = '${email}'`;
    const result = await sql.query(query);
    const user = result.recordset[0];

    if (!user) return null;

    console.log("Retrieved user:", user);

    if (bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role_id }, jwtSecret, {
        expiresIn: "1h",
      });
      console.log("Generated token:", token);
      return { user: { ...user, password: undefined }, token };
    }
    return null;
  } catch (error) {
    console.error("Error during authentication:", error);
    return null;
  }
}


module.exports = { authenticateUser, jwtSecret, users };
