// Dirección pública de la versión web. Cámbiala cuando la subas a Netlify (por ejemplo https://wordazo.netlify.app).
// Se usa en los enlaces de retos y en el email de permiso cuando la app no se abre desde el navegador.
export const SITE_URL = 'https://wordazo.netlify.app';

// Clave pública para los avisos (web push). La privada está guardada solo en el servidor.
export const VAPID_PUBLIC_KEY = 'BIlP-GeCze0Y6ClbVO5Nrj0QRysz4WoJiXI7ngmMCYLHniO3D2VGCuOxg5hr6iYmpnDflKz6JW3iR09xIUzVEN8';

// Límite de palabras nuevas cada 24 h (debe coincidir con el de la base de datos)
export const DAILY_WORD_LIMIT = 40;
