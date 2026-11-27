/**
 * Upload checks and user-facing error messages shared by the Scan and Compare pages,
 * so both pages accept the same files and explain failures the same way.
 */
import { CONFIG } from "./config.js";
import { ApiError } from "./api.js";

const MAX_BYTES = CONFIG.MAX_FILE_MB * 1024 * 1024;

/** Returns an error message for a file the backend would reject, or null if it is fine. */
export function validateImageFile(f) {
  if (f.size === 0) return "This file is empty. Choose a different image.";
  if (!CONFIG.ALLOWED_TYPES.includes(f.type)) return "Unsupported file type. Use a JPG, PNG or WEBP image.";
  if (f.size > MAX_BYTES) return `This image is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${CONFIG.MAX_FILE_MB} MB.`;
  return null;
}

/** Turns an error from detectWaste() into a sentence for the user. */
export function detectionErrorMessage(err) {
  if (!(err instanceof ApiError)) return "Something went wrong while preparing the image. Try again.";
  if (err.code === "network") return "Can't reach the detection service. Check that the backend is running and that API_BASE_URL in js/config.js is correct.";
  if (err.code === "timeout") return `Detection took longer than ${CONFIG.REQUEST_TIMEOUT_MS / 1000} seconds. Try again or use a smaller image.`;
  if (err.code === "invalid_response") return "The detection service sent a response CleanSight couldn't read. Please tell the backend team.";
  if (err.status === 413) return "The server rejected this image as too large.";
  if (err.status === 415 || err.status === 422) return "The server couldn't accept this file. Try a different image.";
  if (err.status === 503) return "The detection model isn't loaded on the server. Check the backend logs.";
  if (err.status >= 500) return "The detection service hit an error. Try again in a moment.";
  return `The request failed (HTTP ${err.status}).`;
}
