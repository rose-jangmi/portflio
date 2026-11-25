/**
 * GitHub REST API - JSON 저장, 파일 업로드, Commit History, Rollback
 */
const EditorGitHub = (() => {
  const API = "https://api.github.com";

  function getRepoContext() {
    const s = EditorAuth.getSession();
    if (!s?.repo) throw new Error("저장소 정보 없음");
    return s.repo;
  }

  async function getFile(path) {
    const { owner, repo, branch } = getRepoContext();
    const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: EditorAuth.getHeaders() });
    if (res.status === 404) return { sha: null };
    if (!res.ok) throw new Error(`파일 조회 실패: ${path}`);
    const data = await res.json();
    return { sha: data.sha, content: data.content };
  }

  async function saveJson(path, jsonData, message) {
    return saveText(path, JSON.stringify(jsonData, null, 2), message);
  }

  async function saveText(path, text, message) {
    const { owner, repo, branch } = getRepoContext();
    const existing = await getFile(path);
    const encoded = btoa(unescape(encodeURIComponent(text)));
    const body = { message, content: encoded, branch };
    if (existing.sha) body.sha = existing.sha;

    const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: { ...EditorAuth.getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(res.status === 403
        ? "GitHub 쓰기 권한이 거부되었습니다."
        : (err.message || `저장 실패: ${path}`));
    }
    return res.json();
  }

  async function uploadBinary(path, file, message, options = {}) {
    const { replace = false } = options;
    const { owner, repo, branch } = getRepoContext();
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

    const body = { message, content: btoa(binary), branch };
    if (replace) {
      const existing = await getFile(path);
      if (existing.sha) body.sha = existing.sha;
    }

    const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: { ...EditorAuth.getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.message || "";
      if (res.status === 401 || /bad credentials/i.test(msg)) throw new Error("GitHub 토큰이 만료되었거나 올바르지 않습니다. 다시 로그인해 주세요.");
      if (res.status === 403) throw new Error("GitHub 쓰기 권한이 거부되었습니다.");
      throw new Error(msg || "파일 업로드 실패");
    }
    return `./${path}`;
  }

  async function createSingleCommit(fileEntries, message) {
    const { owner, repo, branch } = getRepoContext();
    const headers = { ...EditorAuth.getHeaders(), "Content-Type": "application/json" };

    async function getApiError(res, fallback) {
      const err = await res.json().catch(() => ({}));
      const msg = err.message || "";
      if (res.status === 401 || /bad credentials/i.test(msg)) return "GitHub 토큰이 만료되었거나 올바르지 않습니다. 다시 로그인해 주세요.";
      if (res.status === 403) return "GitHub 쓰기 권한이 거부되었습니다.";
      if (res.status === 404) return `저장소 또는 '${branch}' 브랜치에 접근할 수 없습니다.`;
      if (res.status === 422) return "GitHub 커밋을 생성하지 못했습니다. 브랜치 보호 규칙 또는 잘못된 파일 경로를 확인하세요.";
      return msg || fallback;
    }

    const refRes = await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, { headers });
    if (!refRes.ok) throw new Error(await getApiError(refRes, "브랜치 정보를 불러오지 못했습니다."));
    const baseCommitSha = (await refRes.json()).object.sha;

    const commitRes = await fetch(`${API}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`, { headers });
    if (!commitRes.ok) throw new Error(await getApiError(commitRes, "커밋 정보를 불러오지 못했습니다."));
    const baseTreeSha = (await commitRes.json()).tree.sha;

    const treeItems = [];
    for (const entry of fileEntries) {
      const blobBody = entry.encoding === "base64"
        ? { content: entry.content, encoding: "base64" }
        : { content: entry.content, encoding: "utf-8" };
      const blobRes = await fetch(`${API}/repos/${owner}/${repo}/git/blobs`, { method: "POST", headers, body: JSON.stringify(blobBody) });
      if (!blobRes.ok) throw new Error(await getApiError(blobRes, `Blob 생성 실패: ${entry.path}`));
      treeItems.push({ path: entry.path, mode: "100644", type: "blob", sha: (await blobRes.json()).sha });
    }

    const treeRes = await fetch(`${API}/repos/${owner}/${repo}/git/trees`, {
      method: "POST", headers, body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    });
    if (!treeRes.ok) throw new Error(await getApiError(treeRes, "Tree 생성 실패"));
    const tree = await treeRes.json();

    const newCommitRes = await fetch(`${API}/repos/${owner}/${repo}/git/commits`, {
      method: "POST", headers, body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] }),
    });
    if (!newCommitRes.ok) throw new Error(await getApiError(newCommitRes, "커밋 생성 실패"));
    const newCommit = await newCommitRes.json();

    const updateRefRes = await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH", headers, body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
    if (!updateRefRes.ok) throw new Error(await getApiError(updateRefRes, "브랜치 업데이트 실패"));

    return newCommit;
  }

  async function listCommits(limit = 20) {
    const { owner, repo, branch } = getRepoContext();
    const res = await fetch(`${API}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`, { headers: EditorAuth.getHeaders() });
    if (!res.ok) throw new Error("커밋 기록 조회 실패");
    const data = await res.json();
    return data.map((c) => ({ sha: c.sha, message: c.commit.message.split("\n")[0], date: c.commit.author.date, author: c.commit.author.name }));
  }

  async function getFileAtCommit(path, commitSha) {
    const { owner, repo } = getRepoContext();
    const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}?ref=${commitSha}`, { headers: EditorAuth.getHeaders() });
    if (!res.ok) throw new Error("커밋 파일 조회 실패");
    const data = await res.json();
    const binary = atob(data.content.replace(/\n/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function generateId(prefix = "item") {
    return `${prefix}-${Date.now().toString(36)}`;
  }

  return { getFile, saveJson, saveText, uploadBinary, createSingleCommit, listCommits, getFileAtCommit, generateId };
})();

window.EditorGitHub = EditorGitHub;