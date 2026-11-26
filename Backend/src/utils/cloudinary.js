import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { env } from "../config/env.js";

cloudinary.config({ 
  cloud_name: env.cloudinaryCloudName, 
  api_key: env.cloudinaryApiKey, 
  api_secret: env.cloudinaryApiSecret 
});

const uploadOnCloudinary = async (localFilePath) => {  
  try {
    if (!localFilePath) {
      console.log("No local file path provided.");
      return null;
    }

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return response;

  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return null;
  }
};

export { uploadOnCloudinary };
