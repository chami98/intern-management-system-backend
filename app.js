const express = require("express");
const app = express();
const port = 5000;
const { authenticateUser, jwtSecret, users } = require("./auth");
var cors = require("cors");
const bcrypt = require("bcryptjs");
const saltRounds = 10;
app.use(cors());
app.use(express.json());
const sql = require("mssql");
const db = require("./db");

// Connect to the database
db.connectToDatabase();

// Login route to authenticate users and issue JWT token

app.get("/api/users", async (req, res) => {
  try {
    const query = "SELECT * FROM Users";
    const result = await sql.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// route to get all users from aws rds mssql database 
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const authenticatedUser = await authenticateUser(email, password);

  if (authenticatedUser) {
    console.log("Authenticated user:", authenticatedUser);
    res.json({
      success: true,
      user: authenticatedUser.user,
      token: authenticatedUser.token,
    });
  } else {
    console.log("Authentication failed for:", email);
    res.status(401).json({ success: false, message: "Invalid credentials." });
  }
});

// Route for creating a new account
app.post("/api/register", async (req, res) => {
  const { first_name, last_name, email, password, role } = req.body;

  // Validate data
  if (!first_name || !last_name || !email || !password || !role) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields." });
  }

  try {
    // Check if the email is already registered in the database
    const emailCheckQuery = `SELECT * FROM Users WHERE email = '${email}'`;
    const emailCheckResult = await sql.query(emailCheckQuery);
    
    if (emailCheckResult.recordset.length > 0) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    }

    const newAccount = {
      first_name,
      last_name,
      email,
      password: bcrypt.hashSync(password, saltRounds),
      role_id:
        role === "Intern"
          ? 1
          : role === "Mentor"
          ? 2
          : role === "Admin"
          ? 3
          : role === "Evaluator"
          ? 4
          : role === "Management"
          ? 5
          : 6,
    };

    // Save the new account in the database
    const insertQuery = `
      INSERT INTO Users (first_name, last_name, email, password, role_id)
      VALUES ('${newAccount.first_name}', '${newAccount.last_name}', '${newAccount.email}', '${newAccount.password}', ${newAccount.role_id})
    `;
    const insertResult = await sql.query(insertQuery);

    // Return the new account details as the response
    res.status(201).json(newAccount);
  } catch (error) {
    console.error("Error creating new account:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Route for upgrading/downgrading permissions
app.put("/api/users/:email/role", (req, res) => {
  const { email } = req.params;
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

  // Find the user by ID in the mssql
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
    evaluation_1_feedback: data.evaluation_1_feedback,
    evaluation_2_feedback: data.evaluation_3_feedback,
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

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
