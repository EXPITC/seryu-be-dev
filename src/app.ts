import { PrismaClient } from "@prisma/client";
import bodyParser from "body-parser";
import http from "http";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import r_public from "routes/r_public";
import r_api_v1 from "routes/api/v1";
import dayjs from "dayjs";

const app = express();
const prisma = new PrismaClient();

//middleware
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.json({ limit: "50mb" }));
app.use(
  cors({
    origin: "*",
    optionsSuccessStatus: 200,
  }),
);

export const middleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  req.timeStamp = dayjs().toISOString();
  req.prisma = prisma;
  // jwt if want goes here
  next();
};

app.use(middleware);

app.use("/public", r_public);
app.use("/api/v1", r_api_v1);

// app.use("/api/v2", r_api_v2);
// app.use("/sso/v2", r_sso_v2);
// app.use("/sync/v2", r_sync_v2);

// Create an HTTP server and WebSocket server
const server = http.createServer(app);
// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// handling interception, gracefully shutdown
process.on("SIGTERM", async () => {
  // const pool = await poolPromise;
  server.close((err) => {
    console.log("server closed");
    if (err) console.error(err);
    prisma.$disconnect();
    // if (pool.connect) pool.close();
  });
});
