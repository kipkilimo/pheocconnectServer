import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI!);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`🚀🚀🚀🚀----------------------------------------🎉,🎉,🎉,🎉,`);
  } catch (error) {
    console.error(`Error: ${error}`);
    console.log(`⛔⛔⛔⛔----------------------------------------🚨🚨🚨🚨`);

    process.exit(1);
  }
};

export default connectDB;
