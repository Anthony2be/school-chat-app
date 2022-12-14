import { serve } from "https://deno.land/std/http/mod.ts";

export interface Payload {
  username: string;
  data: string;
}

const rooms = new Map<string, WebSocket[]>();

const channel = new BroadcastChannel("")

function removeFromRooms(ws: WebSocket) {
  rooms.forEach((wsArray, room) => {
    if (wsArray.includes(ws)) {
      wsArray.splice(wsArray.indexOf(ws), 1);
    }
    console.log(`users in room: ${wsArray.length}`)
    if (wsArray.length === 0) {
      rooms.delete(room)
    }
  });
}

function broadcastAll(message: string) {
  for (const room of rooms.values()) {
    for (const user of room) {
      user.send(JSON.stringify({ type: "MESSAGE", data: message }));
    }
  }
}

function broadcastRoom(ws: WebSocket, message: string) {
  rooms.forEach((wsArray) => {
    if (wsArray.includes(ws)) {
      wsArray.forEach((user) =>
        user.send(JSON.stringify({ type: "MESSAGE", data: message }))
      );
    }
  });

}

function logError(msg: string) {
  console.log(msg);
}
function handleConnected(ws: WebSocket) {
  console.log("Connected to client ...");
  if (rooms.get("general")) {
    rooms.get("general")?.push(ws)
  }
  else {
    rooms.set("general", [ws])
  }

  ws.send(
    JSON.stringify({ type: "MESSAGE", data: "Server: Welcome to the chat" }),
  );
}

function handleMessage(ws: WebSocket, data: string) {
  const { type, payload }: { type: string; payload: Payload } = JSON.parse(
    data,
  );
  channel.postMessage(data)
  switch (type) {
    case "join-room":
      console.log("h");
      removeFromRooms(ws);
      if (rooms.has(payload.data)) {
        rooms.get(payload.data)?.push(ws);
      } else {
        rooms.set(payload.data, [ws]);
      }
      broadcastRoom(ws, `${payload.username} joined the room`);
      console.log(rooms);
      break;

    case "message":
      broadcastRoom(ws, `${payload.username}: ${payload.data}`);
      break;

    case "get-rooms":
      ws.send(JSON.stringify({ type: "ROOMS", data: [...rooms.keys()] }));
  }

}
function handleError(e: Event | ErrorEvent) {
  console.log(e instanceof ErrorEvent ? e.message : e.type);
}
async function reqHandler(req: Request) {
  if (req.headers.get("upgrade") != "websocket") {
    const file = await Deno.readFile("./index.html");
    return new Response(file, {
      headers: {
        "content-type": "text/html",
      },
    })
  }
  const { socket: ws, response } = Deno.upgradeWebSocket(req);
  ws.onopen = () => handleConnected(ws);
  ws.onmessage = (m) => handleMessage(ws, m.data);
  channel.onmessage = e => {
    console.log(e.target)
    console.log(channel)
    handleMessage(ws, e.data)
  }
  ws.onclose = () => {
    removeFromRooms(ws);
    logError("Disconnected from client ...");
  };
  ws.onerror = (e) => {
    removeFromRooms(ws);
    handleError(e);
  };
  return response;
}
console.log("Waiting for client ...");
rooms.set("general", []);
serve(reqHandler, { port: 8000 });
