import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const files = {
  "stackflow-backend/.env": [
    "DB_URI=mongodb://127.0.0.1:27017/stackflow",
    "PORT=5000",
    "FRONTEND_URL=http://localhost:5173",
    "ACCESS_SECRET=" + randomBytes(40).toString("hex"),
    "REFRESH_SECRET=" + randomBytes(40).toString("hex"),
    "NODE_ENV=development",
    "",
  ].join("\n"),
  "stackflow-frontend/.env": "VITE_API_BASE_URL=http://localhost:5000\n",
};
for (const [relative, content] of Object.entries(files)) {
  try {
    await writeFile(fileURLToPath(new URL(relative, root)), content, {
      flag: "wx",
    });
    console.log("Created " + relative);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log("Kept existing " + relative + " unchanged.");
  }
}
console.log("Configuration ready. Start MongoDB, then run npm run dev.");
