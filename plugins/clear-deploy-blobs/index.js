import { rm } from "node:fs/promises";

const BLOB_DIRS = [
  ".netlify/v1/blobs",
  ".netlify/deploy/v1/blobs",
  ".netlify/blobs",
];

export const onPostBuild = async () => {
  await Promise.all(
    BLOB_DIRS.map((dir) => rm(dir, { recursive: true, force: true })),
  );
};
