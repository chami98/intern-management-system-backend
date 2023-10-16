const express = require("express");
const app = express();
const port = 5000;
const { authenticateUser, jwtSecret, users } = require("./auth");
var cors = require("cors");
const bcrypt = require("bcryptjs");
const saltRounds = 10;
app.use(cors());
app.use(express.json());
// const sql = require("mssql");
const db = require("./db");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require('multer');
const { S3Client } = require("@aws-sdk/client-s3");
require('dotenv').config(); 


const sql = require("msnodesqlv8");

// Create a connection string for your local MSSQL Server.
// Replace the placeholders with your server name and database name.
// const connectionString = "Server=localhost\\SQLExpress;Database=InternX;Trusted_Connection=Yes;Driver={SQL Server Native Client 11.0}";
const connectionString = "DSN=internx;Trusted_Connection=Yes;";

// Connect to the MSSQL Server database
sql.open(connectionString, (err, conn) => {
  if (err) {
    console.error("Error connecting to the database:", err);
  } else {
    console.log("Connected to MSSQL Server database");
  }
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configure multer to use S3
const storage = multer.memoryStorage(); // Store the file in memory
const upload = multer({ storage });

// Route to upload a file to S3
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    // Create an Upload object with the file stream
    const uploader = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_BUCKET, // Replace with your bucket name
        Key: Date.now().toString()+ '.pdf', // Specify the S3 object key (filename)
        Body: file.buffer,
        ACL: "public-read", // Set the ACL as needed
      },
    });

    // Execute the upload
    const uploadResponse = await uploader.done();
    // Generate and return the S3 object URL
    const fileUrl = `https://${uploader.params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploader.params.Key}`;
    res.json({ fileUrl });
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    res.status(500).json({ error: "Error uploading file to S3" });
  }
});
// route to get all users from aws rds mssql database with optional query param
app.get("/api/users", async (req, res) => {
  const { user } = req.query;
  let role_id = undefined;

  if (user === "intern") {
    role_id = 1;
  } else if (user === "admin") {
    role_id = 2;
  } else if (user === "mentor") {
    role_id = 3;
  } else if (user === "evaluator") {
    role_id = 4;
  } else if (user === "management") {
    role_id = 5;
  }

  try {
    let query = "SELECT id, first_name, last_name, email, role_id FROM Users";
    if (role_id) {
      query += ` WHERE role_id = ${role_id}`;
    }
    console.log(query);

    // Execute the SQL query to retrieve user data
    sql.query(connectionString, query, (err, results) => {
      if (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.json(results);
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.get("/api/internProfiles", async (req, res) => {
  try {
    const query = `
      SELECT
        U.first_name,
        U.last_name,
        U.email,
        I.university,
        I.interview1_score,
        I.evaluation1_feedback,
        I.interview2_score,
        I.evaluation2_feedback,
        I.accomplishments,
        I.gpa,
        I.assigned_team,
        I.mentor_id,
        I.cv_url
      FROM Users AS U, Interns AS I
      WHERE U.id = I.user_id
      AND U.role_id = 5
    `;

    // Execute the SQL query to retrieve intern profiles
    sql.query(connectionString, query, (err, results) => {
      if (err) {
        console.error("Error fetching intern profiles:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.json(results);
      }
    });
  } catch (error) {
    console.error("Error in the try-catch block:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// route to get intern by id from aws rds mssql database
app.get("/api/interns/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT
        U.id,
        U.first_name,
        U.last_name,
        U.email,
        U.role_id,
        I.university,
        I.interview1_score,
        I.evaluation1_feedback,
        I.interview2_score,
        I.evaluation2_feedback,
        I.accomplishments,
        I.gpa,
        I.assigned_team,
        I.mentor_id,
        I.cv_url
      FROM Users AS U
      LEFT JOIN Interns AS I ON U.id = I.user_id
      WHERE U.id = ${id}
    `;

    // Execute the SQL query to retrieve intern information by ID
    sql.query(connectionString, query, (err, results) => {
      if (err) {
        console.error("Error fetching intern:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        if (results.length > 0) {
          res.json(results[0]);
        } else {
          res.status(404).json({ error: "Intern not found" });
        }
      }
    });
  } catch (error) {
    console.error("Error in the try-catch block:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Route to create an intern profile for a specific user
app.post("/api/interns/:id", async (req, res) => {
  const user_id = req.params.id;
  const data = req.body;

  try {
    // Check if a record with the same intern ID already exists
    const selectQuery = `SELECT COUNT(*) as count FROM Interns WHERE user_id = ${user_id}`;
    const selectResult = await sql.query(selectQuery);

    if (selectResult.recordset[0].count > 0) {
      return res
        .status(400)
        .json({ error: "Intern profile with the same ID already exists" });
    }
    // Create a new intern profile object
    const internProfile = {
      user_id: user_id,
      university: data.university,
      accomplishments: data.accomplishments,
      gpa: data.gpa,
      mentor_id: data.mentor_id,
      assigned_team: data.assigned_team,
      interview1_score: data.interview1_score,
      interview2_score: data.interview2_score,
      evaluation1_feedback: data.evaluation1_feedback,
      evaluation2_feedback: data.evaluation2_feedback,
      cv_url: "N/A",
      status: "Pending",
    };

    console.log(internProfile);

    const insertQuery = `
    INSERT INTO Interns (
      university, accomplishments, gpa,
      mentor_id, assigned_team, interview1_score, interview2_score,
      evaluation1_feedback, evaluation2_feedback, cv_url, status, user_id
    )
    VALUES (
      '${internProfile.university}', '${internProfile.accomplishments}',
      ${internProfile.gpa}, ${internProfile.mentor_id}, '${internProfile.assigned_team}',
      ${internProfile.interview1_score}, ${internProfile.interview2_score},
      '${internProfile.evaluation1_feedback}', '${internProfile.evaluation2_feedback}',
      '${internProfile.cv_url}', '${internProfile.status}', ${internProfile.user_id}
    )
  `;

    const insertResult = await sql.query(insertQuery);

    console.log(internProfile);

    // Return the success response
    res.status(201).json({
      message: "Intern profile created successfully",
      data: internProfile,
    });
  } catch (error) {
    console.error("Error creating intern profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login route to authenticate users and issue JWT token
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
          : role === "Admin"
          ? 2
          : role === "Mentor"
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
