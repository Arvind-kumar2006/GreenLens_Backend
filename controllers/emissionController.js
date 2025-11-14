const axios = require("axios");
const Activity = require("../models/Activity");

// Correct Climatiq URL (only this works)
const CLIMATIQ_API_KEY = process.env.CLIMATIQ_API_KEY;
const CLIMATIQ_API_URL = 'https://api.climatiq.io/data/v1/estimate';

/**
 * COMMUTE EMISSIONS
 */
const calculateCommuteEmissions = async (distance, transportMode) => {
  // define emissionFactors at function scope so the catch block can reference it
  const emissionFactors = {
    car: "passenger_ferry-route_type_car_passenger-fuel_source_na",
    bus: "passenger_vehicle-vehicle_type_local_bus-fuel_source_na-distance_na-engine_size_na",
    train: "passenger_train-route_type_light_rail_and_tram-fuel_source_na",
    plane: "passenger_vehicle-vehicle_type_aircraft-fuel_source_na-distance_na",
    motorcycle: "passenger_vehicle-vehicle_type_upper_medium_car-fuel_source_na-engine_size_na-vehicle_age_na-vehicle_weight_na",
    bicycle: null,
    walking: null,
  };

  try {
    // Use the emissionFactors already defined above
    const factor = emissionFactors[transportMode] || emissionFactors.car;

    // bicycle/walking → zero emissions
    if (!factor) return 0;

    const num = Number(distance);
    if (isNaN(num) || num < 0) return 0;

    // Try with region and year for better accuracy
    const response = await axios.post(
      CLIMATIQ_API_URL,
      {
        emission_factor: {
          activity_id: factor,
          region: "GB", // Default to US, can be made configurable
        },
        parameters: {
          distance: num,
          distance_unit: "km",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CLIMATIQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.co2e || 0;
  } catch (err) {
    console.error("Commute API error:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
      activity_id: emissionFactors[transportMode] || emissionFactors.car
    });

    // Fallback to manual calculation if API fails
    const fallback = {
      car: 0.21,
      bus: 0.089,
      train: 0.041,
      plane: 0.255,
      motorcycle: 0.113,
      bicycle: 0,
      walking: 0,
    };

    const distanceNum = Number(distance);
    return (fallback[transportMode] || fallback.car) * (isNaN(distanceNum) ? 0 : distanceNum);
  }
};

/**
 * FOOD EMISSIONS
 */
const calculateFoodEmissions = async (foodType, quantity, unit = "kg") => {
  const q = Number(quantity);
  if (isNaN(q) || q < 0) return 0;

  let kg = q;
  if (unit === "g") kg = q / 1000;
  if (unit === "lb") kg = q * 0.453592;

  const factors = {
    beef: 27,
    pork: 12.1,
    chicken: 6.9,
    fish: 5.1,
    dairy: 3.2,
    vegetables: 2,
    fruits: 1.1,
    grains: 2.7,
  };

  return kg * (factors[foodType] || 2);
};

/**
 * ELECTRICITY EMISSIONS
 */
const calculateElectricityEmissions = async (energyConsumed, energyUnit = "kwh") => {
  try {
    let kWh = Number(energyConsumed);
    if (isNaN(kWh) || kWh < 0) return 0;
    if (energyUnit === "mwh") kWh = kWh * 1000;

    const response = await axios.post(
      CLIMATIQ_API_URL,
      {
        emission_factor: {
          activity_id: "electricity-supply_grid-source_residual_mix",
        },
        parameters: {
          energy: kWh,
          energy_unit: "kWh",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CLIMATIQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.co2e || 0;
  } catch (err) {
    console.error("Electricity API error:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
    
    const energyNum = Number(energyConsumed);
    return (isNaN(energyNum) ? 0 : energyNum) * 0.475; // fallback
  }
};

/**
 * MAIN CALCULATOR
 */
const calculateEmissions = async (req, res) => {
  const { activityType } = req.body;

  if (!activityType)
    return res.status(400).json({ error: "Activity type is required" });

  let co2e = 0;

  if (activityType === "commute") {
    co2e = await calculateCommuteEmissions(
      req.body.distance,
      req.body.transportMode
    );
  } else if (activityType === "food") {
    co2e = await calculateFoodEmissions(
      req.body.foodType,
      req.body.quantity,
      req.body.unit
    );
  } else if (activityType === "electricity") {
    co2e = await calculateElectricityEmissions(
      req.body.energyConsumed,
      req.body.energyUnit
    );
  } else {
    return res.status(400).json({ error: "Invalid activity type" });
  }

  res.json({ success: true, co2e, unit: "kg" });
};

/**
 * TOTAL EMISSIONS
 */
const getTotalEmissions = async (req, res) => {
  const { userId = "default-user", startDate, endDate } = req.query;
  const query = { userId };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const activities = await Activity.find(query);
  const total = activities.reduce((sum, x) => sum + x.co2e, 0);

  res.json({
    success: true,
    totalCo2e: total,
    count: activities.length,
    activities,
  });
};

/**
 * GROUP EMISSIONS
 */
const getEmissionsByPeriod = async (req, res) => {
  const { userId = "default-user", period = "day", days = 7 } = req.query;

  const start = new Date();
  start.setDate(start.getDate() - Number(days));

  const list = await Activity.find({
    userId,
    date: { $gte: start },
  }).sort({ date: 1 });

  const groups = {};

  list.forEach((a) => {
    const d = new Date(a.date);
    let key = d.toISOString().split("T")[0];

    if (period === "week") {
      const ws = new Date(d);
      ws.setDate(d.getDate() - d.getDay());
      key = ws.toISOString().split("T")[0];
    }

    if (!groups[key]) groups[key] = { date: key, co2e: 0 };
    groups[key].co2e += a.co2e;
  });

  res.json({ success: true, data: Object.values(groups) });
};

module.exports = {
  calculateEmissions,
  getTotalEmissions,
  getEmissionsByPeriod,
  calculateCommuteEmissions,
  calculateFoodEmissions,
  calculateElectricityEmissions,
};