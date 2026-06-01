/**
 * Helper to upload a file to Cloudinary using Unsigned Upload Presets.
 * Uses native fetch API for lightweight, client-side uploading.
 * 
 * @param {File} file - The file object from <input type="file">
 * @returns {Promise<string>} The secure HTTPS URL of the uploaded image
 */
export async function uploadToCloudinary(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary configuration is missing. Please define VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env.local file."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to upload to Cloudinary (Status: ${response.status})`
    );
  }

  const data = await response.json();
  return data.secure_url;
}
