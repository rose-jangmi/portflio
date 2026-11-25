/**
 * Draft / Preview / Publish 워크플로우
 * LocalStorage 자동저장 → 미리보기(Preview) → 게시(Publish) → GitHub → Vercel
 */
const EditorDraft = (() => {
  let previewMode = false;
  let previewedCurrentDraft = false;

  function isPreviewMode() { return previewMode; }
  function hasPreviewedDraft() { return previewedCurrentDraft; }

  function markDraftChanged() {
    previewedCurrentDraft = false;
  }

  /** Preview — Draft(localStorage) 상태를 방문자 화면처럼 미리보기 */
  function enterPreview() {
    EditorAutosave.flush(PortfolioStore.exportAll());
    EditorUI.updateAutosaveLabel?.(EditorAutosave.getLastSavedAt());

    previewMode = true;
    previewedCurrentDraft = true;
    document.body.classList.add("preview-mode");
    document.body.classList.remove("edit-mode");
    EditorUI?.hideToolbar?.();
    EditorUI?.showPreviewBar?.();
    CMS?.rerender?.() || window.renderPortfolio?.();
    EditorUI.showToast?.("Draft 미리보기 — 확인 후 게시하세요.", "info");
  }

  function exitPreview() {
    previewMode = false;
    document.body.classList.remove("preview-mode");
    EditorUI?.hidePreviewBar?.();
    if (EditorAuth?.getSession?.()) {
      window.InlineEditor?.enterEditMode?.();
    } else {
      CMS?.rerender?.() || window.renderPortfolio?.();
    }
  }

  /** Published(JSON) vs Draft(현재 store) diff 요약 */
  function computeDiff(published, draft) {
    const changes = [];
    const sections = ["profile", "projects", "skills", "education", "experience", "resumes", "documents", "about", "seo", "theme", "certificates", "awards", "training", "images"];
    sections.forEach((key) => {
      const a = JSON.stringify(published?.[key] ?? null);
      const b = JSON.stringify(draft?.[key] ?? null);
      if (a !== b) changes.push({ section: key, label: sectionLabel(key) });
    });
    return changes;
  }

  function sectionLabel(key) {
    const map = {
      profile: "프로필", projects: "프로젝트", skills: "기술스택",
      education: "학력", experience: "경력/활동", resumes: "Resume",
      certificates: "자격증", awards: "수상", training: "교육/활동",
      images: "이미지 라이브러리",
    };
    return map[key] || key;
  }

  /** Diff 확인 모달 → GitHub 단일 커밋 → Vercel 자동 배포 */
  function showDiffModal(published, draft, onPublish) {
    const changes = computeDiff(published, draft);
    if (!changes.length) {
      EditorUI.showToast("변경사항이 없습니다.", "info");
      return;
    }
    const list = changes.map((c) => `<li>${c.label}</li>`).join("");
    EditorUI.updateWorkflowStep?.("publish");
    EditorUI.openModal({
      title: "게시 확인",
      body: `
        <p class="editor-diff-flow">LocalStorage → 미리보기 → <strong>게시</strong> → GitHub → Vercel</p>
        <p>다음 항목이 변경되었습니다:</p>
        <ul class="editor-diff-list">${list}</ul>
        <p class="editor-diff-note">게시 시 GitHub 커밋 1건(<strong>CMS: 콘텐츠 Publish</strong>)이 생성되고 Vercel이 재배포됩니다.</p>`,
      foot: `<button type="button" class="editor-toolbar__btn editor-toolbar__btn--ghost" id="diffCancel">취소</button><button type="button" class="editor-toolbar__btn editor-toolbar__btn--primary" id="diffPublish">게시</button>`,
    });
    document.getElementById("diffCancel").onclick = () => {
      EditorUI.closeModal();
      EditorUI.updateWorkflowStep?.(previewMode ? "preview" : "draft");
    };
    document.getElementById("diffPublish").onclick = () => {
      EditorUI.closeModal();
      onPublish?.();
    };
  }

  function prepareForPublish() {
    if (!previewMode) return false;
    previewMode = false;
    document.body.classList.remove("preview-mode");
    document.body.classList.add("edit-mode");
    EditorUI?.hidePreviewBar?.();
    EditorUI?.showToolbar?.();
    EditorUI.updateWorkflowStep?.("draft");
    return true;
  }

  function onPublishSuccess() {
    previewedCurrentDraft = false;
    EditorUI.updateWorkflowStep?.("vercel");
  }

  return {
    isPreviewMode, hasPreviewedDraft, markDraftChanged,
    enterPreview, exitPreview, prepareForPublish, computeDiff, showDiffModal, onPublishSuccess,
  };
})();

window.EditorDraft = EditorDraft;
