import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth }      from 'firebase/auth';

const firebaseConfig = {
  apiKey:            'AIzaSyBv9nSSXs-2YEAKncvh-p13UamHawE4TRE',
  authDomain:        'muebles-rafaela.firebaseapp.com',
  projectId:         'muebles-rafaela',
  storageBucket:     'muebles-rafaela.firebasestorage.app',
  messagingSenderId: '358551405184',
  appId:             '1:358551405184:web:85a004635861c962e7dc65'
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ── Cloudinary (imágenes) ────────────────────────────────────────────
// Completá estos dos valores con los de tu cuenta de Cloudinary
export const CLOUDINARY_CLOUD_NAME   = 'dc74ogekb';
export const CLOUDINARY_UPLOAD_PRESET = 'muebles-rafaela'; // el preset unsigned que creaste

export async function subirImagenCloudinary(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'muebles_rafaela');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      if (xhr.status === 200) resolve(data.secure_url);
      else reject(new Error(data.error?.message || 'Error al subir imagen'));
    };

    xhr.onerror = () => reject(new Error('Error de red al subir imagen'));
    xhr.send(formData);
  });
}
