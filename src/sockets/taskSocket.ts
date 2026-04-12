import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import Resource from "../models/Resource"; // Mongoose model
import { IResource } from "../models/Resource";

interface CustomWebSocket extends WebSocket {
  sessionId?: string;
  accessKey?: string;
}

// Track all connected clients
const connectedClients = new Set<CustomWebSocket>();

export const taskWSS = new WebSocketServer({ noServer: true });
console.log("✅ Task WebSocket server initialized.");

taskWSS.on("connection", (ws: CustomWebSocket, req: IncomingMessage) => {
  console.log("🔗 Client connected:", req.url);
  ws.send(JSON.stringify({ message: "Connected to Task WebSocket Server" }));

  // Add the new client to the connected clients set
  connectedClients.add(ws);

  try {
    const parsedUrl = new URL(req.url!, `http://${req.headers.host}`);
    const sessionId = parsedUrl.searchParams.get("sessionId");
    const accessKey = parsedUrl.searchParams.get("accessKey");

    if (!sessionId || !accessKey) {
      console.error("❌ Missing sessionId or accessKey");
      ws.send(JSON.stringify({ error: "Missing sessionId or accessKey" }));
      ws.close();
      return;
    }

    ws.sessionId = sessionId;
    ws.accessKey = accessKey;

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log("Received message:", message);
        await handleTaskSocket(ws, message);
      } catch (err) {
        console.error("❌ Error parsing message:", err);
        sendResponse(ws, null, "Invalid message format");
      }
    });

    ws.on("close", () => {
      console.log("❌ Client disconnected.");
      // Remove the client from the connected clients set
      connectedClients.delete(ws);
    });

    ws.on("error", (err) => {
      console.error("❌ WebSocket error:", err);
      // Remove the client from the connected clients set
      connectedClients.delete(ws);
    });
  } catch (err) {
    console.error("❌ Error parsing URL:", err);
    ws.close();
  }
});

// Helper function to send a response to a specific client
function sendResponse(
  ws: WebSocket,
  data: any | null,
  error: string | null = null
) {
  // console.log("Raw data:", data);

  // ws.send(response);
  // console.log("Response sent.");

  if (data) {
    // Broadcast only if resource is provided
    // Broadcast the updated resource to all connected clients
    broadcastToAllClients({
      action: data.action,
      data: data.data,
    });
  }
}
// Helper function to broadcast a message to all connected clients
function broadcastToAllClients(message: any) {
  const response = JSON.stringify(message);
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(response);
    }
  });
  // console.log("Broadcasted message to all clients:", response);
}

async function handleTaskSocket(ws: CustomWebSocket, message: any) {
  try {
    const { type, qstId, response } = message;
    const { accessKey, sessionId } = ws;

    if (!accessKey || !sessionId) {
      sendResponse(ws, null, "Session data missing. Reconnect and try again.");
      return;
    }

    console.log(
      `Querying for resource with sessionId: ${sessionId}, accessKey: ${accessKey}`
    );

    const resource = await Resource.findOne({
      accessKey,
      sessionId,
    })
      .populate({
        path: "createdBy",
        model: "User",
        select: {
          id: 1,
          "personalInfo.username": 1,
          "personalInfo.fullName": 1,
          "personalInfo.email": 1,
          "personalInfo.scholarId": 1,
          "personalInfo.activationToken": 1,
          "personalInfo.resetToken": 1,
          "personalInfo.tokenExpiry": 1,
          "personalInfo.activatedAccount": 1,
          role: 1,
        },
      })
      .exec();

    if (!resource) {
      sendResponse(ws, null, "Resource not found.");
      return;
    }

    // Ensure pollArray is defined and is an array
    if (
      !JSON.parse(resource.content).pollArray ||
      !Array.isArray(JSON.parse(resource.content).pollArray)
    ) {
      console.error("❌ pollArray is undefined or not an array");
      sendResponse(ws, null, "Invalid poll data.");
      return;
    }

    switch (type) {
      case "fetch_poll":
        console.log("Handling fetch_poll request");
        // Broadcast the resource to all connected clients
        broadcastToAllClients({
          action: "poll_data",
          data: resource,
        });
        break;

      case "update_active_question":
        if (!qstId) {
          sendResponse(ws, null, "Missing qstId.");
          return;
        }

        // Parse the content to access the pollArray
        const content = JSON.parse(resource.content);

        // Find the index of the question with the given qstId
        const questionIndex = content.pollArray.findIndex(
          (q: { qstId: any }) => q.qstId === qstId
        );

        if (questionIndex === -1) {
          sendResponse(ws, null, "Question not found.");
          return;
        }

        // Update the activeQuestion.qstId with the new qstId
        content.activeQuestion.qstId = qstId;

        // Save the updated content back to the resource
        resource.content = JSON.stringify(content);

        // Save the updated resource to the database
        await resource.save();

        // Broadcast the updated resource to all connected clients
        broadcastToAllClients({
          action: "poll_data",
          data: resource,
        });

        break;

      case "submit_response":
        if (!qstId || !response) {
          sendResponse(ws, null, "Missing qstId or response.");
          return;
        }

        try {
          // Parse the resource content
          const content = JSON.parse(resource.content);
          const pollArray = content.pollArray || [];

          // Find the question by qstId
          const question = pollArray.find(
            (q: { qstId: any }) => q.qstId === qstId
          );
          if (!question) {
            sendResponse(ws, null, "Question not found.");
            return;
          }

          // Initialize responses array if it doesn't exist
          question.responses = question.responses || [];
          question.responses.push(response);

          // Update the pollArray in the parsed content
          content.pollArray = pollArray;

          // Stringify the updated content and save it back to the resource
          resource.content = JSON.stringify(content);

          // Save the updated resource to the database
          await resource.save();

          // Send the updated poll data back to the client
          sendResponse(ws, {
            action: "poll_data",
            data: resource,
          });
        } catch (error) {
          console.error("Error processing submit_response:", error);
          sendResponse(
            ws,
            null,
            "An error occurred while processing the response."
          );
        }
        break;

      case "reset_all_responses":
        JSON.parse(resource.content).pollArray.forEach(
          (q: { responses: never[] }) => (q.responses = [])
        );
        await resource.save();
        // Broadcast the updated resource to all connected clients
        broadcastToAllClients({
          action: "poll_data",
          data: resource,
        });
        break;

      default:
        sendResponse(ws, null, "Invalid message type.");
    }
  } catch (error) {
    console.error("❌ TaskSocket Error:", error);
    sendResponse(ws, null, "Internal server error.");
  }
}
