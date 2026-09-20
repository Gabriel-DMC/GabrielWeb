import { loadHomeData, loadPublishedProjects } from "./firebase.js?v=20260920-2";

const iconMap = { store:"⌂", layout:"▦", devices:"▣", sparkles:"✦", code:"</>" };
const text = (id, value) => { const node = document.getElementById(id); if (node && value != null) node.textContent = value; };
let lightboxImages = [];
let lightboxTitle = "";
let lightboxIndex = 0;
let lightboxReturnFocus = null;

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
  grid.setAttribute("aria-busy", "false");
  if (!projects.length) { grid.innerHTML = `<p class="empty-state">Todavía no hay proyectos publicados.</p>`; return; }
  grid.innerHTML = projects.map((project, index) => `
    <button class="project-card" data-project="${escapeHtml(project.id)}" aria-label="Ver detalles de ${escapeHtml(project.title)}">
      <div class="project-image-wrap"><img src="${optimizedImage(project.coverImage, { width:900, height:560, crop:"fill" })}" alt="Vista previa de ${escapeHtml(project.title)}" width="900" height="560" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" ${index === 0 ? 'fetchpriority="high"' : ''}><span>${String(index + 1).padStart(2, "0")}</span></div>
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
    const images = (project.gallery?.length ? project.gallery : [project.coverImage]).filter(Boolean);
    const media = dialog.querySelector(".dialog-media");
    const previews = images.slice(0, 3);
    media.className = `dialog-media gallery-count-${Math.min(images.length, 3)}`;
    media.innerHTML = previews.map((src, i) => {
      const remaining = i === 2 && images.length > 3 ? `<span class="gallery-more">+${images.length - 3}</span>` : "";
      return `<button type="button" class="gallery-tile" data-image-index="${i}" aria-label="Abrir imagen ${i + 1} de ${images.length}"><img src="${optimizedImage(src, { width:i ? 650 : 1200, height:i ? 440 : 900, crop:"fill" })}" alt="${escapeHtml(project.title)}, imagen ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}" decoding="async">${remaining}<span class="gallery-open" aria-hidden="true">⤢</span></button>`;
    }).join("");
    media.querySelectorAll(".gallery-tile").forEach((tile) => tile.addEventListener("click", () => openLightbox(images, project.title, Number(tile.dataset.imageIndex), tile)));
    text("dialog-status", project.status); text("dialog-title", project.title); text("dialog-description", project.description);
    dialog.querySelector(".technology-list").innerHTML = (project.technologies || []).map((technology) => `<span>${escapeHtml(technology)}</span>`).join("");
    dialog.querySelector(".dialog-action").innerHTML = project.projectUrl
      ? `<a class="button-primary dialog-link" href="${safeUrl(project.projectUrl)}" target="_blank" rel="noreferrer">Visitar proyecto ↗</a>`
      : `<div class="demo-note"><span>Este es un proyecto académico o demostrativo. El enlace público se agregará cuando esté disponible.</span></div>`;
    dialog.scrollTop = 0;
    media.scrollTop = 0;
    dialog.showModal();
    requestAnimationFrame(() => { dialog.scrollTop = 0; media.scrollTop = 0; });
  }));
  dialog.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
}

function setupLightbox() {
  const lightbox = document.getElementById("project-lightbox");
  if (!lightbox) return;
  lightbox.querySelector(".lightbox-close")?.addEventListener("click", closeLightbox);
  lightbox.querySelector(".lightbox-previous")?.addEventListener("click", () => moveLightbox(-1));
  lightbox.querySelector(".lightbox-next")?.addEventListener("click", () => moveLightbox(1));
  let touchStartX = 0;
  const image = lightbox.querySelector(".lightbox-image");
  image?.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0]?.clientX || 0; }, { passive:true });
  image?.addEventListener("touchend", (event) => {
    const distance = (event.changedTouches[0]?.clientX || 0) - touchStartX;
    if (Math.abs(distance) > 50) moveLightbox(distance > 0 ? -1 : 1);
  }, { passive:true });
  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); closeLightbox(); }
    if (event.key === "ArrowLeft") moveLightbox(-1);
    if (event.key === "ArrowRight") moveLightbox(1);
  });
}

function openLightbox(images, title, index, trigger) {
  const lightbox = document.getElementById("project-lightbox");
  if (!lightbox || !images.length) return;
  lightboxImages = images;
  lightboxTitle = title;
  lightboxIndex = Math.max(0, Math.min(index, images.length - 1));
  lightboxReturnFocus = trigger;
  lightbox.hidden = false;
  updateLightbox();
  lightbox.querySelector(".lightbox-close")?.focus({ preventScroll:true });
}

function closeLightbox() {
  const lightbox = document.getElementById("project-lightbox");
  if (!lightbox) return;
  lightbox.hidden = true;
  lightboxReturnFocus?.focus({ preventScroll:true });
}

function moveLightbox(direction) {
  if (lightboxImages.length < 2) return;
  lightboxIndex = (lightboxIndex + direction + lightboxImages.length) % lightboxImages.length;
  updateLightbox();
}

function updateLightbox() {
  const lightbox = document.getElementById("project-lightbox");
  if (!lightbox) return;
  const image = lightbox.querySelector(".lightbox-image");
  image.src = optimizedImage(lightboxImages[lightboxIndex], { width:1800 });
  image.alt = `${lightboxTitle}, imagen ${lightboxIndex + 1} de ${lightboxImages.length}`;
  lightbox.querySelector(".lightbox-counter").textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
  const single = lightboxImages.length < 2;
  lightbox.querySelector(".lightbox-previous").hidden = single;
  lightbox.querySelector(".lightbox-next").hidden = single;
  const thumbnails = lightbox.querySelector(".lightbox-thumbnails");
  thumbnails.innerHTML = lightboxImages.map((src, index) => `<button type="button" data-lightbox-index="${index}" class="${index === lightboxIndex ? "is-active" : ""}" aria-label="Ver imagen ${index + 1}"><img src="${optimizedImage(src, { width:180, height:120, crop:"fill" })}" alt="" loading="lazy"></button>`).join("");
  thumbnails.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    lightboxIndex = Number(button.dataset.lightboxIndex);
    updateLightbox();
  }));
  thumbnails.querySelector(".is-active")?.scrollIntoView({ block:"nearest", inline:"center" });
}

function escapeHtml(value="") { const span=document.createElement("span"); span.textContent=String(value); return span.innerHTML; }
function safeUrl(value="") { try { const url=new URL(value); return ["http:","https:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; } }
function safeImage(value="") { return value.startsWith("/") ? value : safeUrl(value); }
function optimizedImage(value="", { width=1200, height, crop="limit" }={}) {
  const safe = safeImage(value);
  try {
    const url = new URL(safe, location.origin);
    if (url.hostname !== "res.cloudinary.com" || !url.pathname.includes("/image/upload/")) return safe;
    const dimensions = [`w_${width}`, height ? `h_${height}` : "", `c_${crop}`].filter(Boolean).join(",");
    url.pathname = url.pathname.replace("/image/upload/", `/image/upload/f_auto,q_auto:eco,dpr_auto,${dimensions}/`);
    return url.href;
  } catch { return safe; }
}

function renderProjectsError() {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;
  grid.setAttribute("aria-busy", "false");
  grid.innerHTML = `<p class="empty-state">No fue posible cargar los proyectos en este momento. Inténtalo nuevamente en unos segundos.</p>`;
}

setupNavigation();
setupLightbox();
if (document.body.dataset.page === "home") {
  const data = await loadHomeData();
  renderHome(data.profile, data.services);
}
if (document.body.dataset.page === "projects") {
  try {
    const projects = await loadPublishedProjects();
    renderProjects(projects.filter((item) => item.published !== false));
  } catch (error) {
    console.warn("No fue posible cargar los proyectos publicados.", error);
    renderProjectsError();
  }
}

