import { serve } from "https://deno.land/std/http/mod.ts";

export interface Payload {
  username: string;
  data: string;
}

const rooms = new Map<string, WebSocket[]>();

function removeFromRooms(ws: WebSocket) {
  rooms.forEach((wsArray, room) => {
    if (wsArray.includes(ws)) {
      wsArray.splice(wsArray.indexOf(ws), 1);
      if (wsArray.length === 1){
        rooms.delete(room)
      }
    }
    if (wsArray.length === 0){
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
  rooms.get("general")?.push(ws);
  ws.send(
    JSON.stringify({ type: "MESSAGE", data: "Server: Welcome to the chat" }),
  );
}
function handleMessage(ws: WebSocket, data: string) {
  const { type, payload }: { type: string; payload: Payload } = JSON.parse(
    data,
  );
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
    const { pathname } = new URL(req.url);
    if (pathname === "/"){
      const file = await Deno.readFile("./dist/index.html");
      return new Response(file, {
        headers: {
          "content-type": "text/html",
        },
      })
    }
    else {
      const file = await Deno.readFile(`./dist${pathname}`);
      let ext = pathname.split('.').pop()

      if (ext === "js"){
        ext = "javascript"
      }

      return new Response(file, {
        headers: {
          "content-type": `text/${ext}`
        },
      })
    }
    /*
    const file = await Deno.readFile("./style.css");
    // Respond to the request with the style.css file.
    return new Response(file, {
      headers: {
        "content-type": "text/css",
      },
    });*/
  }
  const { socket: ws, response } = Deno.upgradeWebSocket(req);
  ws.onopen = () => handleConnected(ws);
  ws.onmessage = (m) => handleMessage(ws, m.data);
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
