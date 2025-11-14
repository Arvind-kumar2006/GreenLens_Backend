const express = require('express');
const router = express.Router();
const emissionController = require('../controllers/emissionController');

// Calculate emissions for an activity (without saving)
router.post('/calculate', emissionController.calculateEmissions);

// Get total emissions for a user
router.get('/total', emissionController.getTotalEmissions);

// Get emissions grouped by period (day/week/month)
router.get('/period', emissionController.getEmissionsByPeriod);

module.exports = router;

