// @ts-ignore
import { ref } from "vue";

const pollArray = ref([]);
const activeQuestion = ref(null);
let socket: WebSocket | null = null;

export const initializePollSocket = (
  apiUrl: string,
  accessKey: string,
  accessSecret: string
) => {
  socket = new WebSocket(`${apiUrl}/ws`);

  socket.onopen = () => {
    console.log("WebSocket connection established.");

    // Request the poll from the server by sending the accessKey and accessSecret
    socket?.send(
      JSON.stringify({
        type: "fetch_poll",
        accessKey,
        accessSecret,
      })
    );
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.pollArray) {
      pollArray.value = data.pollArray;
    }

    if (data.activeQuestion) {
      activeQuestion.value = data.activeQuestion;
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed.");
  };
};

export const closePollSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};

export const usePollArray = () => pollArray;
export const useActiveQuestion = () => activeQuestion;
