const express = require("express");
const app = express();
const port = 5000;
const { authenticateUser, jwtSecret, users } = require("./auth");
var cors = require("cors");
const bcrypt = require("bcryptjs");
const saltRounds = 10;
app.use(express.json());
// const sql = require("mssql");
const db = require("./db");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const { S3Client } = require("@aws-sdk/client-s3");
require("dotenv").config();
const nodemailer = require("nodemailer");

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

const sql = require("msnodesqlv8");

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
const { BlobServiceClient } = require("@azure/storage-blob");

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    const userID = req.body.userID ? req.body.userID : null;

    console.log(userID);

    // Create a BlobServiceClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );

    // Create a container client
    const containerName = process.env.AZURE_CONTAINER_NAME;
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Generate a unique blob name
    const blobName = `${Date.now().toString()}.pdf`;

    // Create a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload file to Azure Blob Storage
    await blockBlobClient.upload(file.buffer, file.buffer.length);

    // Generate the Blob URL
    const fileUrl = blockBlobClient.url;

    res.json({ fileUrl });

    if (userID) {
      const checkQuery = `SELECT user_id FROM Interns WHERE user_id = ${userID}`;
      sql.query(connectionString, checkQuery, (err, results) => {
        if (err) {
          console.error("Error checking if the record exists:", err);
        } else {
          if (results.length > 0) {
            // Record exists, update it
            const updateQuery = `UPDATE Interns SET cv_url = '${fileUrl}' WHERE user_id = ${userID}`;
            sql.query(connectionString, updateQuery, (err, updateResult) => {
              if (err) {
                console.error("Error updating CV URL:", err);
              } else {
                console.log("CV URL updated successfully");
              }
            });
          } else {
            // Record doesn't exist, insert a new one
            const insertQuery = `INSERT INTO Interns (user_id, cv_url) VALUES (${userID}, '${fileUrl}')`;
            sql.query(connectionString, insertQuery, (err, insertResult) => {
              if (err) {
                console.error("Error inserting CV URL:", err);
              } else {
                console.log("CV URL inserted successfully");
              }
            });
          }
        }
      });
    }
  } catch (error) {
    console.error("Error uploading file to Azure Blob Storage:", error);
    res
      .status(500)
      .json({ error: "Error uploading file to Azure Blob Storage" });
  }
});

// route to get all users from aws rds mssql database with optional query param
app.get("/api/users", async (req, res) => {
  // Extract the user role from the query parameters
  const { user } = req.query;
  let role_id = undefined;

  // Map the user role to a role ID
  if (user === "intern") {
    role_id = 4;
  } else if (user === "admin") {
    role_id = 1;
  } else if (user === "mentor") {
    role_id = 3;
  } else if (user === "evaluator") {
    role_id = 2;
  } else if (user === "management") {
    role_id = 5;
  }

  try {
    // Define the base SQL query
    let query = "SELECT id, first_name, last_name, email, role_id FROM Users";
    // If a role ID is defined, add a WHERE clause to the query
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
        // Send the results back to the client
        res.json(results);
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Define a GET endpoint for "/api/internProfiles"
app.get("/api/internProfiles", async (req, res) => {
  try {
    // Define the SQL query to retrieve intern profiles
    // The query selects various fields from the Users and Interns tables
    // It joins the Users and Interns tables on the user_id field
    // It only selects users with a role_id of 5 (presumably interns)
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
    // If there's an error, log it and send a 500 response
    // If there's no error, send the results back to the client
    sql.query(connectionString, query, (err, results) => {
      if (err) {
        console.error("Error fetching intern profiles:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.json(results);
      }
    });
  } catch (error) {
    // If there's an error in the try block, log it and send a 500 response
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
    I.interview_score,
    I.interview_feedback,
    I.evaluation1_score,
    I.evaluation1_feedback,
    I.evaluation2_score,
    I.evaluation2_feedback,
    I.accomplishments,
    I.gpa,
    I.assigned_team,
    I.project_details,
    I.mentor_id,
    I.cv_url,
    I.status
  FROM Users AS U
  LEFT JOIN Interns AS I ON U.id = I.user_id
  WHERE U.id = ${id} AND U.role_id = 4
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

// Define a GET endpoint for "/api/interns"
app.get("/api/interns", async (req, res) => {
  try {
    // Define the SQL query to retrieve intern profiles
    // The query selects various fields from the Users and Interns tables
    // It joins the Users and Interns tables on the user_id field
    // It only selects users with a role_id of 4 (presumably interns)
    const query = `
      SELECT
        U.id,
        U.first_name,
        U.last_name,
        U.email,
        U.role_id,
        I.university,
        I.interview_score,
        I.interview_feedback,
        I.evaluation1_score,
        I.evaluation1_feedback,
        I.evaluation2_score,
        I.evaluation2_feedback,
        I.accomplishments,
        I.gpa,
        I.assigned_team,
        I.project_details,
        I.mentor_id,
        I.cv_url,
        I.status
      FROM Users AS U
      INNER JOIN Interns AS I ON U.id = I.user_id
      WHERE U.role_id = 4
    `;

    // Execute the SQL query to retrieve all interns
    // If there's an error, log it and send a 500 response
    // If there's no error, send the results back to the client
    sql.query(connectionString, query, (err, results) => {
      if (err) {
        console.error("Error fetching interns:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.json(results);
      }
    });
  } catch (error) {
    // If there's an error in the try block, log it and send a 500 response
    console.error("Error in the try-catch block:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// route to get all mentors from  mssql database
app.get("/api/mentors", async (req, res) => {
  try {
    const query = `
  SELECT
    U.id,
    U.first_name,
    U.last_name,
    U.email,
    U.role_id,
    I.assigned_team,
    I.project_details,
    I.status
  FROM Users AS U
  LEFT JOIN Interns AS I ON U.id = I.mentor_id
  WHERE U.role_id = 3
`;

    // Execute the SQL query to retrieve all mentors
    sql.query(connectionString, query, (err, results) => {
      if (err) {
        console.error("Error fetching mentors:", err);
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

// Route to create an intern profile for a specific user

app.post("/api/interns/:id", async (req, res) => {
  const user_id = req.params.id;
  const data = req.body;

  const internProfile = {
    university: data.university,
    accomplishments: data.accomplishments,
    gpa: data.gpa,
    mentor_id: data.mentor_id,
    evaluator_id: data.evaluator_id,
    assigned_team: data.assigned_team,
    interview_score: data.interview_score,
    interview_feedback: data.interview_feedback,
    evaluation1_score: data.evaluation1_score,
    evaluation2_score: data.evaluation2_score,
    evaluation1_feedback: data.evaluation1_feedback,
    evaluation2_feedback: data.evaluation2_feedback,
    status: "Pending",
    project_details: data.project_details,
  };

  try {
    // Check if a record with the same intern ID already exists
    const selectQuery =
      "SELECT COUNT(*) as count FROM Interns WHERE user_id = ?";

    sql.query(connectionString, selectQuery, [user_id], (err, selectResult) => {
      if (err) {
        console.error("Error checking for an existing intern profile:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      if (selectResult[0].count > 0) {
        // Update the existing intern profile
        const updateQuery = `
          UPDATE Interns
          SET university = ?, accomplishments = ?, gpa = ?, mentor_id = ?, evaluator_id = ?, assigned_team = ?,
              interview_score = ?, interview_feedback = ?, evaluation1_score = ?, evaluation2_score = ?,
              evaluation1_feedback = ?, evaluation2_feedback = ?, status = ?, project_details = ?
          WHERE user_id = ?
        `;

        sql.query(
          connectionString,
          updateQuery,
          [
            internProfile.university,
            internProfile.accomplishments,
            internProfile.gpa,
            internProfile.mentor_id,
            internProfile.evaluator_id,
            internProfile.assigned_team,
            internProfile.interview_score,
            internProfile.interview_feedback,
            internProfile.evaluation1_score,
            internProfile.evaluation2_score,
            internProfile.evaluation1_feedback,
            internProfile.evaluation2_feedback,
            internProfile.status,
            internProfile.project_details,
            user_id,
          ],
          (err) => {
            if (err) {
              console.error("Error updating intern profile:", err);
              return res.status(500).json({ error: "Internal server error" });
            }

            // Return the success response for the update
            res.status(200).json({
              message: "Intern profile updated successfully",
              data: internProfile,
            });
          }
        );
      } else {
        // Insert a new intern profile
        const insertQuery = `
          INSERT INTO Interns (
            user_id, university, accomplishments, gpa, mentor_id, evaluator_id, assigned_team, interview_score, interview_feedback,
            evaluation1_score, evaluation2_score, evaluation1_feedback, evaluation2_feedback, status, project_details
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        sql.query(
          connectionString,
          insertQuery,
          [
            user_id,
            internProfile.university,
            internProfile.accomplishments,
            internProfile.gpa,
            internProfile.mentor_id,
            internProfile.evaluator_id,
            internProfile.assigned_team,
            internProfile.interview_score,
            internProfile.interview_feedback,
            internProfile.evaluation1_score,
            internProfile.evaluation2_score,
            internProfile.evaluation1_feedback,
            internProfile.evaluation2_feedback,
            internProfile.status,
            internProfile.project_details,
          ],
          (err) => {
            if (err) {
              console.error("Error creating intern profile:", err);
              return res.status(500).json({ error: "Internal server error" });
            }

            // Return the success response for the insert
            res.status(201).json({
              message: "Intern profile created/updated successfully",
              data: internProfile,
            });
          }
        );
      }
    });
  } catch (error) {
    console.error("Error creating/updating intern profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to insert data into the EvaluationForms table
app.post("/api/evaluationForms", async (req, res) => {
  const {
    assigned_evaluator_id,
    assigned_mentor_id,
    intern_id,
    coding_skills,
    problem_solving,
    algorithmic_understanding,
    meeting_deadlines,
    quality_of_code,
    innovative_solutions,
    team_collaboration,
    documentation_skills,
    communication_clarity,
    quick_grasping,
    adaptability_to_changes,
    overall_performance,
    comment_mentor,
    comment_evaluator,
  } = req.body;

  // Validate data
  if (
    !assigned_evaluator_id ||
    !assigned_mentor_id ||
    !intern_id ||
    !coding_skills ||
    !problem_solving ||
    !algorithmic_understanding ||
    !meeting_deadlines ||
    !quality_of_code ||
    !innovative_solutions ||
    !team_collaboration ||
    !documentation_skills ||
    !communication_clarity ||
    !quick_grasping ||
    !adaptability_to_changes ||
    !overall_performance ||
    !comment_mentor ||
    !comment_evaluator
  ) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields." });
  }

  try {
    // Check if the record already exists
    const selectQuery = `
      SELECT * FROM EvaluationForms WHERE intern_id = ?
    `;

    sql.query(
      connectionString,
      selectQuery,
      [intern_id],
      (selectErr, selectResult) => {
        if (selectErr) {
          console.error("Error checking if the record exists:", selectErr);
          return res.status(500).json({ error: "Internal server error" });
        }

        if (selectResult.length > 0) {
          // Record exists, update the table
          const updateQuery = `
            UPDATE EvaluationForms
            SET
              assigned_evaluator_id = ?,
              assigned_mentor_id = ?,
              coding_skills = ?,
              problem_solving = ?,
              algorithmic_understanding = ?,
              meeting_deadlines = ?,
              quality_of_code = ?,
              innovative_solutions = ?,
              team_collaboration = ?,
              documentation_skills = ?,
              communication_clarity = ?,
              quick_grasping = ?,
              adaptability_to_changes = ?,
              overall_performance = ?,
              comment_mentor = ?,
              comment_evaluator = ?
            WHERE intern_id = ?
          `;

          sql.query(
            connectionString,
            updateQuery,
            [
              assigned_evaluator_id,
              assigned_mentor_id,
              coding_skills,
              problem_solving,
              algorithmic_understanding,
              meeting_deadlines,
              quality_of_code,
              innovative_solutions,
              team_collaboration,
              documentation_skills,
              communication_clarity,
              quick_grasping,
              adaptability_to_changes,
              overall_performance,
              comment_mentor,
              comment_evaluator,
              intern_id,
            ],
            (updateErr, updateResult) => {
              if (updateErr) {
                console.error("Error updating data in EvaluationForms:", updateErr);
                return res.status(500).json({ error: "Internal server error" });
              }

              // Return success response
              res.status(200).json({
                message: "Data updated in EvaluationForms successfully",
                data: updateResult,
              });
            }
          );
        } else {
          // Record doesn't exist, insert into the table
          const insertQuery = `
            INSERT INTO EvaluationForms (
              assigned_evaluator_id,
              assigned_mentor_id,
              intern_id,
              coding_skills,
              problem_solving,
              algorithmic_understanding,
              meeting_deadlines,
              quality_of_code,
              innovative_solutions,
              team_collaboration,
              documentation_skills,
              communication_clarity,
              quick_grasping,
              adaptability_to_changes,
              overall_performance,
              comment_mentor,
              comment_evaluator
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          sql.query(
            connectionString,
            insertQuery,
            [
              assigned_evaluator_id,
              assigned_mentor_id,
              intern_id,
              coding_skills,
              problem_solving,
              algorithmic_understanding,
              meeting_deadlines,
              quality_of_code,
              innovative_solutions,
              team_collaboration,
              documentation_skills,
              communication_clarity,
              quick_grasping,
              adaptability_to_changes,
              overall_performance,
              comment_mentor,
              comment_evaluator,
            ],
            (insertErr, insertResult) => {
              if (insertErr) {
                console.error("Error inserting data into EvaluationForms:", insertErr);
                return res.status(500).json({ error: "Internal server error" });
              }

              // Return success response
              res.status(201).json({
                message: "Data inserted into EvaluationForms successfully",
                data: insertResult,
              });
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("Error processing data for EvaluationForms:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Define a GET endpoint for "/api/evaluationForms"
app.get("/api/evaluationForms", async (req, res) => {
  try {
    // Define the SQL query to retrieve evaluation forms
    // The query selects all columns from the EvaluationForms table
    // It also joins the Users table to get the evaluator, mentor, and intern details
    const query = `
      SELECT
        EF.id,
        EF.assigned_evaluator_id,
        EF.assigned_mentor_id,
        EF.intern_id,
        EF.coding_skills,
        EF.problem_solving,
        EF.algorithmic_understanding,
        EF.meeting_deadlines,
        EF.quality_of_code,
        EF.innovative_solutions,
        EF.team_collaboration,
        EF.documentation_skills,
        EF.communication_clarity,
        EF.quick_grasping,
        EF.adaptability_to_changes,
        EF.overall_performance,
        EF.comment_mentor,
        EF.comment_evaluator,
        U.first_name AS evaluator_first_name,
        U.last_name AS evaluator_last_name,
        U.email AS evaluator_email,
        U.role_id AS evaluator_role_id,
        U2.first_name AS mentor_first_name,
        U2.last_name AS mentor_last_name,
        U2.email AS mentor_email,
        U3.first_name AS intern_first_name,
        U3.last_name AS intern_last_name,
        U3.email AS intern_email
      FROM EvaluationForms AS EF
      LEFT JOIN Users AS U ON EF.assigned_evaluator_id = U.id
      LEFT JOIN Users AS U2 ON EF.assigned_mentor_id = U2.id
      LEFT JOIN Users AS U3 ON EF.intern_id = U3.id
    `;

    // Execute the SQL query to retrieve evaluation forms
    sql.query(connectionString, query, (err, results) => {
      if (err) {
        // If there's an error executing the query, log the error and send a 500 response
        console.error("Error fetching evaluation forms:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        // If there's no error, send the results back to the client
        res.json(results);
      }
    });
  } catch (error) {
    // If there's an error in the try block, log the error and send a 500 response
    console.error("Error in the try-catch block:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get data from the EvaluationForms table by ID
app.get("/api/evaluationForms/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Define the SQL query to retrieve evaluation forms
    const query = `
      SELECT
        EF.id,
        EF.assigned_evaluator_id,
        EF.assigned_mentor_id,
        EF.intern_id,
        EF.coding_skills,
        EF.problem_solving,
        EF.algorithmic_understanding,
        EF.meeting_deadlines,
        EF.quality_of_code,
        EF.innovative_solutions,
        EF.team_collaboration,
        EF.documentation_skills,
        EF.communication_clarity,
        EF.quick_grasping,
        EF.adaptability_to_changes,
        EF.overall_performance,
        EF.comment_mentor,
        EF.comment_evaluator,
        U.first_name AS evaluator_first_name,
        U.last_name AS evaluator_last_name,
        U.email AS evaluator_email,
        U.role_id AS evaluator_role_id,
        U2.first_name AS mentor_first_name,
        U2.last_name AS mentor_last_name,
        U2.email AS mentor_email,
        U3.first_name AS intern_first_name,
        U3.last_name AS intern_last_name,
        U3.email AS intern_email
      FROM EvaluationForms AS EF
      LEFT JOIN Users AS U ON EF.assigned_evaluator_id = U.id
      LEFT JOIN Users AS U2 ON EF.assigned_mentor_id = U2.id
      LEFT JOIN Users AS U3 ON EF.intern_id = U3.id
      WHERE EF.intern_id = ${id}
    `;

    // Execute the SQL query to retrieve evaluation forms
    // If there's an error, log it and send a 500 response
    // If there's no error, send the results back to the client
    sql.query(connectionString, query, (err, results) => {
      if (results.length === 0) {
        res.status(404).json({ error: "Evaluation form not found" });
      }
      else if (err) {
        console.error("Error fetching evaluation forms:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.json(results[0]);
      }
    });
  } catch (error) {
    // If there's an error in the try block, log it and send a 500 response
    console.error("Error in the try-catch block:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get


// Login route to authenticate users and issue JWT token
app.post("/api/login", async (req, res) => {
  // Extract the email and password from the request body
  const { email, password } = req.body;

  try {
    // Call the authenticateUser function with the provided email and password
    // This function is expected to return an object with a "success" property
    // If "success" is true, the object should also contain "user" and "token" properties
    const authenticatedUser = await authenticateUser(email, password);

    if (authenticatedUser.success) {
      // If the user was authenticated successfully, log the result and send a response
      // The response contains the authenticated user and the token
      console.log("Authenticated user:", authenticatedUser);
      res.json({
        success: true,
        user: authenticatedUser.user,
        token: authenticatedUser.token,
      });
    } else {
      // If the user was not authenticated successfully, log the email and send a 401 response
      console.log("Authentication failed for:", email);
      res.status(401).json({ success: false, message: "Invalid credentials." });
    }
  } catch (error) {
    // If there's an error during authentication, log it and send a 500 response
    console.error("Error during authentication:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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
    console.log(first_name, last_name, email, password, role);
    // Create a new database connection
    sql.open(connectionString, (err, conn) => {
      if (err) {
        console.error("Error opening database connection:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      // Check if the email is already registered in the database
      const emailCheckQuery = `SELECT * FROM Users WHERE email = '${email}'`;
      conn.query(emailCheckQuery, (err, emailCheckResult) => {
        if (err) {
          conn.close();
          console.error("Error checking email:", err);
          return res.status(500).json({ error: "Internal server error" });
        }

        if (emailCheckResult.length > 0) {
          conn.close();
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
              ? 4
              : role === "Admin"
              ? 1
              : role === "Mentor"
              ? 3
              : role === "Evaluator"
              ? 2
              : role === "Management"
              ? 5
              : 6,
        };

        // Save the new account in the database
        const insertQuery = `
          INSERT INTO Users (first_name, last_name, email, password, role_id)
          VALUES ('${newAccount.first_name}', '${newAccount.last_name}', '${newAccount.email}', '${newAccount.password}', ${newAccount.role_id})
        `;

        conn.query(insertQuery, (err, insertResult) => {
          conn.close();
          if (err) {
            console.error("Error creating new account:", err);
            return res.status(500).json({ error: "Internal server error" });
          }

          // Return the new account details as the response
          res.status(201).json(newAccount);
        });
      });
    });
  } catch (error) {
    console.error("Error creating new account:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route for upgrading/downgrading permissions example Admin to Intern
app.put("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const { role_id } = req.body;

  const role =
    role_id === 4
      ? "Intern"
      : role_id === 1
      ? "Admin"
      : role_id === 3
      ? "Mentor"
      : role_id === 2
      ? "Evaluator"
      : role_id === 5
      ? "Management"
      : "Unknown";

  // Validate data
  if (!role_id) {
    return res.status(400).json({ message: "Please provide a valid role." });
  }

  try {
    // Create a new database connection
    sql.open(connectionString, (err, conn) => {
      if (err) {
        console.error("Error opening database connection:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      // Check if the user exists in the database
      const userCheckQuery = `SELECT * FROM Users WHERE id = ${id}`;
      conn.query(userCheckQuery, (err, userCheckResult) => {
        if (err) {
          conn.close();
          console.error("Error checking user:", err);
          return res.status(500).json({ error: "Internal server error" });
        }

        if (userCheckResult.length === 0) {
          conn.close();
          return res.status(404).json({ message: "User not found" });
        }

        // Update the user role
        const updateQuery = `UPDATE Users SET role_id = ${role_id} WHERE id = ${id}`;
        conn.query(updateQuery, (err, updateResult) => {
          conn.close();
          if (err) {
            console.error("Error updating user role:", err);
            return res.status(500).json({ error: "Internal server error" });
          }

          // Return the success response for the update
          res.status(200).json({
            message: "User role updated successfully",
            data: { id, role_id },
          });
        });
      });
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to update intern profile status
app.put("/api/interns/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validate data
  if (
    status !== "Pending" &&
    status !== "Interview Scheduled" &&
    status !== "Interview Complete" &&
    status !== "Hired" &&
    status !== "Rejected" &&
    status !== "Internship Started" &&
    status !== "Internship Ended"
  ) {
    return res.status(400).json({ message: "Please provide a valid status." });
  }

  try {
    // Create a new database connection
    sql.open(connectionString, (err, conn) => {
      if (err) {
        console.error("Error opening database connection:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      // Check if the intern exists in the database
      const internCheckQuery = `SELECT * FROM Interns WHERE user_id = ${id}`;
      conn.query(internCheckQuery, (err, internCheckResult) => {
        if (err) {
          conn.close();
          console.error("Error checking intern:", err);
          return res.status(500).json({ error: "Internal server error" });
        }

        if (internCheckResult.length === 0) {
          conn.close();
          return res.status(404).json({ message: "Intern not found" });
        }

        // Update the intern status
        const updateQuery = `UPDATE Interns SET status = '${status}' WHERE user_id = ${id}`;
        conn.query(updateQuery, (err, updateResult) => {
          conn.close();
          if (err) {
            console.error("Error updating intern status:", err);
            return res.status(500).json({ error: "Internal server error" });
          }

          // Return the success response for the update
          res.status(200).json({
            message: "Intern status updated successfully",
            data: { id, status },
          });
        });
      });
    });
  } catch (error) {
    console.error("Error updating intern status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.post("/api/invite", (req, res) => {
  const { email, name } = req.body;
  const subject = "Invitation to InternX - Your Intern Management Solution";

  // Replace with your email and password
  const mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USERNAME,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const mailDetails = {
    from: process.env.GMAIL_USERNAME,
    to : email,
    subject,
    html: `
    <!DOCTYPE html>
    <html lang="en">
    
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
        <style>
            body {
                font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                background: linear-gradient(to bottom, #fafafa, #e0e0e0);
                color: #333;
            }
    
            .container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
                text-align: center;
            }
    
            h1 {
                color: #3498db;
                margin-bottom: 20px;
            }
    
            p {
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 20px;
                color: #555;
            }
    
            .button {
                display: inline-block;
                padding: 10px 20px;
                font-size: 16px;
                text-decoration: none;
                background-color: #3498db;
                color: #ffffff;
                border-radius: 5px;
                margin-top: 20px;
                transition: background-color 0.3s ease;
                box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
            }
    
            .button:hover {
                background-color: #2772a4;
            }
    
            .greeting {
                color: #3498db;
                margin-bottom: 10px;
            }
    
            /* Additional Styles */
            a {
                color: #3498db;
                text-decoration: none;
            }
    
            a:hover {
                color: #2772a4;
            }
    
            /* Add more styles for any other elements as needed */
        </style>
    </head>
    
    <body>
        <div class="container">
            <h1>${subject}</h1>
            <p class="greeting">Hello, ${name}!</p>
            <p>
                Welcome to InternX, your premier Intern Management System! InternX
                offers a comprehensive solution to streamline your intern management
                process, providing a seamless experience for both administrators and
                users.
            </p>
            <img src="https://www.pngall.com/wp-content/uploads/4/Welcome-PNG-Download-Image.png" alt="Welcome Image" style="width: 100%; max-width: 400px; margin: 20px auto;">
            <a class="button" href="#">Get Started with InternX</a>
        </div>
    </body>
    </html>
    
    `,
  };

  mailTransporter.sendMail(mailDetails, (err, data) => {
    if (err) {
      console.log("Error Occurs", err);
      res.status(500).json({ error: "Error sending email" });
    } else {
      console.log("Email sent successfully");
      res.status(200).json({ message: "Email sent successfully" });
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
