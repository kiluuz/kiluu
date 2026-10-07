import { io } from "socket.io-client";

// Connect through the Caddy gateway like a browser would
const socket = io("http://localhost:81/?XTransformPort=3003", {
  transports: ["websocket", "polling"],
  path: "/",
  forceNew: true,
});

socket.on("connect", () => {
  console.log("TEST CLIENT connected:", socket.id);
  // Join the room as a fake user
  socket.emit(
    "room:join",
    {
      code: process.argv[2] || "V7RZYX",
      user: { id: "test-node-user", username: "nodetester", displayName: "NodeTester", avatarUrl: null, accentColor: "#a855f7" },
    },
    (res) => {
      console.log("join result:", JSON.stringify(res).slice(0, 200));
    }
  );
});

socket.on("playback:play", (d) => console.log("RECEIVED playback:play:", d));
socket.on("playback:pause", (d) => console.log("RECEIVED playback:pause:", d));
socket.on("playback:seek", (d) => console.log("RECEIVED playback:seek:", d));
socket.on("reaction", (d) => console.log("RECEIVED reaction:", d));
socket.on("connect_error", (e) => console.log("connect_error:", e.message));

setTimeout(() => {
  console.log("done, disconnecting");
  socket.disconnect();
  process.exit(0);
}, 20000);
