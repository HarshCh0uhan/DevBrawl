import mongoose from "mongoose";
import { DB_NAME } from "../../constants.js";
import { env } from "./env.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${env.mongoUri}/${DB_NAME}`, 
            {
           // useNewUrlParser: true,
            //useUnifiedTopology: true,
            writeConcern: { w: "majority" }, 
        }
    );

        console.log(`\n✅ MongoDB connected! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.error("❌ MONGODB connection FAILED:", error);
        process.exit(1);
    }
};

export { connectDB };