/**
 * GitHub REST API — JSON 저장, 파일 업로드, Commit History, Rollback
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
    const res = await fetch(
      `${API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers: EditorAuth.getHeaders() }
    );
    if (res.status === 404) return { sha: null };
    if (!res.ok) throw new Error(`파일 조회 실패: ${path}`);
    const data = await res.json();
    return { sha: data.sha, content: data.content };
  }

  async function saveJson(path, jsonData, message) {
    const jsonStr = JSON.stringify(jsonData, null, 2);
    return saveText(path, jsonStr, message);
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
      throw new Error(err.message || `저장 실패: ${path}`);
    }
    return res.json();
  }

  async function uploadBinary(path, file, message, options = {}) {
    const { replace = false } = options;
    const { owner, repo, branch } = getRepoContext();
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const encoded = btoa(binary);

    const body = { message, content: encoded, branch };
    // 교체 업로드만 기존 sha 조회 (신규 파일은 404 조회 생략)
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
      if (res.status === 401) throw new Error("GitHub 로그인이 만료되었습니다. 다시 로그인해 주세요.");
      if (/bad credentials/i.test(msg)) throw new Error("GitHub 토큰이 유효하지 않습니다. 다시 로그인해 주세요.");
      throw new Error(msg || "파일 업로드 실패");
    }
    return `./${path}`;
  }

  /** 여러 파일을 단일 GitHub 커밋으로 Publish */
  async function createSingleCommit(fileEntries, message) {
    const { owner, repo, branch } = getRepoContext();
    const headers = { ...EditorAuth.getHeaders(), "Content-Type": "application/json" };

    const refRes = await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, { headers });
    if (!refRes.ok) throw new Error("브랜치 정보를 불러오지 못했습니다.");
    const refData = await refRes.json();
    const baseCommitSha = refData.object.sha;

    const commitRes = await fetch(`${API}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`, { headers });
    if (!commitRes.ok) throw new Error("커밋 정보를 불러오지 못했습니다.");
    const baseCommit = await commitRes.json();
    const baseTreeSha = baseCommit.tree.sha;

    const treeItems = [];
    for (const entry of fileEntries) {
      const blobBody = entry.encoding === "base64"
        ? { content: entry.content, encoding: "base64" }
        : { content: entry.content, encoding: "utf-8" };
      const blobRes = await fetch(`${API}/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        headers,
        body: JSON.stringify(blobBody),
      });
      if (!blobRes.ok) {
        const err = await blobRes.json().catch(() => ({}));
        throw new Error(err.message || `Blob 생성 실패: ${entry.path}`);
      }
      const blob = await blobRes.json();
      treeItems.push({ path: entry.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    const treeRes = await fetch(`${API}/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    });
    if (!treeRes.ok) {
      const err = await treeRes.json().catch(() => ({}));
      throw new Error(err.message || "Tree 생성 실패");
    }
    const tree = await treeRes.json();

    const newCommitRes = await fetch(`${API}/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] }),
    });
    if (!newCommitRes.ok) {
      const err = await newCommitRes.json().catch(() => ({}));
      throw new Error(err.message || "커밋 생성 실패");
    }
    const newCommit = await newCommitRes.json();

    const updateRefRes = await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
    if (!updateRefRes.ok) {
      const err = await updateRefRes.json().catch(() => ({}));
      throw new Error(err.message || "브랜치 업데이트 실패");
    }

    return newCommit;
  }

  /** 최근 커밋 목록 */
  async function listCommits(limit = 20) {
    const { owner, repo, branch } = getRepoContext();
    const res = await fetch(
      `${API}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`,
      { headers: EditorAuth.getHeaders() }
    );
    if (!res.ok) throw new Error("커밋 기록 조회 실패");
    const data = await res.json();
    return data.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0],
      date: c.commit.author.date,
      author: c.commit.author.name,
    }));
  }

  /** 특정 커밋 시점의 파일 내용 (Rollback용) */
  async function getFileAtCommit(path, commitSha) {
    const { owner, repo } = getRepoContext();
    const res = await fetch(
      `${API}/repos/${owner}/${repo}/contents/${path}?ref=${commitSha}`,
      { headers: EditorAuth.getHeaders() }
    );
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
