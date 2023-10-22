const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sql = require("msnodesqlv8");
const saltRounds = 10;
const jwtSecret = "xtenship";

// Define your connection string
const connectionString = "DSN=internx;Trusted_Connection=Yes;";
// Set up the configuration
const config = {
  connectionString: connectionString,
};

let users = [];

async function connectToDatabase() {
  try {
    await sql.open(connectionString, (err, conn) => {
      if (err) {
        console.error("Error connecting to the database:", err);
      } else {
        console.log("Connected to MSSQL Server database 2");
      }
    });
    await getUsers();
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

connectToDatabase();

async function getUsers() {
  try {
    let query = "SELECT id, first_name, last_name, email, role_id FROM Users";
    sql.query(connectionString, query, (err, results) => {
      if (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        console.log(results);
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
  }
}

async function authenticateUser(email, password) {
  return new Promise((resolve, reject) => {
    const query = "SELECT id, role_id, password FROM Users WHERE email = ?";
    
    // Use a parameterized query to prevent SQL injection
    sql.query(connectionString, query, [email], (err, results) => {
      if (err) {
        console.error("Error fetching user:", err);
        reject({ success: false, message: "Internal server error" });
      } else {
        if (results.length === 0) {
          // No user found with the provided email
          resolve({ success: false, message: "User not found" });
        } else {
          const user = results[0];

          // Compare passwords securely
          if (bcrypt.compareSync(password, user.password)) {
            // Generate a JWT token
            const token = jwt.sign(
              { id: user.id, role: user.role_id },
              jwtSecret,
              { expiresIn: "1h" }
            );

            // Return user data without the password and the token
            const userWithoutPassword = { ...user, password: undefined };
            resolve({ success: true, user: userWithoutPassword, token });
          } else {
            resolve({ success: false, message: "Invalid credentials" });
          }
        }
      }
    });
  });
}



module.exports = { authenticateUser, jwtSecret, users };
