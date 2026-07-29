import { client } from "./api";

type Folder = "vouchers" | "qr-pagos" | "fotos-clientes";

/** Sube un archivo a Tigris vía URL prefirmada y devuelve la key almacenada. */
export async function uploadFile(
  file: File,
  folder: Folder,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { url, key } = await client.upload.presign({
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    folder,
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Error al subir")));
    xhr.onerror = () => reject(new Error("Error de red al subir"));
    xhr.send(file);
  });

  return key;
}
