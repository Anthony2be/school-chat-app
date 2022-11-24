import { serve } from "https://deno.land/std/http/mod.ts";

const sockets = new Set<WebSocket>(),
    channel = new BroadcastChannel("")

channel.onmessage = e => {
    (e.target != channel) && channel.postMessage(e.data)
    sockets.forEach(s => s.send(e.data))
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
    const { socket, response } = await Deno.upgradeWebSocket(req);
    sockets.add(socket);
    socket.onmessage = channel.onmessage;
    socket.onclose = () => sockets.delete(socket);
    return response;
}
serve(reqHandler, { port: 8000 });