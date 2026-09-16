const CLOUD_NAME = 'dwdsrtyim';

export const getSignVideoUrl = (publicId: string | null | undefined): string | null => {
  if (!publicId) return null;
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/q_auto,f_auto/v1/${publicId}.mp4`;
};

// Alphabet videos may use a separate cloud; existing vocabulary URLs stay unchanged.
export const getAlphabetVideoUrl = (publicId: string | null | undefined): string | null => {
  const id = publicId?.trim();
  if (!id) return null;
  const cloudName = process.env.EXPO_PUBLIC_ALPHABET_CLOUDINARY_CLOUD_NAME?.trim() || CLOUD_NAME;
  const path = id.split('/').map(encodeURIComponent).join('/');
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/video/upload/f_mp4,vc_h264/q_auto/${path}.mp4`;
};
