require("dotenv").config({});
const prettyjson = require("prettyjson"); // prettyjson body-parser cookie-parser json-beautify cors
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
var beautify = require("json-beautify");
const cors = require("cors");
const express = require("express");
const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const socketIo = require("socket.io");
const { exec } = require("child_process");

//OLD npm imongoose colors jsonwebtoken
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const uri_ext = "/graphql";
const jwt = require("jsonwebtoken");
// const { SubscriptionServer } = require("subscriptions-transport-ws");
// const { execute, subscribe } = require("graphql");
const filePath = path.join(__dirname, "typeDefs.graphql");
const typeDefs = fs.readFileSync(filePath, "utf-8");
const resolvers = require("./Graphql");
const ConnectDB = require("./db");
const app = express();
const https = require("https");
const http = require("http");

// const fs = require('fs');
const ServicesCatalog_REST_Routes = require("./routes/ServicesCatalog");

const options = {
  key: fs.readFileSync("localhost.key"),
  cert: fs.readFileSync("localhost.crt"),
};

// const app = https.createServer(options, (req, res) => {
//   res.writeHead(200);
//   res.end('Hello from HTTPS!');
// });

// ServicesCatalog
// const oauthRoutes = require( "./Graphql/Mutations/Event" )

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});
app.options("*", cors());
const corsOptions = {
  origin: "https://pheocconnect.com:4000/graphql",
  credentials: true,
  optionSuccessStatus: 200,
};

const corsOptions2 = {
  origin: "https://pheocconnect.com:4000",
  credentials: true,
  optionSuccessStatus: 200,
};

(cors({
  origin: "*",
  credentials: true,
}),
  app.use(cors(corsOptions, corsOptions2)));
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);
app.use("/graphql", function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Content-Length, X-Requested-With",
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(bodyParser.json());
app.use(cookieParser());

const port = 4000;
// npm i express cors express-graphql graphql@14 express-graphql @graphql-tools/schema
// In-memory data store

const executableSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
  context: ({ req, res }) => ({
    req,
    res,
  }),
});

app.use(cors());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  }),
);
// db
// git push && cd .. && cd client && git push
ConnectDB();
// Entrypoint
app.use(
  "/graphql",
  graphqlHTTP({
    schema: executableSchema,
    context: ({ req, res }) => ({
      req,
      res,
    }),
    graphiql: true,
  }),
);
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Origin", "https://pheocconnect.com:3000");
  res.header("Access-Control-Allow-Origin", "http://192.168.1.64:3000");

  res.header("Access-Control-Allow-Origin", "http://192.168.1.66:3000");
  next();
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Origin", "pheocconnect.com");
  next();
});

app.use("/api/v1/services", ServicesCatalog_REST_Routes);
// scp /home/arasoftea/Desktop/xxx/cloudclinic.com/* root@your_droplet_ip:/cloudclinc/server
// app.use("/api/v1/blog-post", BlogPost_REST_Routes);

// app.use("/api/v1/product", Product_REST_Routes);
// ServicesCatalog_REST_Routes

// app.use( "/api/v1/campaign", CampaignPoster_REST_Routes );
// app.use( "/api/v1/resource", DigitalResource_REST_Routes )

// app.use( "/auth", oauthRoutes )

// app.use("/api/v1/media-album", MediaAlbum_REST_Routes);
// app.use("/api/v1/auth", Auth_REST_Routes);
// app.use("/api/v1/users", User_REST_Routes);
app.get("/api/v1/fetch-image", async (req, res) => {
  try {
    const imageUrl = req.query.url; // Get the image URL from the query string
    console.log({
      imageUrl: imageUrl,
    });
    const response = await fetch(imageUrl);
    const imageBuffer = await response.buffer();
    console.log({
      processedImageUrl: imageBuffer,
    });

    res.contentType("image/jpg"); // Set the appropriate content type
    res.send(imageBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching and serving the image.");
  }
});
// app.use("/api/v1/flashmessage", FlashMessage_REST_Routes);
// app.use("/api/v1/extension", Extension_REST_Routes);
// app.use("/api/v1/event", Event_REST_Routes);

app.post("/mpesa/callback", (req, res) => {
  const callbackData = req.body;
  console.log("Callback data:", callbackData);

  // Handle the callback data and update the transaction status in your database
  // You can also perform other required actions based on the transaction status

  // Respond to the callback to acknowledge receipt (Status code 200)
  res.status(200).end();
});
// require('../server/Graphql/Mutations/Event')(app);

const httpServer = http.createServer(app); // Create an HTTP server using the Express app
const socketIO = require("socket.io");
const io = socketIO(httpServer);

app.get("/", (req, res) => {
  res.send("Hello world!");
});
io.on("connection", (socket) => {
  // Emit the `newUser` event when a new user connects.
  socket.emit("newUser");
});

// online
/*
rm -r root@209.38.200.25:/pheocconnect.com/server 

scp -r ~/Desktop/xxx/pheocconnect.com/server/ root@209.38.200.25:/pheocconnect.com/

sudo apt-get remove nginx &&
sudo apt-get purge nginx &&
sudo apt-get autoremove


const privateKey = fs.readFileSync(
  "/etc/letsencrypt/live/pheocconnect.com/privkey.pem",
  "utf8"
);
const certificate = fs.readFileSync(
  "/etc/letsencrypt/live/pheocconnect.com/fullchain.pem",
  "utf8"
);

const credentials = { key: privateKey, cert: certificate };

const httpsServer = https.createServer(credentials, app);

httpsServer.listen(port);

  */
// offline
/**/
httpServer.listen(port, () => {
  console.log(`Server is running on https://localhost:${port}`);
});

require("dotenv").config();
const { PubSub } = require("graphql-subscriptions");
const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { createServer: createHttpsServer } = require("https");
const fs = require("fs");
const { initializeWebSocket } = require("./pollSocket");
const { ApolloServer } = require("@apollo/server");
const {
  ApolloServerPluginLandingPageGraphQLPlayground,
} = require("@apollo/server-plugin-landing-page-graphql-playground");
const { expressMiddleware } = require("@apollo/server/express4");
const voucherRoutes = require("../src/routes/voucherRoutes");
const fileRoutes = require("../src/routes/fileRoutes");
const resourceUploaders = require("../src/routes/resourceUploaders");
const { s3Deleter } = require("../src/utils/awsDeleter");

const userTypeDefs = require("./graphql/userSchema");
const paperTypeDefs = require("./graphql/paperSchema");
const resourceTypeDefs = require("./graphql/resourceSchema");
const paymentTypeDefs = require("./graphql/paymentSchema");
const departmentTypeDefs = require("./graphql/departmentSchema");
const discussionGroupTypeDefs = require("./graphql/discussionGroupSchema");
const consultationTypeDefs = require("./graphql/consultationSchema");
const vendorTypeDefs = require("./graphql/vendorSchema");

const userResolver = require("../src/resolvers/userResolvers");
const paperResolver = require("../src/resolvers/paperResolvers");
const consultationResolver = require("../src/resolvers/consultationResolvers");
const resourceResolver = require("../src/resolvers/resourceResolvers");
const vendorResolver = require("../src/resolvers/vendorResolver");
const paymentResolver = require("../src/resolvers/paymentResolvers");
const departmentResolver = require("../src/resolvers/departmentResolvers");
const discussionGroupResolver = require("../src/resolvers/discussionGroupResolvers");

const { handlePdfConversion } = require("../src/utils/pdfConverter");
const connectDB = require("../src/database/connection");
const auth = require("../src/middleware/auth");

const startServer = async () => {
  const app = express();
  const pubsub = new PubSub();

  // CORS configuration
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
    }),
  );

  app.use(express.json());
  app.use(auth);

  // Create Apollo Server
  const apolloServer = new ApolloServer({
    typeDefs: [
      userTypeDefs,
      paperTypeDefs,
      resourceTypeDefs,
      vendorTypeDefs,
      consultationTypeDefs,
      paymentTypeDefs,
      departmentTypeDefs,
      discussionGroupTypeDefs,
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
    csrfPrevention: true,
    introspection: true,
    context: async ({ req }) => ({ req, pubsub }),
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground({})],
  });

  await apolloServer.start();

  // Use middleware
  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({ req, pubsub }),
    }),
  );

  // Connect to the database
  connectDB();

  // Route configurations
  app.post("/delete-files", s3Deleter);
  app.use("/api", fileRoutes);
  app.use("/vendors", voucherRoutes);
  app.use("/resources", resourceUploaders);

  // Uncomment if PDF conversion is enabled
  // app.post("/convert-pdf", handlePdfConversion);

  // Load SSL certificate and key for HTTPS in production
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
  const port = process.env.PORT || 4000;
  httpServer.listen(port, () => {
    console.log(
      `Server ready at http${
        process.env.NODE_ENV === "production" ? "s" : ""
      }://localhost:${port}/graphql`,
    );
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
