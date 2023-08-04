const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const internPlainPassword = 'intern123';
const adminPlainPassword = 'admin123';

const saltRounds = 10; // The number of salt rounds determines the complexity of the hashing

const internHashedPassword = bcrypt.hashSync(internPlainPassword, saltRounds);
const adminHashedPassword = bcrypt.hashSync(adminPlainPassword, saltRounds);

// Replace this with your own secret key for JWT
const jwtSecret = 'xtenship';

// Sample user data - Replace this with your database or any other data source
const users = [
  {
    id: 1,
    username: 'intern1',
    password: internHashedPassword, // Password: internpassword
    role: 'intern',
  },
  {
    id: 2,
    username: 'admin',
    password: adminHashedPassword, // Password: adminpassword
    role: 'admin',
  },
  // Add more users with different roles as needed...
];

// Function to authenticate user and generate JWT token
function authenticateUser(username, password) {
  const user = users.find((u) => u.username === username);
  if (!user) return null;

  if (bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '1h' });
    return { user: { ...user, password: undefined }, token };
  }

  return null;
}

module.exports = { authenticateUser , jwtSecret };
