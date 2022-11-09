import { serve } from "https://deno.land/std/http/mod.ts";

export interface Payload{
  username: string;
  data: string;
}

const rooms = new Map<string, WebSocket[]>();

function broadcastAll(message: string) {
  for (const room of rooms.values()) {
    for (const user of room) {
      user.send(message);
    }
  }
}

function broadcastRoom(ws: WebSocket,message: string) {
  rooms.forEach(wsArray => {
    if(wsArray.includes(ws)){
      wsArray.forEach(user => user.send(message));
    }
  });
}

function logError(msg: string) {
  console.log(msg);
  Deno.exit(1);
}
function handleConnected(ws: WebSocket) {
  console.log("Connected to client ...");
  rooms.get("general")?.push(ws);
  ws.send("Server: Welcome to the chat");
}
function handleMessage(ws: WebSocket, data: string) {
  const { type, payload }: {type:string, payload:Payload } = JSON.parse(data);
  switch (type) {
    case "join-room":
      console.log("h")
      rooms.forEach(wsArray => {
        if(wsArray.includes(ws)){
          wsArray.splice(wsArray.indexOf(ws), 1);
        }
      });
      if (rooms.has(payload.data)) {
        rooms.set(payload.data, []);
      }
      else{
        rooms.get(payload.data)?.push(ws);
      }
      broadcastRoom(ws, `${payload.username} joined the room`);
      console.log(rooms);
      break;
    case "message": {
      broadcastRoom(ws, `${payload.username}: ${payload.data}`);
      break;
    }
  }
}
function handleError(e: Event | ErrorEvent) {
  console.log(e instanceof ErrorEvent ? e.message : e.type);
}
function reqHandler(req: Request) {
  if (req.headers.get("upgrade") != "websocket") {
    return new Response(null, { status: 501 });
  }
  const { socket: ws, response } = Deno.upgradeWebSocket(req);
  ws.onopen = () => handleConnected(ws);
  ws.onmessage = (m) => handleMessage(ws, m.data);
  ws.onclose = () => logError("Disconnected from client ...");
  ws.onerror = (e) => handleError(e);
  return response;
}
console.log("Waiting for client ...");
rooms.set("general", []);
serve(reqHandler, { port: 8000 });
