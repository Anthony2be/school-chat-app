// listenAndServe is the Deno standard mechanism for creating an HTTP server
// https://deno.land/manual/examples/http_server#using-the-codestdhttpcode-library
import { serve } from "https://deno.land/std/http/mod.ts";

// Set of all of the currently open WebSocket connections from browsers
const sockets = new Set<WebSocket>(),
    /*
    BroadcastChannel is a concept that is unique to the Deno Deploy environment.
    
    https://deno.com/deploy/docs/runtime-broadcast-channel/
    
    It is modelled after the browser API of the same name.
    
    It sets up a channel between ALL instances of the server-side script running
    in every one of the Deno Deploy global network of data centers.
    
    The argument is the name of the channel, which apparently can be an empty string.
    */
    channel = new BroadcastChannel(""),
    headers = { "Content-type": "text/html" },
    /*
    This is the bare-bones HTML for the browser side of the application
    
    It creates a WebSocket connection back to the host, and sets it up so any
    message that arrives via that WebSocket will be appended to the textContent
    of the pre element on the page.
    
    The input element has an onkeyup that checks for the Enter key and sends
    the value of that element over the WebSocket channel to the server.
    */
    html = `<script>let ws = new WebSocket("wss://"+location.host)
ws.onmessage = e => pre.textContent += e.data+"\\n"</script>
<input onkeyup="event.key=='Enter'&&ws.send(this.value)"><pre id=pre>`

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