const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/carbonfootprint')
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/activities', require('./routes/activityRoutes'));
app.use('/api/emissions', require('./routes/emissionRoutes'));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Carbon Footprint API is running' });
});

const PORT = process.env.PORT || 5000;

// Only start server if running directly (not as a module/require)
// Vercel serverless will require() this file and use the exported app
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export app for Vercel serverless functions
module.exports = app;

