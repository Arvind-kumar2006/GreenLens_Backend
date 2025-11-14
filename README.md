# GreenLens Backend API

Backend API for the GreenLens Carbon Footprint Calculator application.

## Features

- Calculate carbon emissions for:
  - Commute (car, bus, train, plane, motorcycle, bicycle, walking)
  - Food consumption
  - Electricity usage
- Store and manage activities
- Get emissions statistics and reports
- Integration with Climatiq API for accurate emission calculations

## Tech Stack

- Node.js
- Express.js
- MongoDB (Mongoose)
- Climatiq API

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the Backend directory:
```env
MONGODB_URI=mongodb://localhost:27017/carbonfootprint
CLIMATIQ_API_KEY=your_climatiq_api_key_here
PORT=5000
```

3. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Activities
- `POST /api/activities` - Create a new activity
- `GET /api/activities` - Get all activities
- `GET /api/activities/:id` - Get activity by ID
- `PUT /api/activities/:id` - Update activity
- `DELETE /api/activities/:id` - Delete activity

### Emissions
- `POST /api/emissions/calculate` - Calculate emissions without saving
- `GET /api/emissions/total` - Get total emissions
- `GET /api/emissions/period` - Get emissions grouped by period

## Environment Variables

- `MONGODB_URI` - MongoDB connection string
- `CLIMATIQ_API_KEY` - Climatiq API key for emission calculations
- `PORT` - Server port (default: 5000)

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## License

ISC

