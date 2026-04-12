// server.js or index.js
import dotenv from "dotenv";
dotenv.config();
import { PubSub } from "graphql-subscriptions";
import express from "express";
import cors from "cors";
import { IncomingMessage } from "http";
import { URL } from "url";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import fs from "fs";
import { pollWSS } from "./sockets/pollSocket";
import { paperWSS } from "./sockets/paperSocket";
import { posterWSS } from "./sockets/posterSocket";
import { revisionWSS } from "./sockets/revisionSocket";
import { taskWSS } from "./sockets/taskSocket";
import { tutorPlexWSS } from "./sockets/tutorPlexSocket";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "@apollo/server-plugin-landing-page-graphql-playground";
import { expressMiddleware } from "@apollo/server/express4";
import voucherRoutes from "../src/routes/voucherRoutes";
import fileRoutes from "../src/routes/fileRoutes";
import resourceUploaders from "../src/routes/resourceUploaders";
import { s3Deleter } from "../src/utils/awsDeleter";
import examTypeDefs from "./graphql/schema/examSchema";
import questionTypeDefs from "./graphql/schema/questionSchema";
import userTypeDefs from "./graphql/schema/userSchema";
import paperTypeDefs from "./graphql/schema/paperSchema";
import resourceTypeDefs from "./graphql/schema/resourceSchema";
import paymentTypeDefs from "./graphql/schema/paymentSchema";
import departmentTypeDefs from "./graphql/schema/departmentSchema";
import discussionGroupTypeDefs from "./graphql/schema/discussionGroupSchema";
import consultationTypeDefs from "./graphql/schema/consultationSchema";
import vendorTypeDefs from "./graphql/schema/vendorSchema";
import examResolver from "./graphql/resolvers/examResolvers";
import questionResolver from "./graphql/resolvers/questionResolvers";
import userResolver from "./graphql/resolvers/userResolvers";
import paperResolver from "./graphql/resolvers/paperResolvers";
import consultationResolver from "./graphql/resolvers/consultationResolvers";
import resourceResolver from "./graphql/resolvers/resourceResolvers";
import vendorResolver from "./graphql/resolvers/vendorResolver";
import paymentResolver from "./graphql/resolvers/paymentResolvers";
import departmentResolver from "./graphql/resolvers/departmentResolvers";
import discussionGroupResolver from "./graphql/resolvers/discussionGroupResolvers";
import connectDB from "../src/database/connection";
import auth from "../src/middleware/auth";

interface Context {
  pubsub: PubSub;
  req: express.Request;
}

const startServer = async () => {
  const app = express();
  const pubsub = new PubSub();

  // Connect to the database
  await connectDB();

  // Define allowed origins (specific origins, not wildcard)
  const allowedOrigins = [
    "http://192.168.43.218:8000",
    "http://localhost:8000",
    "https://nembio.com",
    "https://www.nembio.com",
    process.env.CORS_ORIGIN,
  ].filter(Boolean);

  // CORS configuration with credentials support
  const corsOptions = {
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        process.env.NODE_ENV !== "production"
      ) {
        callback(null, true);
      } else {
        console.log(`CORS blocked: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true, // Allow credentials (cookies, authorization headers)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Content-Length",
      "X-Requested-With",
      "Accept",
      "Origin",
      "apollo-require-preflight",
    ],
    exposedHeaders: ["Content-Length", "X-Requested-With"],
    optionsSuccessStatus: 200,
    maxAge: 86400, // 24 hours
  };

  // Apply CORS middleware to all routes
  app.use(cors(corsOptions));

  // Handle preflight requests explicitly
  app.options("*", cors(corsOptions));

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Apply auth middleware after CORS
  app.use(auth);

  // Create Apollo Server
  const apolloServer = new ApolloServer<Context>({
    typeDefs: [
      userTypeDefs,
      questionTypeDefs,
      examTypeDefs,
      paperTypeDefs,
      resourceTypeDefs,
      vendorTypeDefs,
      consultationTypeDefs,
      paymentTypeDefs,
      departmentTypeDefs,
      discussionGroupTypeDefs,
    ],
    resolvers: [
      examResolver,
      questionResolver,
      userResolver,
      paperResolver,
      resourceResolver,
      vendorResolver,
      consultationResolver,
      paymentResolver,
      departmentResolver,
      discussionGroupResolver,
    ],
    csrfPrevention: true,
    introspection: true,
    // ✅ REMOVE context from here - it doesn't belong in ApolloServer constructor
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground({})],
  });

  await apolloServer.start();

  // GraphQL endpoint with CORS already applied
  // ✅ FIX: Add context here in expressMiddleware
  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req }): Promise<Context> => ({ req, pubsub }),
    }),
  );

  // Other routes
  app.post("/delete-files", s3Deleter);
  app.use("/api", fileRoutes);
  app.use("/vendors", voucherRoutes);
  app.use("/resources", resourceUploaders);

  // Create HTTP server
  let httpServer;

  if (process.env.NODE_ENV === "production") {
    const privateKey = fs.readFileSync(
      "/etc/letsencrypt/live/nembio.com/privkey.pem",
      "utf8",
    );
    const certificate = fs.readFileSync(
      "/etc/letsencrypt/live/nembio.com/fullchain.pem",
      "utf8",
    );
    const credentials = { key: privateKey, cert: certificate };
    httpServer = createHttpsServer(credentials, app);
    console.log("HTTPS server created with SSL certificates");
  } else {
    httpServer = createServer(app);
    console.log("HTTP server created (development mode)");
  }

  // WebSocket upgrade handling
  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    if (!req.url || !req.headers.host) {
      console.log("Invalid WebSocket upgrade request");
      socket.destroy();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    console.log(`Incoming WebSocket upgrade request: ${req.url}`);
    console.log(`Parsed pathname: ${pathname}`);

    const upgradeMap: Record<string, any> = {
      "/paper": paperWSS,
      "/poll": pollWSS,
      "/poster": posterWSS,
      "/quiz": revisionWSS,
      "/task": taskWSS,
      "/modelling-labs": tutorPlexWSS,
    };

    const wss = upgradeMap[pathname];

    if (wss) {
      console.log(`Handling upgrade for ${pathname}`);
      wss.handleUpgrade(req, socket, head, (ws: any) => {
        console.log(`Emitting connection for ${pathname}`);
        wss.emit("connection", ws, req);
      });
    } else {
      console.log(`Rejecting upgrade request for unknown path: ${pathname}`);
      socket.destroy();
    }
  });

  const port = Number(process.env.PORT) || 4000;

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(
      `Server ready at http${process.env.NODE_ENV === "production" ? "s" : ""}://0.0.0.0:${port}/graphql`,
    );
    console.log(`CORS allowed origins: ${allowedOrigins.join(", ")}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
