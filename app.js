const express = require("express");
const app = express();
const port = 5000;
const { authenticateUser, jwtSecret, users } = require("./auth");

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
app.post('/register', (req, res) => {
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

app.post('/invite', (req, res) => {
  const { email, role } = req.body;

  // Validate data
  if (!email || !role) {
    return res.status(400).json({ message: 'Please provide both email and role.' });
  }

  // Check if the role is valid (Admin, Management, Intern, etc.)
  const validRoles = ['Admin', 'Management', 'Intern', 'Evaluator', /* Add more roles as needed */];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role provided.' });
  }

  // Send invitation email
  sendInvitationEmail(email, role)
    .then(() => {
      res.json({ message: 'Invitation sent successfully.' });
    })
    .catch((error) => {
      console.error('Error sending invitation email:', error);
      res.status(500).json({ message: 'Error sending invitation email.' });
    });
});

// Route for upgrading/downgrading permissions
app.put('/api/users/:id/role', (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // Validate data
  if (!role) {
    return res.status(400).json({ message: 'Please provide the new role.' });
  }

  // Check if the role is valid (Admin, Mentor, Intern, etc.)
  const validRoles = ['Admin', 'Mentor', 'Intern', 'Evaluator', /* Add more roles as needed */];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role provided.' });
  }

  // Find the user by ID in the database (Database link karanna)
  const user = users.find((user) => user.id === parseInt(id));
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  // Update the user's role
  user.role = role;

  // Respond with the updated user data
  res.json(user);
});



// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
