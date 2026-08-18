Rifa Server (Node/Express + SQLite)

This is a small backend intended to be deployed on Render or run locally. It stores raffles in a SQLite database and exposes a minimal REST API.

Endpoints
- GET /api/health
- GET /api/raffles
- POST /api/raffles  { name, config, numbers }
- GET /api/raffles/:id
- PUT /api/raffles/:id  { name, config, numbers, winner }
- POST /api/raffles/:id/draw  -> runs secure server-side draw among paid numbers

Security & notes
- Uses helmet, cors and express-rate-limit for basic protection.
- Uses crypto.randomInt for secure randomness.
- For production, secure the endpoint with authentication (e.g., API key or OAuth). The current scaffold is minimal and intended to be extended.

Deploying to Render
1. Add the repository to Render as a Web Service.
2. Build command: npm install
3. Start command: npm start
4. Set environment variable PORT if needed.

Database persistence
- By default the SQLite DB file will be created at server/rifa.db. On Render, you can configure a persistent disk or use a managed DB and change DB_PATH accordingly.
