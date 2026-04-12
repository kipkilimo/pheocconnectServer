import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import Question from "../models/Question";
import Exam from "../models/Exam";

interface CustomWebSocket extends WebSocket {
  sessionId?: string;
  accessKey?: string;
}

const connectedClients = new Set<CustomWebSocket>();

export const revisionWSS = new WebSocketServer({ noServer: true });
console.log("✅ Revision WebSocket server initialized.");

revisionWSS.on("connection", (ws: CustomWebSocket, req: IncomingMessage) => {
  console.log("🔗 Client connected:", req.url);
  ws.send(
    JSON.stringify({ message: "Connected to Revision WebSocket Server" })
  );

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
        console.log("📩 Received message:", message);
        await handleRevisionSocket(ws, message);
      } catch (err) {
        console.error("❌ Error parsing message:", err);
        sendToClient(ws, { action: "error", error: "Invalid message format" });
      }
    });

    ws.on("close", () => {
      console.log("❌ Client disconnected.");
      connectedClients.delete(ws);
    });

    ws.on("error", (err) => {
      console.error("❌ WebSocket error:", err);
      connectedClients.delete(ws);
    });
  } catch (err) {
    console.error("❌ Error parsing URL:", err);
    ws.close();
  }
});

function sendToClient(ws: WebSocket, message: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToAllClients(message: any) {
  const response = JSON.stringify(message);
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(response);
    }
  });
}

async function handleRevisionSocket(ws: CustomWebSocket, message: any) {
  try {
    // ✅ Fix: map 'type' to 'action' internally
    const { type: action, questionId, response } = message;

    switch (action) {
      case "request_question":
        if (!questionId) {
          sendToClient(ws, { action: "error", error: "Missing questionId." });
          return;
        }

        console.log("request_question with id:", questionId);
        const question = await Question.findOne({ _id: questionId })
          .select({
            id: 1,
            shortId: 1,
            stem: 1,
            choices: 1,
            correctAnswers: 1,
            explanation: 1,
            tags: 1,
            specialty: 1,
            topic: 1,
            difficulty: 1,
            questionType: 1,
            createdAt: 1,
            updatedAt: 1,
            metrics: 1,
          })
          .lean()
          .exec();

        if (!question) {
          sendToClient(ws, { action: "error", error: "Question not found." });
          return;
        }
        broadcastToAllClients({
          action: "question_data",
          data: question,
        });
        console.log("✅ Question data:", question);
        sendToClient(ws, {
          action: "question_data",
          data: question,
        });
        break;
      case "submit_response":
        try {
          // The message should already be parsed as JSON by the WebSocket library
          const responseData = Array.isArray(response) ? response[0] : response;

          console.log({ dataResponseFinal: responseData });
          if (!responseData) {
            sendToClient(ws, {
              action: "error",
              error: "Missing response payload.",
            });
            return;
          }

          broadcastToAllClients({
            action: "dashboard_data",
            data: responseData,
          });

          sendToClient(ws, {
            action: "response_ack",
            success: true,
          });
        } catch (error) {
          console.error("Error processing response:", error);
          sendToClient(ws, {
            action: "error",
            error: `Error processing response: ${error}`,
          });
        }
        break;

      default:
        sendToClient(ws, { action: "error", error: "Invalid message type." });
    }
  } catch (error) {
    console.error("❌ RevisionSocket Error:", error);
    sendToClient(ws, { action: "error", error: "Internal server error." });
  }
}
