import { loadPublicData } from "./firebase.js";

const iconMap = { store:"⌂", layout:"▦", devices:"▣", sparkles:"✦", code:"</>" };
const text = (id, value) => { const node = document.getElementById(id); if (node && value != null) node.textContent = value; };

function setupNavigation() {
  const button = document.querySelector(".menu-button");
  const nav = document.querySelector(".nav-links");
  button?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? "×" : "☰";
  });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => nav.classList.remove("is-open")));
}

function renderHome(profile, services) {
  text("hero-kicker", profile.heroKicker); text("hero-title", profile.heroTitle); text("hero-description", profile.heroDescription);
  text("about-text", profile.aboutText); text("about-secondary", profile.aboutSecondary);
  text("contact-title", profile.contactTitle); text("contact-text", profile.contactText);
  const serviceGrid = document.getElementById("services-grid");
  if (serviceGrid) serviceGrid.innerHTML = services.filter((item) => item.active !== false).map((service, index) => `
    <article class="service-card"><div class="service-number">0${index + 1}</div><span class="service-symbol" aria-hidden="true">${iconMap[service.icon] || iconMap.code}</span><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description)}</p></article>`).join("");
  const contact = document.getElementById("contact-action");
  if (contact) contact.innerHTML = profile.contactEmail
    ? `<a class="button-primary" href="mailto:${encodeURIComponent(profile.contactEmail)}">Escribirme <span aria-hidden="true">→</span></a>`
    : `<span class="contact-pending">Medio de contacto disponible próximamente</span>`;
}

function renderProjects(projects) {
  const grid = document.getElementById("projects-grid");
  const dialog = document.getElementById("project-dialog");
  if (!grid || !dialog) return;
  if (!projects.length) { grid.innerHTML = `<p class="empty-state">Todavía no hay proyectos publicados.</p>`; return; }
  grid.innerHTML = projects.map((project, index) => `
    <button class="project-card" data-project="${escapeHtml(project.id)}" aria-label="Ver detalles de ${escapeHtml(project.title)}">
      <div class="project-image-wrap"><img src="${safeImage(project.coverImage)}" alt="Vista previa de ${escapeHtml(project.title)}" ${index > 1 ? 'loading="lazy"' : ''}><span>0${index + 1}</span></div>
      <div class="project-card-copy"><div><small>${escapeHtml(project.status)}</small><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.shortDescription)}</p></div><span class="project-open">Ver proyecto ↗</span></div>
    </button>`).join("");
  grid.querySelectorAll(".project-card").forEach((card) => card.addEventListener("click", () => {
    const project = projects.find((item) => item.id === card.dataset.project); if (!project) return;
    const rect = card.getBoundingClientRect(); const compact = matchMedia("(max-width:680px)").matches;
    const width = innerWidth * (compact ? 1 : .9); const height = compact ? innerHeight : Math.min(innerHeight * .88, 820);
    dialog.style.setProperty("--dialog-x", `${rect.left + rect.width / 2 - innerWidth / 2}px`);
    dialog.style.setProperty("--dialog-y", `${rect.top + rect.height / 2 - innerHeight / 2}px`);
    dialog.style.setProperty("--dialog-sx", String(Math.max(.12, rect.width / width)));
    dialog.style.setProperty("--dialog-sy", String(Math.max(.12, rect.height / height)));
    const images = project.gallery?.length ? project.gallery : [project.coverImage];
    dialog.querySelector(".dialog-media").innerHTML = images.map((src, i) => `<img src="${safeImage(src)}" alt="${escapeHtml(project.title)}, imagen ${i + 1}" ${i ? 'loading="lazy"' : ''}>`).join("");
    text("dialog-status", project.status); text("dialog-title", project.title); text("dialog-description", project.description);
    dialog.querySelector(".technology-list").innerHTML = (project.technologies || []).map((technology) => `<span>${escapeHtml(technology)}</span>`).join("");
    dialog.querySelector(".dialog-action").innerHTML = project.projectUrl
      ? `<a class="button-primary dialog-link" href="${safeUrl(project.projectUrl)}" target="_blank" rel="noreferrer">Visitar proyecto ↗</a>`
      : `<div class="demo-note"><span>Este es un proyecto académico o demostrativo. El enlace público se agregará cuando esté disponible.</span></div>`;
    dialog.showModal();
  }));
  dialog.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
}

function escapeHtml(value="") { const span=document.createElement("span"); span.textContent=String(value); return span.innerHTML; }
function safeUrl(value="") { try { const url=new URL(value); return ["http:","https:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; } }
function safeImage(value="") { return value.startsWith("/") ? value : safeUrl(value); }

setupNavigation();
const data = await loadPublicData();
if (document.body.dataset.page === "home") renderHome(data.profile, data.services);
if (document.body.dataset.page === "projects") renderProjects(data.projects.filter((item) => item.published !== false));
