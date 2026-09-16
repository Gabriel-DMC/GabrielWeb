import {
  ADMIN_EMAIL, isAdmin, loadAdminData, loginWithEmail, logout, observeAuth,
  removeProject, resetAdminPassword, saveContent, saveProject, seedDefaultsIfEmpty,
} from "./firebase.js?v=20260914-2";
import { uploadProjectImage, validateProjectImage } from "./cloudinary.js?v=20260915-1";

let state = { profile:{}, services:[], projects:[] };
let draft = null;
let selectedImage = null;
let previewUrl = null;
let savingProject = false;
const $ = (selector) => document.querySelector(selector);
const text = (selector, value) => { const node=$(selector); if (node) node.textContent=value; };

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email=value("login-email").trim();
  const password=value("login-password");
  if (!email || !password) { text("#auth-error", "Escribe el correo y la contraseña."); return; }
  setAuthBusy(true,"Verificando tus datos…");
  try { await loginWithEmail(email,password); }
  catch (error) { text("#auth-error", friendlyError(error)); }
  finally { setAuthBusy(false); }
});
$("#reset-password").addEventListener("click", async () => {
  const email=value("login-email").trim();
  if (!email) { text("#auth-error", "Escribe primero tu correo para recibir el enlace."); return; }
  setAuthBusy(true,"Enviando enlace…");
  try { await resetAdminPassword(email); text("#auth-error", "Revisa tu correo: Firebase envió un enlace para crear o cambiar la contraseña."); }
  catch (error) { text("#auth-error", friendlyError(error)); }
  finally { setAuthBusy(false); }
});
$("#logout-button").addEventListener("click", logout);
$("#save-content").addEventListener("click", persistContent);
$("#new-service").addEventListener("click", () => {
  state.services.push({ id:crypto.randomUUID(), title:"", description:"", icon:"code", sortOrder:state.services.length + 1, active:true });
  renderServices();
});
$("#new-project").addEventListener("click", () => openProject({ id:crypto.randomUUID(), slug:"", title:"", shortDescription:"", description:"", status:"Demostración", technologies:[], coverImage:"", gallery:[], projectUrl:"", published:true, sortOrder:state.projects.length + 1 }));
$("#project-cancel").addEventListener("click", () => $("#project-dialog").close());
$("#project-save").addEventListener("click", persistProject);
$("#project-image").addEventListener("change", selectProjectImage);
$("#project-dialog").addEventListener("cancel", (event) => { if (savingProject) event.preventDefault(); });
$("#project-dialog").addEventListener("close", clearImageSelection);

document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-tab]").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.hidden = panel.dataset.panel !== button.dataset.tab);
}));

observeAuth(async (user) => {
  if (!user) { $("#auth-view").hidden=false; $("#admin-view").hidden=true; text("#auth-error", ""); return; }
  if (!isAdmin(user)) {
    await logout();
    text("#auth-error", `La cuenta ${user.email || "seleccionada"} no tiene permiso. Usa ${ADMIN_EMAIL}.`);
    return;
  }
  $("#auth-view").hidden=true; $("#admin-view").hidden=false; text("#admin-user", user.displayName || user.email);
  text("#admin-message", "Preparando tu contenido…");
  try { await seedDefaultsIfEmpty(); state=await loadAdminData(); renderAll(); text("#admin-message", "Contenido sincronizado con Firebase."); }
  catch (error) { text("#admin-message", friendlyError(error)); }
});

function renderAll() {
  const p=state.profile;
  [["hero-kicker",p.heroKicker],["hero-title",p.heroTitle],["hero-description",p.heroDescription],["about-text",p.aboutText],["about-secondary",p.aboutSecondary],["contact-title",p.contactTitle],["contact-text",p.contactText],["contact-email",p.contactEmail]].forEach(([id,value]) => { document.getElementById(id).value=value || ""; });
  renderServices(); renderProjects();
}

function renderServices() {
  $("#service-list").innerHTML=state.services.map((service,index) => `<article class="service-edit" data-service="${service.id}"><div class="service-edit-head"><b>Servicio ${index + 1}</b><div><label><input type="checkbox" data-field="active" ${service.active !== false ? "checked" : ""}> Visible</label><button type="button" data-remove aria-label="Quitar servicio">×</button></div></div><label class="admin-field"><span>Nombre</span><input data-field="title" value="${attr(service.title)}"></label><label class="admin-field"><span>Descripción</span><textarea data-field="description" rows="3">${html(service.description)}</textarea></label></article>`).join("");
  $("#service-list").querySelectorAll("[data-service]").forEach((card,index) => {
    card.querySelectorAll("[data-field]").forEach((field) => field.addEventListener("input", () => state.services[index][field.dataset.field]=field.type === "checkbox" ? field.checked : field.value));
    card.querySelector("[data-remove]").addEventListener("click", () => { state.services.splice(index,1); renderServices(); });
  });
}

function renderProjects() {
  $("#project-list").innerHTML=state.projects.length ? state.projects.map((project) => `<article data-project="${project.id}"><img src="${attr(project.coverImage || "/proyecto-restaurante.webp")}" alt=""><div><span>${project.published ? "Publicado" : "Borrador"}</span><h3>${html(project.title)}</h3><p>${html(project.shortDescription)}</p></div><div class="project-admin-actions"><button type="button" data-edit>Editar</button><button type="button" class="danger" data-delete>Eliminar</button></div></article>`).join("") : `<p class="empty-state">Todavía no hay proyectos.</p>`;
  $("#project-list").querySelectorAll("[data-project]").forEach((card) => {
    const project=state.projects.find((item) => item.id === card.dataset.project);
    card.querySelector("[data-edit]").addEventListener("click", () => openProject(project));
    card.querySelector("[data-delete]").addEventListener("click", async () => {
      if (!confirm(`¿Eliminar “${project.title}”?`)) return;
      setBusy(true,"Eliminando proyecto…");
      try { await removeProject(project.id); state.projects=state.projects.filter((item) => item.id !== project.id); renderProjects(); text("#admin-message","Proyecto eliminado."); }
      catch (error) { text("#admin-message",friendlyError(error)); } finally { setBusy(false); }
    });
  });
}

async function persistContent() {
  setBusy(true,"Guardando cambios…");
  state.profile={ heroKicker:value("hero-kicker"), heroTitle:value("hero-title"), heroDescription:value("hero-description"), aboutText:value("about-text"), aboutSecondary:value("about-secondary"), contactTitle:value("contact-title"), contactText:value("contact-text"), contactEmail:value("contact-email") };
  state.services=state.services.filter((item) => item.title.trim() && item.description.trim()).map((item,index) => ({ ...item, sortOrder:index + 1 }));
  try { await saveContent(state.profile,state.services); renderServices(); text("#admin-message","Cambios guardados correctamente."); }
  catch (error) { text("#admin-message",friendlyError(error)); } finally { setBusy(false); }
}

function openProject(project) {
  clearImageSelection();
  draft=structuredClone(project);
  valueSet("project-title",draft.title); valueSet("project-status",draft.status); valueSet("project-short",draft.shortDescription); valueSet("project-description",draft.description); valueSet("project-tech",(draft.technologies || []).join(", ")); valueSet("project-url",draft.projectUrl); $("#project-published").checked=draft.published !== false;
  showProjectPreview(draft.coverImage);
  text("#project-form-error", "");
  text("#project-image-status", draft.coverImage ? "Imagen actual. Selecciona otra solo si quieres reemplazarla." : "Selecciona una imagen para este proyecto.");
  $("#project-dialog").showModal();
}

function clearImageSelection() {
  selectedImage = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  valueSet("project-image", "");
}

function showProjectPreview(url) {
  $("#project-preview").hidden = !url;
  if (url) $("#project-preview").src = url;
  else $("#project-preview").removeAttribute("src");
}

function selectProjectImage() {
  const file = $("#project-image").files[0];
  if (!file) return;
  text("#project-form-error", "");
  try {
    validateProjectImage(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    selectedImage = file;
    previewUrl = URL.createObjectURL(file);
    showProjectPreview(previewUrl);
    text("#project-image-status", `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB. Se subirá al guardar el proyecto.`);
  } catch (error) {
    clearImageSelection();
    showProjectPreview(draft?.coverImage);
    text("#project-image-status", "Selecciona otra imagen JPG, PNG o WebP de hasta 5 MB.");
    text("#project-form-error", friendlyError(error));
  }
}

async function persistProject() {
  if (!draft || savingProject) return;
  const title=value("project-title").trim(); const shortDescription=value("project-short").trim(); const description=value("project-description").trim();
  if (!title || !shortDescription || !description) { text("#project-form-error","Completa el nombre y las dos descripciones."); return; }
  if (!selectedImage && !draft.coverImage) { text("#project-form-error", "Selecciona una imagen para el proyecto."); return; }
  text("#project-form-error", "");
  draft={ ...draft, title, slug:slug(title), status:value("project-status"), shortDescription, description, technologies:value("project-tech").split(",").map((item) => item.trim()).filter(Boolean), projectUrl:value("project-url").trim(), published:$("#project-published").checked };
  savingProject = true;
  $("#project-dialog").querySelectorAll("input, textarea, select").forEach((field) => field.disabled = true);
  $("#project-dialog").setAttribute("aria-busy", "true");
  setBusy(true,"Guardando proyecto…");
  try {
    if (selectedImage) {
      text("#project-image-status", "Subiendo imagen a Cloudinary…");
      const image = await uploadProjectImage(selectedImage, (percent) => text("#project-image-status", percent === 100 ? "Carga enviada. Cloudinary está procesando la imagen…" : `Subiendo imagen: ${percent}%`));
      draft.coverImage = image.url;
      draft.gallery = [image.url];
      draft.cloudinaryPublicId = image.publicId;
      // Keep the uploaded URL if Firebase fails, so retrying does not upload twice.
      clearImageSelection();
      showProjectPreview(image.url);
      text("#project-image-status", "Imagen subida. Guardando proyecto en Firebase…");
    }
    await saveProject(draft);
    const index=state.projects.findIndex((item) => item.id === draft.id); if (index >= 0) state.projects[index]=draft; else state.projects.push(draft);
    state.projects.sort((a,b) => Number(a.sortOrder || 0)-Number(b.sortOrder || 0)); renderProjects(); $("#project-dialog").close(); text("#admin-message","Proyecto guardado correctamente.");
  } catch (error) {
    text("#project-form-error",friendlyError(error));
    text("#project-image-status", selectedImage ? "La carga no se completó. Puedes volver a guardar para reintentarlo." : "La imagen se conserva. Vuelve a guardar para reintentar.");
  } finally {
    savingProject = false;
    $("#project-dialog").querySelectorAll("input, textarea, select").forEach((field) => field.disabled = false);
    $("#project-dialog").setAttribute("aria-busy", "false");
    setBusy(false);
  }
}

function setBusy(busy,message="") { document.querySelectorAll("button").forEach((button) => button.disabled=busy); if (message) text("#admin-message",message); }
function setAuthBusy(busy,message="") { $("#login-button").disabled=busy; $("#reset-password").disabled=busy; if (message) text("#auth-error",message); }
function value(id) { return document.getElementById(id).value; }
function valueSet(id,value) { document.getElementById(id).value=value || ""; }
function slug(value) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
function html(value="") { const node=document.createElement("span"); node.textContent=String(value); return node.innerHTML; }
function attr(value="") { return html(value).replaceAll('"',"&quot;"); }
function friendlyError(error) {
  console.error(error);
  const code=error?.code || "";
  if (code.startsWith("cloudinary/")) return error.message;
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "El correo o la contraseña no son correctos.";
  if (code.includes("invalid-email")) return "Escribe un correo electrónico válido.";
  if (code.includes("too-many-requests")) return "Hubo demasiados intentos. Espera unos minutos antes de volver a probar.";
  if (code.includes("operation-not-allowed")) return "El acceso con correo y contraseña todavía no está habilitado en Firebase.";
  if (code.includes("network-request-failed")) return "No se pudo conectar con Firebase. Comprueba tu conexión e inténtalo nuevamente.";
  if (code.includes("unauthorized-domain")) return "Este dominio todavía no está autorizado en Firebase.";
  if (code.includes("permission-denied")) return "Firebase rechazó la operación. Revisa las reglas de seguridad.";
  return "No se pudo completar la operación. Comprueba los datos e inténtalo nuevamente.";
}

