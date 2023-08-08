const express = require("express");
const app = express();
const port = 5000;
const { authenticateUser, jwtSecret, users } = require("./auth");
var cors = require("cors");
const bcrypt = require("bcryptjs");
const saltRounds = 10; // The number of salt rounds determines the complexity of the hashing

app.use(cors());

// Middleware to parse incoming JSON
app.use(express.json());

// Login route to authenticate users and issue JWT token
app.post("/api/login", (req, res) => {
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
app.post("/api/register", (req, res) => {
  const { firstname, lastname, email, password, role } = req.body;

  // Validate data
  if (!firstname || !lastname || !email || !password || !role) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields." });
  }

  // Check if the email is already registered
  const existingAccount = accounts.find((account) => account.email === email);
  if (existingAccount) {
    return res
      .status(409)
      .json({ message: "An account with this email already exists." });
  }

  // Create a new account object
  const newAccount = {
    id: accounts.length + 1,
    firstname,
    lastname,
    email,
    password: bcrypt.hashSync(password, saltRounds),
    role,
  };

  // Save the new account
  accounts.push(newAccount);

  // Return the new account details as the response
  res.status(201).json(newAccount);
});

app.post("/invite", (req, res) => {
  const { email, role } = req.body;

  // Validate data
  if (!email || !role) {
    return res
      .status(400)
      .json({ message: "Please provide both email and role." });
  }

  // Check if the role is valid (Admin, Management, Intern, etc.)
  const validRoles = [
    "Admin",
    "Management",
    "Intern",
    "Evaluator" /* Add more roles as needed */,
  ];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role provided." });
  }

  // Send invitation email
  sendInvitationEmail(email, role)
    .then(() => {
      res.json({ message: "Invitation sent successfully." });
    })
    .catch((error) => {
      console.error("Error sending invitation email:", error);
      res.status(500).json({ message: "Error sending invitation email." });
    });
});

// Route for upgrading/downgrading permissions
app.put("/api/users/:id/role", (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // Validate data
  if (!role) {
    return res.status(400).json({ message: "Please provide the new role." });
  }

  // Check if the role is valid (Admin, Mentor, Intern, etc.)
  const validRoles = [
    "Admin",
    "Mentor",
    "Intern",
    "Evaluator" /* Add more roles as needed */,
  ];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role provided." });
  }

  // Find the user by ID in the database (Database link karanna)
  const user = users.find((user) => user.id === parseInt(id));
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // Update the user's role
  user.role = role;

  // Respond with the updated user data
  res.json(user);
});

const internProfiles = [];

// Route to create an intern profile
app.post("/api/interns", (req, res) => {
  const data = req.body;

  // Check if a record with the same name already exists
  const existingProfile = internProfiles.find(
    (profile) => profile.firstname === data.firstname
  );
  if (existingProfile) {
    return res
      .status(409)
      .json({ message: "An intern profile with the same name already exists" });
  }

  // Create a new intern profile
  const internProfile = {
    firstname: data.firstname,
    lastname: data.lastname,
    university: data.university,
    accomplishments: data.accomplishments,
    gpa: data.gpa,
    mentor: data.mentor,
    team: data.team,
    interview_1_score: data.interview_1_score,
    interview_2_score: data.interview_2_score,
    evaluation_1_feedback:data.evaluation_1_feedback,
    evaluation_2_feedback:data.evaluation_3_feedback,
    cv_url: "N/A",
    status: "Pending", // Set initial status to Pending
  };

  // Save the intern profile in the temporary data storage (database)
  internProfiles.push(internProfile);

  return res.status(201).json({
    message: "Intern profile created successfully",
    data: internProfile,
  });
});
 

// Route to update an intern profile
app.put("/api/interns/:name", (req, res) => {
  const internName = req.params.name;
  const data = req.body;

  // Find the intern profile to be updated
  const internProfile = internProfiles.find(
    (profile) => profile.name === internName
  );
  if (!internProfile) {
    return res.status(404).json({ message: "Intern profile not found" });
  }

  // Update the intern profile information
  internProfile.name = data.name;
  internProfile.university = data.university;
  internProfile.interview_score = data.interview_score;
  internProfile.interview_feedback = data.interview_feedback;
  internProfile.evolution1_score = data.evolution1_score;
  internProfile.evolution1_feedback = data.evolution1_feedback;
  internProfile.evolution2_score = data.evolution2_score;
  internProfile.evolution2_feedback = data.evolution2_feedback;
  internProfile.accomplishments = data.accomplishments;
  internProfile.gpa = data.gpa;
  internProfile.project_details = data.project_details;
  internProfile.assigned_team = data.assigned_team;
  internProfile.mentor = data.mentor;
  internProfile.cv_url = data.cv_url;

  return res.json({
    message: "Intern profile updated successfully",
    data: internProfile,
  });
});

// Route to update intern profile status
app.patch("/api/interns/:name/status", (req, res) => {
  const internName = req.params.name;
  const { status } = req.body;

  // Find the intern profile to be updated
  const internProfile = internProfiles.find(
    (profile) => profile.name === internName
  );
  if (!internProfile) {
    return res.status(404).json({ message: "Intern profile not found" });
  }

  // Check if the provided status is valid
  const validStatuses = [
    "Pending",
    "Interview Scheduled",
    "Interview Complete",
    "Hired",
    "Rejected",
    "Internship Started",
    "Internship Ended",
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status provided" });
  }

  // Update the intern profile status
  internProfile.status = status;

  return res.json({
    message: "Intern profile status updated successfully",
    data: internProfile,
  });
});




// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
