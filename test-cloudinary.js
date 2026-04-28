require('dotenv').config({ path: '.env' });
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const buffer = Buffer.from('Test PDF content for Cloudinary');

const uploadStream = cloudinary.uploader.upload_stream(
  { folder: 'trilink_uploads/textbooks/test', resource_type: 'auto' },
  (error, result) => {
    if (error) {
      console.error('CLOUDINARY ERROR:');
      console.error(error);
    } else {
      console.log('SUCCESS:', result.secure_url);
    }
  }
);
streamifier.createReadStream(buffer).pipe(uploadStream);
