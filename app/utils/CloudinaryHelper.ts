const CLOUD_NAME = 'dwdsrtyim';

export const getSignVideoUrl = (publicId: string | null | undefined): string | null => {
  if (!publicId) return null;
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/q_auto,f_auto/v1/${publicId}.mp4`;
};