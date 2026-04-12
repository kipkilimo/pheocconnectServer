import dotenv from "dotenv";
dotenv.config();
import { PubSub } from "graphql-subscriptions";
import express from "express";
import cors from "cors";
import { createServer } from "http"; // Import HTTP module
import { createServer as createHttpsServer } from "https"; // Import HTTPS module for production
import fs from "fs"; // Required for SSL certificate loading
import helmet from "helmet"; // For security headers
import rateLimit from "express-rate-limit"; // For rate limiting
import { initializeWebSocket } from "./pollSocket";

import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "@apollo/server-plugin-landing-page-graphql-playground";
import { expressMiddleware } from "@apollo/server/express4";

import voucherRoutes from "../src/routes/voucherRoutes";
import fileRoutes from "../src/routes/fileRoutes";
import resourceUploaders from "../src/routes/resourceUploaders";
import { s3Deleter } from "../src/utils/awsDeleter";

import userTypeDefs from "./graphql/userSchema";
import paperTypeDefs from "./graphql/paperSchema";
import resourceTypeDefs from "./graphql/resourceSchema";
import paymentTypeDefs from "./graphql/paymentSchema";
import departmentTypeDefs from "./graphql/departmentSchema";
import DiscussionGroupTypeDefs from "./graphql/discussionGroupSchema";
import consultationTypeDefs from "./graphql/consultationSchema";
import vendorTypeDefs from "./graphql/vendorSchema";

import userResolver from "../src/resolvers/userResolvers";
import paperResolver from "../src/resolvers/paperResolvers";
import consultationResolver from "../src/resolvers/consultationResolvers";
import resourceResolver from "../src/resolvers/resourceResolvers";
import vendorResolver from "../src/resolvers/vendorResolver";
import paymentResolver from "../src/resolvers/paymentResolvers";
import departmentResolver from "../src/resolvers/departmentResolvers";
import discussionGroupResolver from "../src/resolvers/discussionGroupResolvers";

import { handlePdfConversion } from "../src/utils/pdfConverter";
import connectDB from "../src/database/connection";
import auth from "../src/middleware/auth";

// Define the context interface
interface Context {
    pubsub: PubSub;
    // Add other context properties if needed
}

const startServer = async () => {
    const app = express();
    const pubsub = new PubSub();

    // Configure security settings
    app.use(helmet()); // Security headers middleware

    // Apply rate limiting to all requests
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per `window` (15 minutes)
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
    app.use(limiter);

    // Configure CORS with specific origins in production
    app.use(
        cors({
            origin: process.env.CORS_ORIGIN || "*", // Set your allowed origins
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type", "Authorization"],
        })
    );

    app.use(express.json()); // Use express.json() middleware

    app.use(auth);

    const apolloServer = new ApolloServer < Context > ({
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
            }),
        })
    );

    connectDB();

    // Route configurations
    app.post("/delete-files", s3Deleter);
    app.use("/api", fileRoutes);
    app.use("/vendors", voucherRoutes);
    app.use("/resources", resourceUploaders);

    // Uncomment if PDF conversion is enabled
    // app.post("/convert-pdf", handlePdfConversion);

    // Load SSL certificate and key for HTTPS (production only)
    let httpServer;

    if (process.env.NODE_ENV === "production") {
        const privateKey = fs.readFileSync("/path/to/ssl/privatekey.pem", "utf8");
        const certificate = fs.readFileSync("/path/to/ssl/certificate.pem", "utf8");
        const ca = fs.readFileSync("/path/to/ssl/chain.pem", "utf8");

        const credentials = { key: privateKey, cert: certificate, ca };

        // Create HTTPS server for production
        httpServer = createHttpsServer(credentials, app);
        console.log("HTTPS server created with SSL certificates");
    } else {
        // Create HTTP server for development
        httpServer = createServer(app);
        console.log("HTTP server created (development mode)");
    }

    // Initialize the WebSocket server
    initializeWebSocket(httpServer);

    // Start the server
    httpServer.listen(process.env.PORT, () => {
        console.log(
            `Server ready at http${process.env.NODE_ENV === "production" ? "s" : ""
            }://localhost:${process.env.PORT}/graphql`
        );
    });
};

startServer();
