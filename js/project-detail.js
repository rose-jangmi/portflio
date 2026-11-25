/**
 * 프로젝트 카드 → 프로젝트 상세 보기
 */
const ProjectDetailModal = (() => {
  let root = null;
  let lastFocus = null;
  let currentProjectId = null;

  function esc(value) {
    return (window.PortfolioRender?.esc || window.CMS?.esc || String)(value ?? "");
  }

  function isValidUrl(url) {
    if (!url || typeof url !== "string") return false;
    const value = url.trim();
    return value && value !== "#" && value !== "javascript:void(0)";
  }

  function getProject(id) {
    return window.PortfolioStore?.findItem?.("projects", id) || null;
  }

  function getImages(project) {
    const source = Array.isArray(project.screenshots) && project.screenshots.length
      ? project.screenshots
      : (Array.isArray(project.images) ? project.images : []);

    if (source.length) {
      return source
        .map((url, index) => ({ url, index, field: "screenshots" }))
        .filter((image) => typeof image.url === "string" && image.url.trim());
    }

    return project.thumbnail
      ? [{ url: project.thumbnail, index: null, field: "thumbnail" }]
      : [];
  }

  function imageSource(url) {
    return window.CMS?.getImagePreviewUrl?.(url) || url;
  }

  function renderLinks(project) {
    const links = [];
    if (isValidUrl(project.github)) {
      links.push(`<a class="project-detail-modal__link" href="${esc(project.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>`);
    }
    if (isValidUrl(project.deployUrl)) {
      links.push(`<a class="project-detail-modal__link" href="${esc(project.deployUrl)}" target="_blank" rel="noopener noreferrer">Demo</a>`);
    }
    if (isValidUrl(project.youtube)) {
      links.push(`<a class="project-detail-modal__link" href="${esc(project.youtube)}" target="_blank" rel="noopener noreferrer">YouTube</a>`);
    }
    if (isValidUrl(project.href) && project.href !== "#portfolio-book") {
      let href = project.href;
      if (window.CMSNav?.resolveMenuHref) href = window.CMSNav.resolveMenuHref(href);
      else if (window.CMSNav?.resolveHref) href = window.CMSNav.resolveHref(href);
      links.push(`<a class="project-detail-modal__link" href="${esc(href)}">자세한 페이지</a>`);
    }
    return links.length
      ? `<div class="project-detail-modal__links">${links.join("")}</div>`
      : "";
  }

  function renderClassicBody(project) {
    const images = getImages(project);
    const gallery = images.length
      ? `<div class="project-detail-modal__gallery">${images.map((image) =>
          `<img src="${esc(imageSource(image.url))}" alt="${esc(project.title)} 스크린샷" loading="lazy">`
        ).join("")}</div>`
      : "";
    const blocks = [
      ["성과", project.achievements],
      ["배운 점", project.learned],
      ["트러블슈팅", project.troubleshooting],
    ].filter(([, value]) => value)
      .map(([label, value]) => `<section class="project-detail-modal__block"><h3>${label}</h3><p>${esc(value)}</p></section>`)
      .join("");
    const tags = (project.tags || []).map((tag) => `<span>${esc(tag)}</span>`).join("");

    return `
      <div class="project-detail-modal__hero" style="background-image:url('${esc(imageSource(project.thumbnail || ""))}')"></div>
      <div class="project-detail-modal__body">
        <p class="project-detail-modal__period">${esc(project.period)}</p>
        <h2 class="project-detail-modal__title" id="projectDetailTitle">${esc(project.title)}</h2>
        ${project.type ? `<p class="project-detail-modal__type">${esc(project.type)}</p>` : ""}
        ${project.role ? `<p class="project-detail-modal__role">${esc(project.role)}</p>` : ""}
        ${project.teamSize ? `<p class="project-detail-modal__meta">팀 ${esc(project.teamSize)}인</p>` : ""}
        ${project.desc ? `<p class="project-detail-modal__desc">${esc(project.desc)}</p>` : ""}
        ${blocks}
        ${tags ? `<div class="project-detail-modal__tags">${tags}</div>` : ""}
        ${gallery}
        ${renderLinks(project)}
      </div>`;
  }

  function renderEditableField(tag, className, field, value, placeholder, isEdit, id = "") {
    if (!value && !isEdit) return "";
    const idAttribute = id ? ` id="${esc(id)}"` : "";
    return `<${tag}${idAttribute} class="${className}" data-edit-field="${field}" data-placeholder="${esc(placeholder)}">${esc(value || placeholder)}</${tag}>`;
  }

  function renderEditorialBody(project) {
    const isEdit = document.body.classList.contains("edit-mode");
    const id = esc(project.id);
    const images = getImages(project);
    const imageMarkup = images.map((image, index) => {
      const editAttrs = image.field === "thumbnail"
        ? `data-edit-image="thumbnail"`
        : `data-edit-image="screenshots" data-screenshot-index="${image.index}"`;
      return `<figure class="project-detail-modal__media-item">
        <img src="${esc(imageSource(image.url))}" alt="${esc(project.title)} · 이미지 ${index + 1}" loading="${index ? "lazy" : "eager"}" ${editAttrs}>
      </figure>`;
    }).join("");

    const fields = [
      ["성과", "achievements", project.achievements, "성과를 입력하세요"],
      ["배운 점", "learned", project.learned, "배운 점을 입력하세요"],
      ["트러블슈팅", "troubleshooting", project.troubleshooting, "트러블슈팅을 입력하세요"],
    ].filter(([, , value]) => value || isEdit)
      .map(([label, field, value, placeholder]) => `
        <section class="project-detail-modal__block${value ? "" : " is-empty"}">
          <h3>${label}</h3>
          ${renderEditableField("p", "", field, value, placeholder, isEdit)}
        </section>`)
      .join("");

    const detailBlocks = Array.isArray(project.detailBlocks) ? project.detailBlocks : [];
    const customBlocks = detailBlocks.map((block, index) => {
      const title = block.title || "";
      const text = block.text || "";
      if (!isEdit && !title && !text) return "";
      const editableAttrs = isEdit ? 'contenteditable="true" class="is-editable"' : "";
      return `<section class="project-detail-modal__block project-detail-modal__custom-block">
        <div class="project-detail-modal__custom-heading">
          <h3 data-detail-block-field="title" data-detail-block-index="${index}" data-placeholder="새 텍스트" ${editableAttrs}>${esc(title)}</h3>
          <button type="button" class="edit-only project-detail-modal__remove-block" data-detail-block-delete="${index}" aria-label="텍스트 삭제">삭제</button>
        </div>
        <p data-detail-block-field="text" data-detail-block-index="${index}" data-placeholder="내용을 입력하세요" ${editableAttrs}>${esc(text)}</p>
      </section>`;
    }).join("");

    const tags = (project.tags || []).map((tag) => `<span>${esc(tag)}</span>`).join("");
    const metadata = [
      renderEditableField("p", "project-detail-modal__period", "period", project.period, "기간", isEdit),
      renderEditableField("p", "project-detail-modal__type", "type", project.type, "프로젝트 유형", isEdit),
      renderEditableField("p", "project-detail-modal__role", "role", project.role, "담당 역할", isEdit),
      renderEditableField("p", "project-detail-modal__meta", "teamSize", project.teamSize, "팀 인원", isEdit),
    ].join("");

    return `
      <div class="project-detail-modal__editorial">
        <div class="project-detail-modal__intro" data-edit-list="projects" data-edit-id="${id}">
          <header class="project-detail-modal__heading">
            ${metadata}
            ${renderEditableField("h2", "project-detail-modal__title", "title", project.title, "프로젝트 제목", isEdit, "projectDetailTitle")}
          </header>
          ${renderEditableField("p", "project-detail-modal__desc", "desc", project.desc, "프로젝트 설명을 입력하세요", isEdit)}
          <div class="project-detail-modal__blocks">${fields}${customBlocks}</div>
          <div class="project-detail-modal__tags">${tags}</div>
          <div class="project-detail-modal__edit-actions edit-only">
            <button type="button" class="project-detail-modal__add-text" data-add-detail-block>+ 텍스트 추가</button>
            <button type="button" class="project-detail-modal__delete-project" data-delete-project="${id}">프로젝트 삭제</button>
          </div>
        </div>
        <div class="project-detail-modal__gallery" data-edit-list="projects" data-edit-id="${id}">
          ${imageMarkup}
          <button type="button" class="edit-only project-detail-modal__add-image" data-add-screenshot="${id}">+ 사진 추가</button>
        </div>
        ${renderLinks(project)}
      </div>`;
  }

  function renderBody(project) {
    return document.body.classList.contains("skin-jangmi")
      && document.body.classList.contains("page-home")
      ? renderEditorialBody(project)
      : renderClassicBody(project);
  }

  function refreshEditState() {
    if (document.body.classList.contains("edit-mode")) {
      window.InlineEditor?.refreshEditState?.();
    }
  }

  function refresh() {
    if (!root || !currentProjectId) return;
    const project = getProject(currentProjectId);
    if (!project) {
      close();
      return;
    }
    root.querySelector(".project-detail-modal__content").innerHTML = renderBody(project);
    refreshEditState();
  }

  function ensureModal() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "projectDetailModal";
    root.className = "project-detail-modal";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="project-detail-modal__backdrop" data-close></div>
      <div class="project-detail-modal__panel" role="dialog" aria-modal="true" aria-labelledby="projectDetailTitle">
        <button type="button" class="project-detail-modal__close" aria-label="닫기" data-close>×</button>
        <div class="project-detail-modal__content"></div>
      </div>`;
    document.body.appendChild(root);

    root.addEventListener("click", async (event) => {
      if (event.target.closest("[data-close]")) {
        close();
        return;
      }

      const addTextButton = event.target.closest("[data-add-detail-block]");
      if (addTextButton) {
        event.preventDefault();
        addDetailBlock();
        return;
      }

      const deleteTextButton = event.target.closest("[data-detail-block-delete]");
      if (deleteTextButton) {
        event.preventDefault();
        await deleteDetailBlock(Number(deleteTextButton.dataset.detailBlockDelete));
        return;
      }

      const deleteProjectButton = event.target.closest("[data-delete-project]");
      if (deleteProjectButton) {
        event.preventDefault();
        await deleteProject();
      }
    });

    root.addEventListener("focusout", (event) => {
      const field = event.target.closest("[data-detail-block-field]");
      const project = getProject(currentProjectId);
      if (!field || !project || !document.body.classList.contains("edit-mode")) return;
      const index = Number(field.dataset.detailBlockIndex);
      const key = field.dataset.detailBlockField;
      const block = project.detailBlocks?.[index];
      if (!block || (key !== "title" && key !== "text")) return;
      block[key] = field.innerText.trim();
      PortfolioStore.notifyChange();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && root.classList.contains("is-open")) close();
    });

    document.addEventListener("portfolio:rendered", () => {
      if (root?.classList.contains("is-open")) refresh();
    });

    return root;
  }

  function addDetailBlock() {
    if (!document.body.classList.contains("edit-mode")) return;
    const project = getProject(currentProjectId);
    if (!project) return;
    if (!Array.isArray(project.detailBlocks)) project.detailBlocks = [];
    const index = project.detailBlocks.length;
    project.detailBlocks.push({
      id: window.EditorGitHub?.generateId?.("detail") || `detail-${Date.now()}`,
      title: "",
      text: "",
    });
    PortfolioStore.notifyChange();
    refresh();
    root.querySelector(`[data-detail-block-field="title"][data-detail-block-index="${index}"]`)?.focus();
  }

  async function deleteDetailBlock(index) {
    if (!document.body.classList.contains("edit-mode")) return;
    const project = getProject(currentProjectId);
    if (!project?.detailBlocks?.[index]) return;
    const confirmed = await EditorUI.confirm("텍스트를 삭제하시겠습니까?");
    if (!confirmed) return;
    project.detailBlocks.splice(index, 1);
    PortfolioStore.notifyChange();
    refresh();
  }

  async function deleteProject() {
    if (!document.body.classList.contains("edit-mode") || !currentProjectId) return;
    const confirmed = await EditorUI.confirm("프로젝트를 삭제하시겠습니까?");
    if (!confirmed) return;
    const id = currentProjectId;
    close();
    PortfolioStore.removeItem("projects", id);
    if (window.rerenderAllProjects) window.rerenderAllProjects();
    else window.renderPortfolio?.(["projects"]);
  }

  function open(projectId) {
    const project = getProject(projectId);
    if (!project) return;

    const modal = ensureModal();
    currentProjectId = projectId;
    lastFocus = document.activeElement;
    modal.querySelector(".project-detail-modal__content").innerHTML = renderBody(project);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("project-detail-open");
    refreshEditState();
    modal.querySelector(".project-detail-modal__close")?.focus();
  }

  function close() {
    if (!root) return;
    const focusTarget = lastFocus;
    lastFocus = null;
    if (focusTarget?.isConnected && focusTarget !== document.body && typeof focusTarget.focus === "function") {
      focusTarget.focus();
    }
    if (root.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("project-detail-open");
    currentProjectId = null;
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-project-detail-open]");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    open(trigger.dataset.projectDetailOpen);
  });

  return { open, close, refresh };
})();

window.ProjectDetailModal = ProjectDetailModal;
