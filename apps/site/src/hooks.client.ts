import type { HandleClientError } from "@sveltejs/kit";

// A missing page is expected on a static site; log only real failures.
export const handleError: HandleClientError = ({ error, status, message }) => {
  // eslint-disable-next-line no-console -- keep reporting real client errors
  if (status !== 404) console.error(error);
  return { message };
};
