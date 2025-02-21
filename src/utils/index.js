import multer from "multer";
import multerS3 from "multer-s3";
import { s3 } from "../helpers/Aws.js";
import config from "../config/config.js";

export const multerUpload = multer({
    storage: multerS3({
        s3: s3,
        bucket: config.bucketName,
        acl: "public-read", // Set the access control list (ACL) policy for the file
        key: function (req, file, cb) {
            cb(null, `uploads/${Date.now()}-${file.originalname}`); // Set the file path and name
        },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
});

export const parseJSON = (data) => {
    try {
        return JSON.parse(data);
    } catch (err) {
        console.error(err);
        return {};
    }
}

export const stringifyJSON = (data) => {
    try {
        return JSON.stringify(data);
    } catch (err) {
        console.error(err);
        return '{}';
    }
}