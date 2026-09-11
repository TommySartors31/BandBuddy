// ============================================================
// BandBuddy — Cloudinary configuration (audio recording storage)
// ============================================================
// Why Cloudinary instead of Firebase Storage: as of Feb 2026, Firebase
// Storage requires the pay-as-you-go Blaze plan (a linked card) even for
// zero-cost usage. Cloudinary's free tier needs no card and is built for
// exactly this: uploading files straight from browser JS with no backend.
//
// SETUP:
// 1. Go to https://cloudinary.com/users/register/free — sign up (no card).
// 2. On your Cloudinary Dashboard home page, copy your "Cloud name".
// 3. Go to Settings (gear icon) -> Upload -> scroll to "Upload presets"
//    -> "Add upload preset".
//      - Signing Mode: UNSIGNED   (required — we have no backend to sign requests)
//      - Folder: recordings
//      - Resource type: leave as Auto (Cloudinary stores audio under "video")
//      - Under "Allowed formats": enter  webm,mp3,wav,m4a,ogg
//      - Under restrictions, set a max file size (e.g. 25000000 for ~25MB)
//        to stop anyone from abusing the public upload URL for huge files.
//    Save, then copy the preset's name.
// 4. Paste both values below.
// ============================================================

export const CLOUDINARY_CLOUD_NAME = "r4gu48sp";
export const CLOUDINARY_UPLOAD_PRESET = "ml_default";

// Cloudinary's "auto" resource type detects audio/video/image/pdf automatically
// from the file itself — one upload endpoint works for recordings AND sheet
// music PDFs.
export const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
