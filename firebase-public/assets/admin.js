import {
  ADMIN_EMAIL, isAdmin, loadAdminData, loginWithGoogle, logout, observeAuth,
  removeProject, saveContent, saveProject, seedDefaultsIfEmpty,
} from "./firebase.js?v=20260914-1";

let state = { profile:{}, services:[], projects:[] };
let draft = null;
const $ = (selector) => document.querySelector(selector);
const text = (selector, value) => { const node=$(selector); if (node) node.textContent=value; };

$("#login-button").addEventListener("click", async () => {
  text("#auth-error", "Abriendo el acceso seguro de Google…");
  try { await loginWithGoogle(); } catch (error) { text("#auth-error", friendlyError(error)); }
});
$("#logout-button").addEventListener("click", logout);
$("#save-content").addEventListener("click", persistContent);
$("#new-service").addEventListener("click", () => {
  state.services.push({ id:crypto.randomUUID(), title:"", description:"", icon:"code", sortOrder:state.services.length + 1, active:true });
  renderServices();
});
$("#new-project").addEventListener("click", () => openProject({ id:crypto.randomUUID(), slug:"", title:"", shortDescription:"", description:"", status:"Demostración", technologies:[], coverImage:"/proyecto-restaurante.png", gallery:["/proyecto-restaurante.png"], projectUrl:"", published:true, sortOrder:state.projects.length + 1 }));
$("#project-cancel").addEventListener("click", () => $("#project-dialog").close());
$("#project-save").addEventListener("click", persistProject);

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
  $("#project-list").innerHTML=state.projects.length ? state.projects.map((project) => `<article data-project="${project.id}"><img src="${attr(project.coverImage || "/proyecto-restaurante.png")}" alt=""><div><span>${project.published ? "Publicado" : "Borrador"}</span><h3>${html(project.title)}</h3><p>${html(project.shortDescription)}</p></div><div class="project-admin-actions"><button type="button" data-edit>Editar</button><button type="button" class="danger" data-delete>Eliminar</button></div></article>`).join("") : `<p class="empty-state">Todavía no hay proyectos.</p>`;
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
  draft=structuredClone(project);
  valueSet("project-title",draft.title); valueSet("project-status",draft.status); valueSet("project-short",draft.shortDescription); valueSet("project-description",draft.description); valueSet("project-tech",(draft.technologies || []).join(", ")); valueSet("project-url",draft.projectUrl); valueSet("project-image",draft.coverImage); $("#project-published").checked=draft.published !== false;
  $("#project-preview").src=draft.coverImage || "/proyecto-restaurante.png";
  $("#project-dialog").showModal();
}

async function persistProject() {
  if (!draft) return;
  const title=value("project-title").trim(); const shortDescription=value("project-short").trim(); const description=value("project-description").trim();
  if (!title || !shortDescription || !description) { text("#project-form-error","Completa el nombre y las dos descripciones."); return; }
  const coverImage=value("project-image").trim() || "/proyecto-restaurante.png";
  draft={ ...draft, title, slug:slug(title), status:value("project-status"), shortDescription, description, technologies:value("project-tech").split(",").map((item) => item.trim()).filter(Boolean), projectUrl:value("project-url").trim(), coverImage, gallery:[coverImage], published:$("#project-published").checked };
  setBusy(true,"Guardando proyecto…");
  try {
    await saveProject(draft);
    const index=state.projects.findIndex((item) => item.id === draft.id); if (index >= 0) state.projects[index]=draft; else state.projects.push(draft);
    state.projects.sort((a,b) => Number(a.sortOrder || 0)-Number(b.sortOrder || 0)); renderProjects(); $("#project-dialog").close(); text("#admin-message","Proyecto guardado correctamente.");
  } catch (error) { text("#project-form-error",friendlyError(error)); } finally { setBusy(false); }
}

function setBusy(busy,message="") { document.querySelectorAll("button").forEach((button) => button.disabled=busy); if (message) text("#admin-message",message); }
function value(id) { return document.getElementById(id).value; }
function valueSet(id,value) { document.getElementById(id).value=value || ""; }
function slug(value) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
function html(value="") { const node=document.createElement("span"); node.textContent=String(value); return node.innerHTML; }
function attr(value="") { return html(value).replaceAll('"',"&quot;"); }
function friendlyError(error) {
  console.error(error);
  const code=error?.code || "";
  if (code.includes("popup-blocked")) return "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes o abre el panel directamente en Chrome, Safari o Firefox.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup-request")) return "La ventana de Google se cerró antes de completar el acceso.";
  if (code.includes("operation-not-supported-in-this-environment") || code.includes("web-storage-unsupported")) return "Este navegador integrado no permite el acceso con Google. Abre el panel directamente en Chrome, Safari o Firefox.";
  if (code.includes("network-request-failed")) return "No se pudo conectar con Google. Comprueba tu conexión e inténtalo nuevamente.";
  if (code.includes("unauthorized-domain")) return "Este dominio todavía no está autorizado en Firebase.";
  if (code.includes("permission-denied")) return "Firebase rechazó la operación. Revisa las reglas de seguridad.";
  return "No se pudo completar la operación. Abre el panel en Chrome, Safari o Firefox e inténtalo nuevamente.";
}

