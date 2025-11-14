const Activity = require('../models/Activity');
const emissionController = require('./emissionController');
const mongoose = require('mongoose');

/**
 * Create a new activity and calculate emissions
 */
const createActivity = async (req, res) => {
  try {
    const {
      userId = 'default-user',
      activityType,
      distance,
      transportMode,
      foodType,
      quantity,
      unit,
      energyConsumed,
      energyUnit,
      date,
      notes
    } = req.body;

    // Validate activity type
    if (!activityType || !['commute', 'food', 'electricity'].includes(activityType)) {
      return res.status(400).json({ error: 'Invalid activity type' });
    }

    let co2e = 0;

    // 🔥 FIXED VALIDATION (distance == null allows "0")
    switch (activityType) {
      case 'commute':
        if (distance == null) {
          return res.status(400).json({ error: 'Distance is required for commute' });
        }
        const distanceNum = typeof distance === 'string' ? parseFloat(distance) : Number(distance);
        if (isNaN(distanceNum) || distanceNum < 0) {
          return res.status(400).json({ error: 'Distance must be a non-negative number' });
        }
        co2e = await emissionController.calculateCommuteEmissions(
          distance,
          transportMode || 'car'
        );
        break;

      case 'food':
        if (quantity == null) {
          return res.status(400).json({ error: 'Quantity is required for food activity' });
        }
        const quantityNum = typeof quantity === 'string' ? parseFloat(quantity) : Number(quantity);
        if (isNaN(quantityNum) || quantityNum < 0) {
          return res.status(400).json({ error: 'Quantity must be a non-negative number' });
        }
        co2e = await emissionController.calculateFoodEmissions(
          foodType || 'vegetables',
          quantity,
          unit || 'kg'
        );
        break;

      case 'electricity':
        if (energyConsumed == null) {
          return res.status(400).json({ error: 'Energy consumed is required for electricity' });
        }
        const energyNum = typeof energyConsumed === 'string' ? parseFloat(energyConsumed) : Number(energyConsumed);
        if (isNaN(energyNum) || energyNum < 0) {
          return res.status(400).json({ error: 'Energy consumed must be a non-negative number' });
        }
        co2e = await emissionController.calculateElectricityEmissions(
          energyConsumed,
          energyUnit || 'kwh'
        );
        break;
    }

    // Save activity in DB
    const activity = new Activity({
      userId,
      activityType,
      distance,
      transportMode,
      foodType,
      quantity,
      unit,
      energyConsumed,
      energyUnit,
      co2e,
      date: date ? new Date(date) : new Date(),
      notes
    });

    await activity.save();

    res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      activity: {
        id: activity._id,
        activityType: activity.activityType,
        co2e: activity.co2e,
        date: activity.date
      }
    });

  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      error: 'Failed to create activity',
      message: error.message
    });
  }
};

/**
 * Get all activities for a user
 */
const getActivities = async (req, res) => {
  try {
    const {
      userId = 'default-user',
      activityType,
      startDate,
      endDate,
      limit = 50
    } = req.query;

    const query = { userId };

    if (activityType) query.activityType = activityType;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const activities = await Activity.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: activities.length,
      activities: activities.map(a => ({
        id: a._id,
        activityType: a.activityType,
        distance: a.distance,
        transportMode: a.transportMode,
        foodType: a.foodType,
        quantity: a.quantity,
        unit: a.unit,
        energyConsumed: a.energyConsumed,
        energyUnit: a.energyUnit,
        co2e: a.co2e,
        date: a.date,
        notes: a.notes,
        createdAt: a.createdAt
      }))
    });

  } catch (error) {
    console.error('Error getting activities:', error);
    res.status(500).json({ error: 'Failed to get activities', message: error.message });
  }
};

/**
 * Get a single activity by ID
 */
const getActivityById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid activity ID format' });
    }

    const activity = await Activity.findById(id);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({
      success: true,
      activity: {
        id: activity._id,
        userId: activity.userId,
        activityType: activity.activityType,
        distance: activity.distance,
        transportMode: activity.transportMode,
        foodType: activity.foodType,
        quantity: activity.quantity,
        unit: activity.unit,
        energyConsumed: activity.energyConsumed,
        energyUnit: activity.energyUnit,
        co2e: activity.co2e,
        date: activity.date,
        notes: activity.notes,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt
      }
    });

  } catch (error) {
    console.error('Error getting activity:', error);
    res.status(500).json({ error: 'Failed to get activity', message: error.message });
  }
};

/**
 * Update an activity + recalculate emissions
 */
const updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid activity ID format' });
    }

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Recalculate emissions only if needed
    if (
      updateData.distance != null ||
      updateData.transportMode ||
      updateData.foodType ||
      updateData.quantity != null ||
      updateData.unit ||
      updateData.energyConsumed != null ||
      updateData.energyUnit
    ) {
      const type = updateData.activityType || activity.activityType;
      let co2e = 0;

      switch (type) {
        case 'commute':
          co2e = await emissionController.calculateCommuteEmissions(
            updateData.distance ?? activity.distance,
            updateData.transportMode || activity.transportMode
          );
          break;

        case 'food':
          co2e = await emissionController.calculateFoodEmissions(
            updateData.foodType || activity.foodType,
            updateData.quantity ?? activity.quantity,
            updateData.unit || activity.unit
          );
          break;

        case 'electricity':
          co2e = await emissionController.calculateElectricityEmissions(
            updateData.energyConsumed ?? activity.energyConsumed,
            updateData.energyUnit || activity.energyUnit
          );
          break;
      }

      updateData.co2e = co2e;
    }

    const updatedActivity = await Activity.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      message: 'Activity updated successfully',
      activity: {
        id: updatedActivity._id,
        activityType: updatedActivity.activityType,
        co2e: updatedActivity.co2e,
        date: updatedActivity.date
      }
    });

  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: 'Failed to update activity', message: error.message });
  }
};

/**
 * Delete activity
 */
const deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid activity ID format' });
    }

    const activity = await Activity.findByIdAndDelete(id);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: 'Failed to delete activity', message: error.message });
  }
};

module.exports = {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity
};