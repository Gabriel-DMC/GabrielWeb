import {
  ADMIN_EMAIL, isAdmin, loadAdminData, loginWithEmail, logout, observeAuth,
  removeProject, resetAdminPassword, saveContent, saveProject, seedDefaultsIfEmpty,
} from "./firebase.js?v=20260920-2";
import { uploadProjectImage, validateProjectImage } from "./cloudinary.js?v=20260915-1";

let state = { profile:{}, services:[], projects:[] };
let draft = null;
let galleryItems = [];
let coverItemId = "";
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
$("#project-image").addEventListener("change", selectProjectImages);
$("#project-dialog").addEventListener("cancel", (event) => { if (savingProject) event.preventDefault(); });
$("#project-dialog").addEventListener("close", clearGalleryEditor);

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
  $("#project-list").innerHTML=state.projects.length ? state.projects.map((project) => `<article data-project="${project.id}"><img src="${attr(project.coverImage || "/favicon.svg")}" alt=""><div><span>${project.published ? "Publicado" : "Borrador"}</span><h3>${html(project.title)}</h3><p>${html(project.shortDescription)}</p></div><div class="project-admin-actions"><button type="button" data-edit>Editar</button><button type="button" class="danger" data-delete>Eliminar</button></div></article>`).join("") : `<p class="empty-state">Todavía no hay proyectos.</p>`;
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
  clearGalleryEditor();
  draft=structuredClone(project);
  valueSet("project-title",draft.title); valueSet("project-status",draft.status); valueSet("project-short",draft.shortDescription); valueSet("project-description",draft.description); valueSet("project-tech",(draft.technologies || []).join(", ")); valueSet("project-url",draft.projectUrl); $("#project-published").checked=draft.published !== false;
  const publicIds=new Map((draft.galleryAssets || []).map((item) => [item.url,item.publicId]));
  const urls=[draft.coverImage,...(draft.gallery || [])].filter((url,index,list) => url && list.indexOf(url) === index);
  galleryItems=urls.map((url,index) => ({ id:`saved-${index}`, url, publicId:publicIds.get(url) || (url === draft.coverImage ? draft.cloudinaryPublicId || "" : ""), file:null, previewUrl:null }));
  coverItemId=galleryItems.find((item) => item.url === draft.coverImage)?.id || galleryItems[0]?.id || "";
  text("#project-form-error", "");
  renderImageGallery();
  $("#project-dialog").showModal();
}

function clearGalleryEditor() {
  galleryItems.forEach((item) => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  galleryItems=[];
  coverItemId="";
  valueSet("project-image", "");
}

function renderImageGallery() {
  const gallery=$("#project-image-gallery");
  if (!galleryItems.length) {
    gallery.innerHTML='<p class="project-image-empty">Todavía no hay imágenes. Selecciona al menos una para guardar el proyecto.</p>';
    text("#project-image-status", "Selecciona una o varias imágenes para el proyecto.");
    return;
  }
  gallery.innerHTML=galleryItems.map((item,index) => {
    const isCover=item.id === coverItemId;
    const source=item.previewUrl || item.url;
    const name=item.file?.name || `Imagen ${index + 1}`;
    return `<article class="project-image-item ${isCover ? "is-cover" : ""}" data-image-id="${attr(item.id)}"><img src="${attr(source)}" alt="${attr(name)}">${isCover ? '<span class="project-image-badge">Portada</span>' : ""}<div class="project-image-actions">${isCover ? '<button type="button" disabled>Portada actual</button>' : '<button type="button" data-cover>Usar como portada</button>'}<button type="button" class="remove-image" data-remove-image>Quitar</button></div></article>`;
  }).join("");
  gallery.querySelectorAll("[data-image-id]").forEach((card) => {
    card.querySelector("[data-cover]")?.addEventListener("click", () => { coverItemId=card.dataset.imageId; renderImageGallery(); });
    card.querySelector("[data-remove-image]").addEventListener("click", () => removeGalleryImage(card.dataset.imageId));
  });
  const pending=galleryItems.filter((item) => item.file).length;
  text("#project-image-status", `${galleryItems.length} ${galleryItems.length === 1 ? "imagen" : "imágenes"} en el proyecto${pending ? `; ${pending} ${pending === 1 ? "pendiente de subir" : "pendientes de subir"}` : ""}. Elige cuál será la portada.`);
}

function removeGalleryImage(id) {
  const index=galleryItems.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [removed]=galleryItems.splice(index,1);
  if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  if (coverItemId === id) coverItemId=galleryItems[0]?.id || "";
  renderImageGallery();
}

function selectProjectImages() {
  const files=[...$("#project-image").files];
  if (!files.length) return;
  text("#project-form-error", "");
  const errors=[];
  let added=0;
  files.forEach((file) => {
    try {
      validateProjectImage(file);
      const duplicate=galleryItems.some((item) => item.file && item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified);
      if (duplicate) return;
      const item={ id:crypto.randomUUID(), url:"", publicId:"", file, previewUrl:URL.createObjectURL(file) };
      galleryItems.push(item);
      if (!coverItemId) coverItemId=item.id;
      added++;
    } catch (error) { errors.push(friendlyError(error)); }
  });
  valueSet("project-image", "");
  renderImageGallery();
  if (errors.length) text("#project-form-error", [...new Set(errors)].join(" "));
  else if (!added) text("#project-form-error", "Las imágenes seleccionadas ya están en la galería.");
}

async function persistProject() {
  if (!draft || savingProject) return;
  const title=value("project-title").trim(); const shortDescription=value("project-short").trim(); const description=value("project-description").trim();
  if (!title || !shortDescription || !description) { text("#project-form-error","Completa el nombre y las dos descripciones."); return; }
  if (!galleryItems.length) { text("#project-form-error", "El proyecto debe conservar al menos una imagen."); return; }
  text("#project-form-error", "");
  draft={ ...draft, title, slug:slug(title), status:value("project-status"), shortDescription, description, technologies:value("project-tech").split(",").map((item) => item.trim()).filter(Boolean), projectUrl:value("project-url").trim(), published:$("#project-published").checked };
  savingProject=true;
  $("#project-dialog").querySelectorAll("input, textarea, select").forEach((field) => field.disabled=true);
  $("#project-dialog").setAttribute("aria-busy", "true");
  setBusy(true,"Guardando proyecto…");
  try {
    const pendingTotal=galleryItems.filter((item) => item.file).length;
    let uploaded=0;
    for (const item of galleryItems) {
      if (!item.file) continue;
      const number=uploaded + 1;
      text("#project-image-status", `Subiendo imagen ${number} de ${pendingTotal}…`);
      const image=await uploadProjectImage(item.file, (percent) => text("#project-image-status", `Subiendo imagen ${number} de ${pendingTotal}: ${percent}%`));
      item.url=image.url;
      item.publicId=image.publicId;
      item.file=null;
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      item.previewUrl=null;
      uploaded++;
      renderImageGallery();
    }
    const coverItem=galleryItems.find((item) => item.id === coverItemId) || galleryItems[0];
    draft.coverImage=coverItem.url;
    draft.gallery=galleryItems.map((item) => item.url);
    draft.galleryAssets=galleryItems.filter((item) => item.publicId).map((item) => ({ url:item.url, publicId:item.publicId }));
    delete draft.cloudinaryPublicId;
    if (coverItem.publicId) draft.cloudinaryPublicId=coverItem.publicId;
    text("#project-image-status", "Imágenes listas. Guardando proyecto en Firebase…");
    await saveProject(draft);
    const index=state.projects.findIndex((item) => item.id === draft.id); if (index >= 0) state.projects[index]=draft; else state.projects.push(draft);
    state.projects.sort((a,b) => Number(a.sortOrder || 0)-Number(b.sortOrder || 0)); renderProjects(); $("#project-dialog").close(); text("#admin-message","Proyecto guardado correctamente.");
  } catch (error) {
    text("#project-form-error",friendlyError(error));
    text("#project-image-status", "Las imágenes que terminaron de subir se conservarán al reintentar.");
  } finally {
    savingProject=false;
    $("#project-dialog").querySelectorAll("input, textarea, select").forEach((field) => field.disabled=false);
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

