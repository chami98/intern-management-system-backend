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
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
