import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3100);

createApp().listen(port, () => {
  console.log(`Larkspur lease billing running at http://localhost:${port}`);
});
