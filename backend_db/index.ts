import type { Request, Response } from "express";
import express from "express"
import { Sequelize, DataTypes, Model } from "sequelize";
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

(async () => {
  await redisClient.connect();
  console.log("Connected to Redis");
})();

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
});

class Item extends Model {
  public id!: number;
  public key!: string;
  public value!: string;
}

Item.init(
  {
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Item",
    tableName: "items",
  }
);

sequelize.sync({ alter: true }).then(() => {
  console.log("Database synced");
});

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/data/:key", async(req:Request,res:Response)=>{
  const { key } = req.params;

  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return res.status(200).json({
        source: "cache",
        data: JSON.parse(cachedData),
      });
    }

    const item = await Item.findOne({ where: { key } });
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    await redisClient.setEx(key, 60, JSON.stringify(item));

    return res.status(200).json({
      source: "database",
      data: item,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/data", async (req: Request, res: Response) => {
  const { key, value } = req.body;

  try {
    const item = await Item.create({ key, value });
    res.status(201).json(item);
  } catch (error) {
    console.error("Error creating item:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/data/:key", async (req: Request, res: Response) => {
  const { key } = req.params;

  try {
    await redisClient.del(key);
    res.status(200).json({ message: `Cache cleared for key: ${key}` });
  } catch (error) {
    console.error("Error clearing cache:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

