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

    // Normalize and validate inputs per activity type
    switch (activityType) {
      case 'commute': {
        // allow 0 but not null/undefined
        if (distance == null) {
          return res.status(400).json({ error: 'Distance is required for commute' });
        }
        const distanceNum = typeof distance === 'string' ? parseFloat(distance) : Number(distance);
        if (isNaN(distanceNum) || distanceNum < 0) {
          return res.status(400).json({ error: 'Distance must be a non-negative number' });
        }

        const mode = transportMode || 'car';
        co2e = await emissionController.calculateCommuteEmissions(distanceNum, mode);

        // Save numeric value back for DB
        req.body.distance = distanceNum;
        req.body.transportMode = mode;
        break;
      }

      case 'food': {
        if (quantity == null) {
          return res.status(400).json({ error: 'Quantity is required for food activity' });
        }
        const quantityNum = typeof quantity === 'string' ? parseFloat(quantity) : Number(quantity);
        if (isNaN(quantityNum) || quantityNum < 0) {
          return res.status(400).json({ error: 'Quantity must be a non-negative number' });
        }

        const fType = foodType || 'vegetables';
        const u = unit || 'kg';
        co2e = await emissionController.calculateFoodEmissions(fType, quantityNum, u);

        req.body.quantity = quantityNum;
        req.body.foodType = fType;
        req.body.unit = u;
        break;
      }

      case 'electricity': {
        if (energyConsumed == null) {
          return res.status(400).json({ error: 'Energy consumed is required for electricity' });
        }
        const energyNum = typeof energyConsumed === 'string' ? parseFloat(energyConsumed) : Number(energyConsumed);
        if (isNaN(energyNum) || energyNum < 0) {
          return res.status(400).json({ error: 'Energy consumed must be a non-negative number' });
        }

        const eUnit = energyUnit || 'kwh';
        co2e = await emissionController.calculateElectricityEmissions(energyNum, eUnit);

        req.body.energyConsumed = energyNum;
        req.body.energyUnit = eUnit;
        break;
      }
    }

    // Save activity in DB with normalized values
    const activity = new Activity({
      userId,
      activityType,
      distance: req.body.distance,
      transportMode: req.body.transportMode,
      foodType: req.body.foodType,
      quantity: req.body.quantity,
      unit: req.body.unit,
      energyConsumed: req.body.energyConsumed,
      energyUnit: req.body.energyUnit,
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
    const updateData = { ...req.body };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid activity ID format' });
    }

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // If activityType is provided, validate it
    if (updateData.activityType && !['commute', 'food', 'electricity'].includes(updateData.activityType)) {
      return res.status(400).json({ error: 'Invalid activity type' });
    }

    // Determine whether we need to recalculate emissions
    const willChangeType = !!updateData.activityType && updateData.activityType !== activity.activityType;
    const willChangeRelevantField = (
      updateData.distance != null ||
      updateData.transportMode ||
      updateData.foodType ||
      updateData.quantity != null ||
      updateData.unit ||
      updateData.energyConsumed != null ||
      updateData.energyUnit
    );

    if (willChangeType || willChangeRelevantField) {
      const type = updateData.activityType || activity.activityType;
      let co2e = 0;

      switch (type) {
        case 'commute': {
          const newDistance = updateData.distance != null ? Number(updateData.distance) : Number(activity.distance);
          if (isNaN(newDistance) || newDistance < 0) {
            return res.status(400).json({ error: 'Distance must be a non-negative number' });
          }
          const mode = updateData.transportMode || activity.transportMode || 'car';
          co2e = await emissionController.calculateCommuteEmissions(newDistance, mode);

          updateData.distance = newDistance;
          updateData.transportMode = mode;
          break;
        }

        case 'food': {
          const newQuantity = updateData.quantity != null ? Number(updateData.quantity) : Number(activity.quantity);
          if (isNaN(newQuantity) || newQuantity < 0) {
            return res.status(400).json({ error: 'Quantity must be a non-negative number' });
          }
          const fType = updateData.foodType || activity.foodType || 'vegetables';
          const u = updateData.unit || activity.unit || 'kg';
          co2e = await emissionController.calculateFoodEmissions(fType, newQuantity, u);

          updateData.quantity = newQuantity;
          updateData.foodType = fType;
          updateData.unit = u;
          break;
        }

        case 'electricity': {
          const newEnergy = updateData.energyConsumed != null ? Number(updateData.energyConsumed) : Number(activity.energyConsumed);
          if (isNaN(newEnergy) || newEnergy < 0) {
            return res.status(400).json({ error: 'Energy consumed must be a non-negative number' });
          }
          const eUnit = updateData.energyUnit || activity.energyUnit || 'kwh';
          co2e = await emissionController.calculateElectricityEmissions(newEnergy, eUnit);

          updateData.energyConsumed = newEnergy;
          updateData.energyUnit = eUnit;
          break;
        }
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