import { serve } from "@hono/node-server";
import { createMambuTwin } from "./server.js";

const port = parseInt(process.env.PORT ?? "3001", 10);

const { app } = createMambuTwin();

console.log(`Mambu Digital Twin starting on port ${port}`);
console.log(`Base URL: http://localhost:${port}/api/`);
console.log(`Status:   http://localhost:${port}/api/application/status`);
console.log(`Reset:    POST http://localhost:${port}/_twin/reset`);

serve({ fetch: app.fetch, port });
