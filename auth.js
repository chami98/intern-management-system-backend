const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sql = require("mssql");

const saltRounds = 10;
const jwtSecret = "xtenship";

const config = {
  server: "xternship-99x.cvlnrspsrlp1.eu-north-1.rds.amazonaws.com",
  database: "InternX",
  user: "admin",
  password: "manameldura",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

let users = [];

async function connectToDatabase() {
  try {
    await sql.connect(config);
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

function authenticateUser(email, password) {
  const user = users.find((u) => u.email === email);
  console.log(user);
  if (!user) return null;

  if (bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, {
      expiresIn: "1h",
    });
    return { user: { ...user, password: undefined }, token };
  }

  return null;
}

module.exports = { authenticateUser, jwtSecret, users };
