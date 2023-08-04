const express = require("express");
const app = express();
const port = 5000;
const { authenticateUser , jwtSecret } = require("./auth");

// Middleware to parse incoming JSON data
app.use(express.json());

// Login route to authenticate users and issue JWT token
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const authenticatedUser = authenticateUser(username, password);

  if (authenticatedUser) {
    res.json({
      success: true,
      user: authenticatedUser.user,
      token: authenticatedUser.token,
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials." });
  }
});

// In-memory array to store accounts
const accounts = [];

// Route for creating a new account
app.post('/accounts', (req, res) => {
  const { name, email, password, role } = req.body;

  // Validate data
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  // Check if the email is already registered
  const existingAccount = accounts.find((account) => account.email === email);
  if (existingAccount) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  // Create a new account object
  const newAccount = {
    id: accounts.length + 1,
    name,
    email,
    password, // In a real-world scenario, you would hash the password before saving it.
    role,
  };

  // Save the new account
  accounts.push(newAccount);

  // Return the new account details as the response
  res.status(201).json(newAccount);
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
