import http from "http";
import { config } from "./config.js";
import { createApp } from "./createApp.js";
import { attachRealtime } from "./realtime.js";

const app = createApp();
const server = http.createServer(app);

const store = app.get("store");
attachRealtime(server, store);
app.set("notifyRoom", (roomCode) => store.notifyRoom?.(roomCode));

server.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
