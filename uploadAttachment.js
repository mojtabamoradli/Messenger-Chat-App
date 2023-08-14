import AWS from "aws-sdk";
import multer from "multer";
import multerS3 from "multer-s3";
import { createRouter } from "next-connect";

export const config = {
  api: {
    bodyParser: false,
  },
};

const router = createRouter();

const PersianDateInYYYMD = new Date().toLocaleDateString("fa-IR").replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728));
const [year, month, day] = PersianDateInYYYMD.split("/");
const PersianDateInYYYMMDD = `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;

const upload = multer({
  storage: multerS3({
    s3: new AWS.S3({
      endpoint: process.env.LIARA_OBJECT_STORAGE_API_ENDPOINT,
      accessKeyId: process.env.LIARA_OBJECT_STORAGE_ACCESS_KEY,
      secretAccessKey: process.env.LIARA_OBJECT_STORAGE_SECRET_KEY,
      region: "default",
    }),
    bucket: process.env.LIARA_BUCKET_NAME,
    key: async (req, file, callback) => {
      callback(null, "Chats/" + `${PersianDateInYYYMMDD}/` + `${Math.floor(Math.random() * 9000) + 1000}` + "." + file.mimetype.split("/").slice(-1));
    },
  }),
});

router.use(upload.single("file"));
router.post(async (request, response) => {
  if (!["image", "zip", "pdf", "audio"].some((type) => request.file.mimetype.includes(type))) {
    return response.status(401).json({ status: "failed", message: "Forbidden File Format! Only Images, Zip Files and PDFs are Accepted." });
  }
  if (request.file.size > 5 * 1024 * 1024) return response.status(401).json({ status: "failed", message: "File Size Must Be Less Than 5MB!" });
  response.status(200).send({
    status: "success",
    url: request.file.location,
    key: request.file.location.replace(`https://${process.env.LIARA_BUCKET_NAME}.${process.env.LIARA_OBJECT_STORAGE_API_ENDPOINT}/`, ""),
  });
});
export default router.handler({
  onError: (err, req, res) => {
    console.error(err.stack);
    res.status(err.statusCode).end(err.message);
  },
});
