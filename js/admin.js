const loginScreen = document.getElementById('loginScreen');
const adminApp = document.getElementById('adminApp');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const logoutBtn = document.getElementById('logoutBtn');
const projectForm = document.getElementById('projectForm');
const formStatus = document.getElementById('formStatus');
const formTitle = document.getElementById('formTitle');
const projectList = document.getElementById('projectList');
const imageSection = document.getElementById('imageSection');
const imageGrid = document.getElementById('imageGrid');
const uploadForm = document.getElementById('uploadForm');
const uploadStatus = document.getElementById('uploadStatus');
const previewBtn = document.getElementById('previewBtn');
const previewBox = document.getElementById('previewBox');
const previewContent = document.getElementById('previewContent');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let editingId = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function setStatus(el, msg, isError = false) {
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showAdmin() {
  loginScreen.classList.add('hidden');
  adminApp.classList.remove('hidden');
  loadProjects();
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  adminApp.classList.add('hidden');
  resetForm();
}

async function checkSession() {
  try {
    await api('/api/admin/me');
    showAdmin();
  } catch {
    showLogin();
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(loginStatus, 'Signing in…');
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('loginUser').value.trim(),
        password: document.getElementById('loginPass').value,
      }),
    });
    setStatus(loginStatus, '');
    showAdmin();
  } catch (err) {
    setStatus(loginStatus, err.message, true);
  }
});

logoutBtn.addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' });
  showLogin();
});

function getFormData() {
  return {
    title: document.getElementById('pTitle').value.trim(),
    description: document.getElementById('pDesc').value.trim(),
    category: document.getElementById('pCategory').value.trim(),
    projectDate: document.getElementById('pDate').value.trim(),
    projectUrl: document.getElementById('pUrl').value.trim(),
    published: document.getElementById('pPublished').checked,
  };
}

function resetForm() {
  editingId = null;
  projectForm.reset();
  document.getElementById('projectId').value = '';
  formTitle.textContent = 'Add New Project';
  cancelEditBtn.classList.add('hidden');
  imageSection.classList.add('hidden');
  imageGrid.innerHTML = '';
  previewBox.classList.add('hidden');
  setStatus(formStatus, '');
  setStatus(uploadStatus, '');
}

function fillForm(project) {
  editingId = project.id;
  document.getElementById('projectId').value = project.id;
  document.getElementById('pTitle').value = project.title;
  document.getElementById('pDesc').value = project.description || '';
  document.getElementById('pCategory').value = project.category || '';
  document.getElementById('pDate').value = project.projectDate || '';
  document.getElementById('pUrl').value = project.projectUrl || '';
  document.getElementById('pPublished').checked = !!project.published;
  formTitle.textContent = 'Edit Project';
  cancelEditBtn.classList.remove('hidden');
  imageSection.classList.remove('hidden');
  renderImages(project);
}

function renderPreview(data, images = []) {
  const imgHtml = images.length
    ? `<img src="${escapeHtml(images[0].url)}" alt="" style="max-width:100%;border-radius:8px;margin-bottom:12px;">`
    : '<p style="color:var(--text-faint);font-size:13px;">No images uploaded yet</p>';

  previewContent.innerHTML = `
    ${imgHtml}
    <h4>${escapeHtml(data.title || 'Untitled')}</h4>
    ${data.projectDate ? `<p style="font-size:12px;color:var(--text-faint);margin:0 0 8px;">${escapeHtml(data.projectDate)}</p>` : ''}
    <p style="color:var(--text-muted);font-size:14px;">${escapeHtml(data.description || '')}</p>
    ${data.category ? `<span class="badge">${escapeHtml(data.category)}</span>` : ''}
    ${data.published ? '<span class="badge">Published</span>' : '<span class="badge draft">Draft</span>'}
  `;
  previewBox.classList.remove('hidden');
}

previewBtn.addEventListener('click', () => {
  renderPreview(getFormData());
});

cancelEditBtn.addEventListener('click', resetForm);

projectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = getFormData();
  if (!data.title) {
    setStatus(formStatus, 'Title is required.', true);
    return;
  }

  setStatus(formStatus, 'Saving…');
  try {
    let project;
    if (editingId) {
      project = await api(`/api/admin/projects/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      setStatus(formStatus, 'Project updated.');
    } else {
      project = await api('/api/admin/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      fillForm(project);
      setStatus(formStatus, 'Project created. You can now upload images.');
    }
    loadProjects();
  } catch (err) {
    setStatus(formStatus, err.message, true);
  }
});

function renderImages(project) {
  if (!project.images.length) {
    imageGrid.innerHTML = '<p style="font-size:13px;color:var(--text-faint);">No images yet.</p>';
    return;
  }

  imageGrid.innerHTML = project.images.map(img => `
    <div class="image-chip" data-id="${img.id}">
      <img src="${escapeHtml(img.url)}" alt="">
      <div class="chip-actions">
        <label class="btn btn-sm btn-outline" style="cursor:pointer;padding:4px 8px;">
          Replace
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-replace="${img.id}">
        </label>
        <button type="button" class="btn btn-sm btn-danger" data-delete="${img.id}" style="padding:4px 8px;">Del</button>
      </div>
    </div>
  `).join('');

  imageGrid.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this image?')) return;
      try {
        const project = await api(`/api/admin/projects/${editingId}/images/${btn.dataset.delete}`, {
          method: 'DELETE',
        });
        renderImages(project);
        loadProjects();
        setStatus(uploadStatus, 'Image deleted.');
      } catch (err) {
        setStatus(uploadStatus, err.message, true);
      }
    });
  });

  imageGrid.querySelectorAll('[data-replace]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      setStatus(uploadStatus, 'Replacing image…');
      try {
        const project = await api(`/api/admin/projects/${editingId}/images/${input.dataset.replace}/replace`, {
          method: 'PUT',
          body: fd,
        });
        renderImages(project);
        loadProjects();
        setStatus(uploadStatus, 'Image replaced.');
      } catch (err) {
        setStatus(uploadStatus, err.message, true);
      }
      input.value = '';
    });
  });
}

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingId) {
    setStatus(uploadStatus, 'Save the project first, then upload images.', true);
    return;
  }

  const files = document.getElementById('imageFiles').files;
  if (!files.length) {
    setStatus(uploadStatus, 'Choose at least one image.', true);
    return;
  }

  const fd = new FormData();
  for (const file of files) fd.append('images', file);

  setStatus(uploadStatus, 'Uploading…');
  try {
    const project = await api(`/api/admin/projects/${editingId}/images`, {
      method: 'POST',
      body: fd,
    });
    renderImages(project);
    loadProjects();
    uploadForm.reset();
    setStatus(uploadStatus, `${files.length} image(s) uploaded and optimized.`);
  } catch (err) {
    setStatus(uploadStatus, err.message, true);
  }
});

async function loadProjects() {
  try {
    const projects = await api('/api/admin/projects');
    if (!projects.length) {
      projectList.innerHTML = '<p style="color:var(--text-faint);font-size:14px;">No projects yet. Add your first one above.</p>';
      return;
    }

    projectList.innerHTML = projects.map(p => {
      const thumb = p.images[0]
        ? `<img src="${escapeHtml(p.images[0].url)}" alt="">`
        : 'No image';
      return `
        <div class="project-item">
          <div class="project-thumb">${thumb}</div>
          <div class="project-meta">
            <h3>${escapeHtml(p.title)}</h3>
            <p>${escapeHtml(p.description || '')}</p>
            <div style="margin-top:8px;">
              ${p.category ? `<span class="badge">${escapeHtml(p.category)}</span>` : ''}
              ${p.published ? '<span class="badge">Published</span>' : '<span class="badge draft">Draft</span>'}
              ${p.projectDate ? `<span class="badge">${escapeHtml(p.projectDate)}</span>` : ''}
              <span class="badge">${p.images.length} image(s)</span>
            </div>
          </div>
          <div class="item-actions">
            <button type="button" class="btn btn-outline btn-sm" data-edit="${p.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button>
          </div>
        </div>`;
    }).join('');

    projectList.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const project = await api(`/api/admin/projects/${btn.dataset.edit}`);
        fillForm(project);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    projectList.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this project and all its images?')) return;
        try {
          await api(`/api/admin/projects/${btn.dataset.del}`, { method: 'DELETE' });
          if (editingId === parseInt(btn.dataset.del, 10)) resetForm();
          loadProjects();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    projectList.innerHTML = `<p style="color:#f87171;">${escapeHtml(err.message)}</p>`;
  }
}

checkSession();
