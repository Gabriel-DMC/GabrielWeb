// Public upload configuration. NEVER add an API secret to browser code.
// Configure the unsigned preset in Cloudinary with allowed_formats=jpg,png,webp,
// max_file_size=5242880 and disallow_public_id=true.
export const CLOUDINARY_CONFIG = Object.freeze({
  cloudName: "zbsniieb",
  uploadPreset: "gabrielweb_proyects",
});
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function uploadError(message) {
  return Object.assign(new Error(message), { code: "cloudinary/upload" });
}

export function validateProjectImage(file) {
  if (!file || !IMAGE_TYPES.has(file.type)) {
    throw uploadError("Selecciona una imagen JPG, PNG o WebP.");
  }
  if (!file.size) throw uploadError("La imagen está vacía. Selecciona otro archivo.");
  if (file.size > MAX_IMAGE_BYTES) throw uploadError("La imagen supera los 5 MB. Reduce su tamaño y vuelve a intentarlo.");
}

export function uploadProjectImage(file, onProgress = () => {}, config = CLOUDINARY_CONFIG) {
  validateProjectImage(file);
  if (!/^[a-z0-9_-]+$/i.test(config.cloudName) || !config.uploadPreset.trim()) {
    throw uploadError("Falta conectar Cloudinary: configura el Cloud name y el Upload preset antes de subir imágenes.");
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`);
    request.responseType = "json";
    request.timeout = 120000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    request.onerror = () => reject(uploadError("No se pudo conectar con Cloudinary. Revisa tu conexión y vuelve a intentarlo."));
    request.ontimeout = () => reject(uploadError("La carga tardó demasiado. Comprueba tu conexión e inténtalo otra vez."));
    request.onabort = () => reject(uploadError("La carga se canceló. Vuelve a seleccionar la imagen."));
    request.onload = () => {
      const image = request.response;
      if (request.status < 200 || request.status >= 300) {
        reject(uploadError(request.status === 400 || request.status === 401
          ? "Cloudinary rechazó la imagen. Revisa el preset: debe permitir cargas unsigned, JPG, PNG y WebP de hasta 5 MB."
          : "Cloudinary no pudo guardar la imagen. Comprueba los límites de tu cuenta e inténtalo nuevamente."));
        return;
      }
      if (image?.resource_type !== "image" || !image.public_id ||
          typeof image.secure_url !== "string" || !image.secure_url.startsWith("https://res.cloudinary.com/")) {
        reject(uploadError("Cloudinary no devolvió una imagen válida. Inténtalo nuevamente."));
        return;
      }
      resolve({ url: image.secure_url, publicId: image.public_id });
    };
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", config.uploadPreset);
    request.send(body);
  });
}

