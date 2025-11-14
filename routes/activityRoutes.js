const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');

// Create a new activity
router.post('/', activityController.createActivity);

// Get all activities
router.get('/', activityController.getActivities);

// Get a single activity by ID
router.get('/:id', activityController.getActivityById);

// Update an activity
router.put('/:id', activityController.updateActivity);

// Delete an activity
router.delete('/:id', activityController.deleteActivity);

module.exports = router;

