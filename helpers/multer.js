// const multer = require("multer")
// const path = require('path')

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {  
//         cb(null, path.join(__dirname, "../public/uploads/re-image"));
//     },
//     filename: (req, file, cb) => {  
//         cb(null, Date.now() + "-" + file.originalname);
//     }
// });

// module.exports = storage


// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// // Define the upload directory
// const uploadDir = path.join(__dirname, "../public/uploads/re-image");

// // Check if the directory exists; if not, create it
// if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir, { recursive: true });
//     console.log("Created upload directory:", uploadDir);
// }

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, uploadDir);
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + "-" + file.originalname);
//     }
// });

// const upload = multer({ storage: storage });
// module.exports = upload;
const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/products');  // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// File filter for images
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Create the multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = upload;