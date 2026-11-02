import "dotenv/config";
import app from "./src/app.js";

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`FinWise AI is listening on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing FinWise AI server...`);
  server.close(() => {
    process.exit(0);
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
