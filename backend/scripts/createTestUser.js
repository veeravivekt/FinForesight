import mongoose from "mongoose";
import User from "../shared/models/User.js";
import dotenv from "dotenv";

dotenv.config();

const createTestUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Check if test user already exists
    const existingUser = await User.findOne({ email: "test@finforesight.com" });
    
    if (existingUser) {
      console.log("Test user already exists!");
      console.log("Email: test@finforesight.com");
      console.log("Password: test123");
      await mongoose.connection.close();
      return;
    }

    // Create test user
    const testUser = new User({
      name: "Test User",
      email: "test@finforesight.com",
      password: "test123",
    });

    await testUser.save();
    console.log("Test user created successfully!");
    console.log("Email: test@finforesight.com");
    console.log("Password: test123");
    
    await mongoose.connection.close();
  } catch (error) {
    console.error("Error creating test user:", error);
    process.exit(1);
  }
};

createTestUser();

