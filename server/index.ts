import { createServer } from "node:http";
import { createApp } from "./app";
import { attachRealtimeServer } from "./realtimeServer";

const port = Number(process.env.PORT || 5174);
const app = createApp();
const server = createServer(app);
attachRealtimeServer(server, { config: app.locals.config });

server.listen(port, () => {
  console.log(`AI Speaking Coach API + realtime WS listening on http://127.0.0.1:${port}`);
});
