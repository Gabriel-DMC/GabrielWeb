# Gabriel | Desarrollo Web

Portafolio público de Gabriel Herrera. La versión de producción es un sitio estático adaptable a teléfonos, tablets y computadoras, con un panel de administración protegido por Firebase Authentication y datos almacenados en Cloud Firestore.

## Estructura

- `firebase-public/`: archivos listos para Cloudflare Pages y Firebase Hosting.
- `firebase-public/admin/`: panel de administración.
- `firestore.rules`: reglas de seguridad; solo `trujillogabirel584@gmail.com` puede editar.
- `firebase.json`: configuración de Firebase Hosting clásico.

## Publicación

### Cloudflare Pages

- Nombre del proyecto: `gabrielweb`
- Directorio de salida: `firebase-public`
- No requiere comando de compilación.

### Firebase Hosting

```bash
firebase deploy --only hosting,firestore:rules --project gabrielweb-db0c7
```

## Administración

Visita `/admin/` e inicia sesión con la cuenta autorizada. Los proyectos aceptan una URL de imagen pública; Firebase Storage no se usa para mantener el proyecto dentro del plan gratuito Spark.

## Desarrollo local

Sirve `firebase-public/` con cualquier servidor HTTP estático. Por ejemplo:

```bash
python -m http.server 8080 --directory firebase-public
```
