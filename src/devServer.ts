import dotenv from "dotenv";
dotenv.config();
import { PubSub } from "graphql-subscriptions";
import express from "express";
import cors from "cors";
import { createServer } from "http"; // Import http module to create HTTP server
import { initializeWebSocket } from "./pollSocket";

import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "@apollo/server-plugin-landing-page-graphql-playground";
import { expressMiddleware } from "@apollo/server/express4";

import voucherRoutes from "../src/routes/voucherRoutes";
import fileRoutes from "../src/routes/fileRoutes";
import resourceUploaders from "../src/routes/resourceUploaders";
import { s3Deleter } from "../src/utils/awsDeleter";

import userTypeDefs from "./graphql/schema/userSchema";
import paperTypeDefs from "./graphql/schema/paperSchema";
import resourceTypeDefs from "./graphql/schema/resourceSchema";
import paymentTypeDefs from "./graphql/schema/paymentSchema";
import departmentTypeDefs from "./graphql/schema/departmentSchema";
import DiscussionGroupTypeDefs from "./graphql/schema/discussionGroupSchema";
import consultationTypeDefs from "./graphql/schema/consultationSchema";
import vendorTypeDefs from "./graphql/schema/vendorSchema";

import userResolver from "./graphql/resolvers/userResolvers";
import paperResolver from "./graphql/resolvers/paperResolvers";
import consultationResolver from "./graphql/resolvers/consultationResolvers";
import resourceResolver from "./graphql/resolvers/resourceResolversssss";
import vendorResolver from "./graphql/resolvers/vendorResolver";
import paymentResolver from "./graphql/resolvers/paymentResolvers";
import departmentResolver from "./graphql/resolvers/departmentResolvers";
import discussionGroupResolver from "./graphql/resolvers/discussionGroupResolvers";

import { handlePdfConversion } from "../src/utils/pdfConverter";
import connectDB from "../src/database/connection";
import auth from "../src/middleware/auth";

// Define the context interface
interface Context {
  pubsub: PubSub;
  // Add other context properties if needed
}
// Configure CORS with specific origins in production

const startServer = async () => {
  const app = express();
  const pubsub = new PubSub();
  // Configure CORS with specific origins in production
  app.use(
    cors({
      origin: "*", // Replace with your allowed origins
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(express.json()); // Use express.json() middleware here

  app.use(auth);

  const apolloServer = new ApolloServer<Context>({
    typeDefs: [
      userTypeDefs,
      paperTypeDefs,
      resourceTypeDefs,
      vendorTypeDefs,
      consultationTypeDefs,
      paymentTypeDefs,
      departmentTypeDefs,
      DiscussionGroupTypeDefs,
    ],
    resolvers: [
      userResolver,
      paperResolver,
      resourceResolver,
      vendorResolver,
      consultationResolver,
      paymentResolver,
      departmentResolver,
      discussionGroupResolver,
    ],
    //@ts-ignore
    context: async ({ req }) => ({
      pubsub,
      // Add other context properties if needed
    }),
    csrfPrevention: true,
    introspection: true,
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground({})],
  });

  await apolloServer.start();

  // Attach Apollo Server as middleware
  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({
        pubsub,
        // Add other context properties if needed
      }),
    }),
  );

  connectDB();

  // CORS setup
  app.use(
    cors({
      origin: "*",
      credentials: true,
    }),
  );

  // Use the file routes
  app.post("/delete-files", s3Deleter);
  app.use("/api", fileRoutes);
  app.use("/vendors", voucherRoutes);
  app.use("/resources", resourceUploaders);

  // Uncomment if PDF conversion is enabled
  // app.post("/convert-pdf", handlePdfConversion);

  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize the WebSocket server
  initializeWebSocket(httpServer);

  // Start the server
  httpServer.listen(process.env.PORT, () => {
    console.log(`Server ready at http://localhost:${process.env.PORT}/graphql`);
  });
};

startServer();
