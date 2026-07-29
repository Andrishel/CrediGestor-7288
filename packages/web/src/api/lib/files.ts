import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "./s3";

/** Devuelve una URL GET firmada para mostrar un objeto privado de Tigris. */
export async function signGet(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  try {
    return await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
      { expiresIn: 3600 },
    );
  } catch {
    return null;
  }
}
