// app/utils/CloudinaryHelper.ts
const CLOUD_NAME = 'dwdsrtyim'; // [cite: 1]

export const getSignVideoUrl = (publicId: string | null | undefined): string | null => {
  if (!publicId) return null;
  // Cấu hình q_auto, f_auto giúp video load nhanh [cite: 29]
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/q_auto,f_auto/v1/${publicId}.mp4`; // [cite: 28]
};