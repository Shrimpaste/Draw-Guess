import http from "node:http";
import { config } from "./config.js";
import { closeDatabase } from "./db.js";
import { createApp } from "./createApp.js";
import { attachRealtime } from "./realtime.js";

const app = createApp();
const server = http.createServer(app);
const store = app.get("store");
const realtime = attachRealtime(server, store);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  store.dispose();
  for (const socket of realtime.clients) socket.terminate();
  realtime.close();
  server.close(() => { store.dispose(); closeDatabase(); process.exit(0); });
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
server.listen(config.port, config.host, () => {
  console.log(`Server listening on http://${config.host}:${config.port}`);
});
