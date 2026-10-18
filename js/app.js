/* =========================================================
   MIKE KELLY DONKOH — PORTFOLIO INTERACTIVITY (APP.JS)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  /* =========================================================
     1. THEME SWITCHER (DARK / LIGHT MODE WITH LOCALSTORAGE)
     ========================================================= */
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  // Retrieve saved theme or default to dark
  const savedTheme = localStorage.getItem('mkd_theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('mkd_theme', newTheme);
    });
  }

  /* =========================================================
     PROFILE PICTURE UPLOAD & PERSISTENCE
     ========================================================= */
  function handleProfilePicUpload(fileInput) {
    if (!fileInput) return;
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          try {
            localStorage.setItem('mkd_custom_profile_pic', dataUrl);
          } catch(err){}
          document.querySelectorAll('.photo-circle-img').forEach(img => {
            img.src = dataUrl;
          });
          alert('Profile picture updated successfully!');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  handleProfilePicUpload(document.getElementById('profilePicInput'));
  handleProfilePicUpload(document.getElementById('profilePicInputAbout'));

  /* =========================================================
     2. MOBILE NAVIGATION MENU TOGGLE
     ========================================================= */
  const navToggle = document.getElementById('navToggle');
  const navLinksContainer = id('navLinks');

  function id(str) { return document.getElementById(str); }

  if (navToggle && navLinksContainer) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinksContainer.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen);
    });
  }

  /* =========================================================
     3. SECRET ADMIN AUTHENTICATION (HIDDEN FROM VISITORS)
     ========================================================= */
  const ADMIN_PIN = '1234';
  let isAdminAuthenticated = false;

  try {
    isAdminAuthenticated = localStorage.getItem('mkd_admin_auth') === 'true';
  } catch (e) {}

  // Check URL parameter ?admin=1 or secret admin flag
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('admin') === '1') {
    isAdminAuthenticated = true;
    try { localStorage.setItem('mkd_admin_auth', 'true'); } catch(e){}
  }

  const addProjectBtn = document.getElementById('addProjectBtn');

  function updateAdminVisibility() {
    if (addProjectBtn) {
      addProjectBtn.style.display = 'inline-flex';
    }
  }

  updateAdminVisibility();

  // Keyboard shortcut Ctrl + Shift + A to trigger PIN modal
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      openModal('adminPinModal');
    }
  });

  const adminPinForm = document.getElementById('adminPinForm');
  const adminPinInput = document.getElementById('adminPinInput');
  const adminPinError = document.getElementById('adminPinError');

  if (adminPinForm) {
    adminPinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (adminPinInput.value.trim() === ADMIN_PIN) {
        isAdminAuthenticated = true;
        try { localStorage.setItem('mkd_admin_auth', 'true'); } catch(e){}
        updateAdminVisibility();
        closeModal('adminPinModal');
        adminPinInput.value = '';
        if (adminPinError) adminPinError.style.display = 'none';
        alert('Admin edit mode unlocked!');
      } else {
        if (adminPinError) {
          adminPinError.textContent = 'Incorrect PIN. Only Mike Donkoh is authorized.';
          adminPinError.style.display = 'block';
        }
      }
    });
  }

  /* =========================================================
     4. GENERIC MODAL CONTROLLER & PROJECT UPLOADER
     ========================================================= */
  function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('is-open');
  }

  function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('is-open');
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.getAttribute('data-close-modal'));
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('is-open');
      }
    });
  });

  if (addProjectBtn) {
    addProjectBtn.style.display = 'inline-flex';
    addProjectBtn.addEventListener('click', () => {
      openModal('uploadProjectModal');
    });
  }

  // Initial projects data (Empty - User adds their own projects)
  const defaultProjects = [];

  function getProjects() {
    try {
      const stored = localStorage.getItem('mkd_custom_projects');
      if (stored) return JSON.parse(stored);
    } catch(e){}
    return defaultProjects;
  }

  function saveProjects(projs) {
    try {
      localStorage.setItem('mkd_custom_projects', JSON.stringify(projs));
    } catch(e){}
  }

  const projectsGrid = document.getElementById('projectsGrid');

  function renderProjects(projs) {
    if (!projectsGrid) return;
    if (!projs || projs.length === 0) {
      projectsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);">
          <div style="width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <h3 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">No Projects Added Yet</h3>
          <p style="color: var(--text-muted); font-size: 15px; margin: 0; text-align: center;">Click the "+ Add New Project" button above to publish your first project!</p>
        </div>
      `;
      return;
    }
    projectsGrid.innerHTML = projs.map(p => `
      <div class="project-card">
        <div class="project-media">
          <img src="${p.image || ''}" alt="${p.title}">
        </div>
        <div class="project-body">
          <div class="project-content-top">
            <h3 class="project-title">${p.title}</h3>
            <p class="project-desc">${p.desc}</p>
          </div>
          <div class="project-content-bottom">
            <div class="tag-row">
              <span class="tag">${p.category}</span>
            </div>
            ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="display: inline-flex; align-items: center; gap: 6px;"><span>View Project</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  function loadProjects() {
    renderProjects(getProjects());
  }

  const uploadProjectForm = document.getElementById('uploadProjectForm');
  if (uploadProjectForm) {
    uploadProjectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('projTitle').value.trim();
      const category = document.getElementById('projCategory').value.trim();
      const desc = document.getElementById('projDesc').value.trim();
      const url = document.getElementById('projUrl').value.trim();
      const imgInput = document.getElementById('projImgFile');

      function commitProject(imgSrc) {
        const projs = getProjects();
        const newP = {
          id: Date.now(),
          title,
          category,
          desc,
          url: url || 'https://github.com/Kelly-Mike',
          image: imgSrc || 'images/projects/fixit-repair.png'
        };
        projs.unshift(newP);
        saveProjects(projs);
        renderProjects(projs);
        closeModal('uploadProjectModal');
        uploadProjectForm.reset();
        alert('Project successfully added to your portfolio!');
      }

      if (imgInput && imgInput.files && imgInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => commitProject(ev.target.result);
        reader.readAsDataURL(imgInput.files[0]);
      } else {
        commitProject('');
      }
    });
  }

  if (projectsGrid) {
    loadProjects();
  }

  /* =========================================================
     5. CONTACT FORM MAILTO HANDLER
     ========================================================= */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('fName').value.trim();
      const email = document.getElementById('fEmail').value.trim();
      const message = document.getElementById('fMessage').value.trim();
      if (!name || !email || !message) return;
      const subject = encodeURIComponent(`Portfolio Inquiry from ${name}`);
      const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
      window.location.href = `mailto:michaeldonkoh45@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  /* Footer year */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* =========================================================
     6. FAST & SMOOTH PAGE TRANSITION NAVIGATION HANDLER
     ========================================================= */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');

    if (href && (href.endsWith('.html') || href === '/') && !link.target && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      e.preventDefault();
      document.body.classList.add('page-fade-out');
      setTimeout(() => {
        window.location.href = href;
      }, 120);
    }
  });
});
