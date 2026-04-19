import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import https from "https";
import fs from "fs";
import { URL } from "url";
import { PubSub } from "graphql-subscriptions";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "@apollo/server-plugin-landing-page-graphql-playground";

import connectDB from "./database/connection";
import schema from "./graphql/schema";
import { context as authContext } from "./utils/authGenerator";

/* ============================================
 SINGLE WEBSOCKET: ALERT STREAM
============================================ */

import { alertWSS } from "./sockets/alertSocket";

/* ============================================
 OPTIONAL ROUTES
============================================ */
import fileRoutes from "./routes/fileRoutes";
//import { s3Deleter } from "./utils/awsDeleter";

/* ============================================
 BOOTSTRAP
============================================ */

const startServer = async () => {
  const app = express();
  const pubsub = new PubSub();

  /* ============================================
   DATABASE
  ============================================ */
  await connectDB();

  /* ============================================
   CORS CONFIG
  ============================================ */

  const allowedOrigins = [
    "http://localhost:8040",
    "http://127.0.0.1:8040",
    "https://nembio.com",
    "https://www.nembio.com",
    process.env.CORS_ORIGIN,
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (
          allowedOrigins.includes(origin) ||
          process.env.NODE_ENV !== "production"
        ) {
          return callback(null, true);
        }

        return callback(new Error("CORS blocked"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  /* ============================================
   AUTH CONTEXT
  ============================================ */

  app.use(authContext);

  /* ============================================
   APOLLO SERVER
  ============================================ */

  const apolloServer = new ApolloServer({
    schema,
    csrfPrevention: true,
    introspection: true,
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
  });

  await apolloServer.start();

  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({
        req,
        pubsub, // used for alert fan-out
      }),
    }),
  );

  /* ============================================
   REST ENDPOINTS
  ============================================ */

  // app.post("/delete-files", s3Deleter);
  app.use("/api", fileRoutes);

  /* ============================================
   SERVER (HTTP / HTTPS)
  ============================================ */

  let server: http.Server | https.Server;

  if (process.env.NODE_ENV === "production") {
    server = https.createServer(
      {
        key: fs.readFileSync("/etc/letsencrypt/live/nembio.com/privkey.pem"),
        cert: fs.readFileSync("/etc/letsencrypt/live/nembio.com/fullchain.pem"),
      },
      app,
    );

    console.log("🔐 HTTPS enabled");
  } else {
    server = http.createServer(app);
    console.log("🧪 HTTP enabled");
  }

  /* ============================================
   ALERT WEBSOCKET ONLY (SINGLE CHANNEL)
  ============================================ */

  server.on("upgrade", (req, socket, head) => {
    if (!req.url || !req.headers.host) {
      socket.destroy();
      return;
    }

    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

    if (pathname !== "/alerts") {
      socket.destroy();
      return;
    }

    alertWSS.handleUpgrade(req, socket, head, (ws: any) => {
      alertWSS.emit("connection", ws, req);
    });
  });

  /* ============================================
   START
  ============================================ */

  const PORT = Number(process.env.PORT) || 4040;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 PHEOC Server running`);
    console.log(`📡 GraphQL: /graphql`);
    console.log(`🚨 Alerts WS: /alerts`);
    console.log(`🌍 Port: ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("💥 Server failed:", err);
  process.exit(1);
});
