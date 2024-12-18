import type { Request, Response } from "express";
import express from "express"
import { createClient } from "redis";
import dotenv from "dotenv";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";

dotenv.config();

let subList:string[] = []

const redisPublisher = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

const redisSubscriber = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisPublisher.on("error", (err) => console.error("Redis Publisher Error", err));
redisSubscriber.on("error", (err) => console.error("Redis Subscriber Error", err));

(async () => {
  await redisPublisher.connect();
  await redisSubscriber.connect();
  console.log("Connected to Redis");
})();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());



app.get("/", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post("/send-message", async (req: Request, res: Response) => {
  const { room, message } = req.body;

  try {
    await redisPublisher.publish(room, message);
    res.status(200).json({ message: "Message sent" });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

io.on("connection", (socket: Socket) => {
  console.log("A user connected");

  socket.on("join room", (room: string) => {
    console.log(`User joined room: ${room}`); 
    socket.join(room);
    console.log(subList)
    if (!subList.includes(room)) {	 
    	redisSubscriber.subscribe(room,(message)=>{
		console.log(room)
		io.to(room).emit("chat message",message)
    	});
    	subList.push(room)
    }
    
  });

  socket.on("chat message", (data: { room: string, message: string }) => {
    const { room, message } = data;
    redisPublisher.publish(room, message);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

