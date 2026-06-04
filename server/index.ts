import { createApp } from "./app";

const port = Number(process.env.PORT || 5174);
const app = createApp();

app.listen(port, () => {
  console.log(`AI Speaking Coach API listening on http://127.0.0.1:${port}`);
});
