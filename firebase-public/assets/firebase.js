import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  collection, deleteDoc, doc, getDoc, getDocs, getFirestore,
  orderBy, query, setDoc, writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCb0k2lm1X5OyA3QENN731yOv4KwGjBkHw",
  authDomain: "gabrielweb-db0c7.firebaseapp.com",
  projectId: "gabrielweb-db0c7",
  storageBucket: "gabrielweb-db0c7.firebasestorage.app",
  messagingSenderId: "638995960060",
  appId: "1:638995960060:web:7a49329e5efcf4d5370779",
};

export const ADMIN_EMAIL = "trujillogabirel584@gmail.com";
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const defaultProfile = {
  heroKicker: "Hola, soy Gabriel Herrera",
  heroTitle: "Desarrollo sitios web con creatividad y apoyo de inteligencia artificial.",
  heroDescription: "Soy desarrollador web principiante y autodidacta. Creo experiencias modernas para pequeños negocios y proyectos informativos mientras continúo aprendiendo.",
  aboutText: "Soy Gabriel Herrera, desarrollador web principiante y autodidacta. Comencé a estudiar programación por mi cuenta porque es un área que comprendo con facilidad y en la que disfruto convertir ideas en proyectos reales.",
  aboutSecondary: "Trabajo con HTML, CSS, JavaScript, Python y bases de datos. Utilizo la inteligencia artificial como apoyo para investigar, aprender y explorar soluciones; después reviso, adapto y pruebo cada resultado para entender su funcionamiento.",
  contactTitle: "¿Tienes una idea para una página web?",
  contactText: "Estoy abierto a proyectos que me permitan seguir aprendiendo, adquirir experiencia y crear soluciones útiles para negocios, emprendimientos o proyectos personales.",
  contactEmail: "",
};

export const defaultServices = [
  { id:"service-business", title:"Sitios para negocios", description:"Páginas para restaurantes, tiendas de ropa y barberías con información clara, servicios, horarios y formas de contacto.", icon:"store", sortOrder:1, active:true },
  { id:"service-info", title:"Páginas informativas", description:"Sitios para presentar una persona, emprendimiento, actividad, producto o servicio de manera ordenada y atractiva.", icon:"layout", sortOrder:2, active:true },
  { id:"service-responsive", title:"Diseño adaptable", description:"Interfaces cómodas de navegar desde computadoras, tablets y teléfonos celulares.", icon:"devices", sortOrder:3, active:true },
  { id:"service-improvements", title:"Mejoras y mantenimiento", description:"Organización de contenido, ajustes visuales y mejoras funcionales en proyectos existentes.", icon:"sparkles", sortOrder:4, active:true },
];

// Los proyectos pertenecen solamente a Firebase. Una lista vacía es un
// estado válido y no debe volver a crear demostraciones que el administrador
// ya eliminó.
export const defaultProjects = [];

const byOrder = (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
const rows = (snapshot) => snapshot.docs.map((item) => ({ id:item.id, ...item.data() }));

export async function loadHomeData() {
  try {
    const [profileSnap, serviceSnap] = await Promise.all([
      getDoc(doc(db, "site", "main")),
      getDocs(query(collection(db, "services"), orderBy("sortOrder"))),
    ]);
    const services = rows(serviceSnap);
    return {
      profile: profileSnap.exists() ? { ...defaultProfile, ...profileSnap.data() } : defaultProfile,
      services: services.length ? services : defaultServices,
    };
  } catch (error) {
    console.warn("Firebase no está disponible; se muestra el contenido incluido.", error);
    return { profile:defaultProfile, services:defaultServices };
  }
}

export async function loadPublishedProjects() {
  const snapshot = await getDocs(query(collection(db, "publishedProjects"), orderBy("sortOrder")));
  return rows(snapshot).sort(byOrder);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function resetAdminPassword(email) {
  return sendPasswordResetEmail(auth, email.trim());
}

export function logout() { return signOut(auth); }
export function isAdmin(user) { return Boolean(user?.email && user.email.toLowerCase() === ADMIN_EMAIL); }

export async function loadAdminData() {
  const [profileSnap, serviceSnap, projectSnap] = await Promise.all([
    getDoc(doc(db, "site", "main")),
    getDocs(query(collection(db, "services"), orderBy("sortOrder"))),
    getDocs(query(collection(db, "projects"), orderBy("sortOrder"))),
  ]);
  const services = rows(serviceSnap).sort(byOrder);
  const projects = rows(projectSnap).sort(byOrder);
  return {
    profile: profileSnap.exists() ? { ...defaultProfile, ...profileSnap.data() } : { ...defaultProfile },
    services: services.length ? services : structuredClone(defaultServices),
    projects,
  };
}

export async function seedDefaultsIfEmpty() {
  const profileSnap = await getDoc(doc(db, "site", "main"));
  if (profileSnap.exists()) return;
  const batch = writeBatch(db);
  batch.set(doc(db, "site", "main"), { ...defaultProfile, updatedAt:Date.now() });
  defaultServices.forEach((service) => batch.set(doc(db, "services", service.id), service));
  await batch.commit();
}

export async function saveContent(profile, services) {
  const existing = await getDocs(collection(db, "services"));
  const batch = writeBatch(db);
  batch.set(doc(db, "site", "main"), { ...profile, updatedAt:Date.now() });
  existing.docs.forEach((item) => batch.delete(item.ref));
  services.forEach((service, index) => batch.set(doc(db, "services", service.id), { ...service, sortOrder:index + 1 }));
  await batch.commit();
}

export async function saveProject(project) {
  const clean = { ...project, sortOrder:Number(project.sortOrder || 0), updatedAt:Date.now() };
  await setDoc(doc(db, "projects", clean.id), clean);
  if (clean.published) await setDoc(doc(db, "publishedProjects", clean.id), clean);
  else await deleteDoc(doc(db, "publishedProjects", clean.id));
}

export async function removeProject(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "projects", id));
  batch.delete(doc(db, "publishedProjects", id));
  await batch.commit();
}

