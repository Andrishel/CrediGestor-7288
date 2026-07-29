import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authed } from "../middleware/auth";
import { s3 } from "../lib/s3";

// Genera una URL prefirmada para subir archivos directamente a Tigris.
// Carpeta = userId (aislamiento por usuario). Devuelve {url, key}.
export const upload = {
  presign: authed
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        folder: z.enum(["vouchers", "qr-pagos", "fotos-clientes"]),
      }),
    )
    .handler(async ({ input, context }) => {
      const safe = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `${input.folder}/${context.user.id}/${Date.now()}-${safe}`;
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          ContentType: input.contentType,
        }),
        { expiresIn: 600 },
      );
      return { url, key };
    }),
};
