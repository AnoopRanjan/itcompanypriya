(() => {
  const state = {
    user: null,
    isAdmin: document.body.dataset.isAdmin === "true",
    samples: [],
    posts: [],
    inquiries: [],
    activeSection: "overview",
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3600);
  }

  function setFeedback(el, message, type = "") {
    if (!el) return;
    el.textContent = message || "";
    el.className = `form-feedback ${type}`.trim();
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (id === "user-login-modal") {
      sessionStorage.setItem("wixfix_launch_prompt_seen", "1");
    }
  }

  // Dynamic Middle Section Switcher
  function switchSection(sectionName, scrollIntoView = false) {
    const validPanels = [
      "overview",
      "samples",
      "request",
      "how-it-works",
      "study-hub",
      "pricing",
      "about",
      "admin",
    ];
    const target = validPanels.includes(sectionName) ? sectionName : "overview";
    state.activeSection = target;

    document.querySelectorAll(".workspace-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${target}`);
    });
    document.querySelectorAll(".sidebar-link[data-section]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === target);
    });
    document.querySelectorAll(".nav-link[data-nav-section]").forEach((link) => {
      link.classList.toggle("active", link.dataset.navSection === target);
    });

    if (scrollIntoView) {
      const ws = document.getElementById("workspace");
      if (ws) ws.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function priorityClass(priority) {
    const p = (priority || "Standard").toLowerCase();
    if (p === "featured") return "featured";
    if (p === "high") return "high";
    return "standard";
  }

  function buildSampleCardHtml(sample) {
    const pClass = priorityClass(sample.priority);
    return `
      <article class="sample-card priority-border-${pClass}">
        <div class="sample-card-top">
          <span class="cat-badge">${escapeHtml(sample.category)}</span>
          <span class="priority-badge priority-${pClass}">
            <i data-lucide="flag"></i> ${escapeHtml(sample.priority || "Standard")} Priority
          </span>
        </div>
        <h3>${escapeHtml(sample.name)}</h3>
        <p>${escapeHtml(sample.description)}</p>
        <div class="sample-card-foot">
          <span class="url-preview">${escapeHtml(sample.url)}</span>
          <a href="${escapeHtml(sample.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary-sm">
            <span>Visit Live Site</span>
            <i data-lucide="external-link"></i>
          </a>
        </div>
      </article>
    `;
  }

  // Real-Time Sync: Middle Dashboard + Full Samples + Footer + Admin Table
  function renderSamplesEverywhere() {
    const overviewGrid = document.getElementById("overview-samples-grid");
    const fullGrid = document.getElementById("full-samples-grid");
    const footerList = document.getElementById("footer-samples-list");
    const adminTbody = document.getElementById("admin-samples-tbody");
    const sidebarCount = document.getElementById("sidebar-samples-count");

    if (sidebarCount) sidebarCount.textContent = String(state.samples.length);

    if (overviewGrid) {
      overviewGrid.innerHTML = state.samples.length
        ? state.samples.map(buildSampleCardHtml).join("")
        : '<p class="panel-sub">No sample websites published yet.</p>';
    }

    if (fullGrid) {
      const searchVal = (document.getElementById("sample-search-input")?.value || "").trim().toLowerCase();
      const priorityVal = document.getElementById("sample-priority-filter")?.value || "all";
      const filtered = state.samples.filter((s) => {
        const matchesPriority = priorityVal === "all" || (s.priority || "Standard") === priorityVal;
        const text = `${s.name} ${s.category} ${s.description}`.toLowerCase();
        const matchesSearch = !searchVal || text.includes(searchVal);
        return matchesPriority && matchesSearch;
      });
      fullGrid.innerHTML = filtered.length
        ? filtered.map(buildSampleCardHtml).join("")
        : '<p class="panel-sub">No sample websites match your filter.</p>';
    }

    if (footerList) {
      footerList.innerHTML = state.samples.length
        ? state.samples
            .map((s) => {
              const pClass = priorityClass(s.priority);
              return `
                <li>
                  <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="footer-sample-link">
                    <span>${escapeHtml(s.name)}</span>
                    <span class="priority-mini priority-${pClass}">${escapeHtml(s.priority || "Standard")}</span>
                  </a>
                </li>
              `;
            })
            .join("")
        : '<li class="muted-note">No sample websites added yet.</li>';
    }

    if (adminTbody) {
      adminTbody.innerHTML = state.samples.length
        ? state.samples
            .map((s) => {
              const pClass = priorityClass(s.priority);
              return `
                <tr>
                  <td>
                    <strong>${escapeHtml(s.name)}</strong><br/>
                    <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="text-link-btn" style="font-size:0.78rem;">
                      ${escapeHtml(s.url)}
                    </a>
                  </td>
                  <td>${escapeHtml(s.category)}</td>
                  <td><span class="priority-badge priority-${pClass}">${escapeHtml(s.priority || "Standard")}</span></td>
                  <td>
                    <div class="table-actions">
                      <button type="button" class="btn btn-outline-sm" data-edit-sample="${escapeHtml(s.id)}">Edit</button>
                      <button type="button" class="btn btn-outline-sm" style="color:#dc2626;border-color:#fecaca;" data-delete-sample="${escapeHtml(s.id)}">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("")
        : '<tr><td colspan="4">No sample websites found.</td></tr>';
    }

    refreshIcons();
  }

  function renderPosts() {
    const feed = document.getElementById("project-posts-feed");
    const sidebarCount = document.getElementById("sidebar-posts-count");
    if (sidebarCount) sidebarCount.textContent = String(state.posts.length);
    if (!feed) return;

    if (!state.posts.length) {
      feed.innerHTML = '<p class="panel-sub">No project needs posted yet. Be the first to submit a wireframe!</p>';
      return;
    }

    feed.innerHTML = state.posts
      .map((post) => {
        const isPdf = (post.wireframe_url || "").toLowerCase().endsWith(".pdf");
        const wireframeBlock = post.wireframe_url
          ? `
            <div class="wireframe-preview-box">
              <div class="wireframe-preview-label">
                <span><i data-lucide="image"></i> Uploaded Wireframe: ${escapeHtml(post.wireframe_name || "wireframe")}</span>
                <a href="${escapeHtml(post.wireframe_url)}" target="_blank" rel="noopener noreferrer" class="text-link-btn">Open Wireframe</a>
              </div>
              ${
                isPdf
                  ? `<p style="margin:0;font-size:0.86rem;">PDF Wireframe attached. <a href="${escapeHtml(post.wireframe_url)}" target="_blank" rel="noopener noreferrer" class="text-link-btn">View PDF &rarr;</a></p>`
                  : `<img src="${escapeHtml(post.wireframe_url)}" alt="Uploaded wireframe for ${escapeHtml(post.title)}" />`
              }
            </div>
          `
          : "";

        const embeddedLiveBlock = post.running_url
          ? `
            <div class="embedded-app-box">
              <div class="embedded-app-bar">
                <span><i data-lucide="monitor-play" style="width:14px;height:14px;vertical-align:middle;"></i> Embedded Running Web Application</span>
                <span>Live Build</span>
              </div>
              <iframe
                src="${escapeHtml(post.running_url)}"
                class="embedded-app-frame"
                title="Live app preview for ${escapeHtml(post.title)}"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms"
              ></iframe>
              <div class="embedded-app-footer">
                <span>Running URL: ${escapeHtml(post.running_url)}</span>
                <a href="${escapeHtml(post.running_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary-sm">
                  <span>Open Live Web App in New Tab</span>
                  <i data-lucide="external-link"></i>
                </a>
              </div>
            </div>
          `
          : "";

        const adminUrlAssign = post.can_set_running_url
          ? `
            <div class="admin-url-assign-row">
              <input
                type="url"
                placeholder="Admin Only: Insert running web app URL (https://...)"
                value="${escapeHtml(post.running_url || "")}"
                data-running-url-input="${escapeHtml(post.id)}"
              />
              <button type="button" class="btn btn-navy-sm" data-save-running-url="${escapeHtml(post.id)}">
                Save Running URL
              </button>
            </div>
          `
          : "";

        const ownerActions =
          post.can_edit || post.can_delete
            ? `
              <div class="post-actions-bar">
                ${post.can_edit ? `<button type="button" class="btn btn-outline-sm" data-toggle-edit-post="${escapeHtml(post.id)}">Edit</button>` : ""}
                ${post.can_delete ? `<button type="button" class="btn btn-outline-sm" style="color:#dc2626;border-color:#fecaca;" data-delete-post="${escapeHtml(post.id)}">Delete</button>` : ""}
              </div>
            `
            : "";

        const editBox = post.can_edit
          ? `
            <div class="post-edit-box hidden" id="edit-box-${escapeHtml(post.id)}">
              <input type="text" id="edit-title-${escapeHtml(post.id)}" value="${escapeHtml(post.title)}" placeholder="Project Title" />
              <textarea id="edit-desc-${escapeHtml(post.id)}" rows="3" placeholder="Description of need">${escapeHtml(post.description)}</textarea>
              <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button type="button" class="btn btn-ghost btn-sm" data-cancel-edit-post="${escapeHtml(post.id)}">Cancel</button>
                <button type="button" class="btn btn-primary-sm" data-save-edit-post="${escapeHtml(post.id)}">Save Changes</button>
              </div>
            </div>
          `
          : "";

        return `
          <article class="post-item-card" data-post-id="${escapeHtml(post.id)}">
            <div class="post-item-head">
              <div>
                <span class="cat-badge">${escapeHtml(post.category || "Custom Portal")}</span>
                <h4 style="margin:6px 0 2px;font-size:1.08rem;">${escapeHtml(post.title)}</h4>
                <div class="post-author-meta">
                  Posted by <strong>${escapeHtml(post.author_name || post.author_email)}</strong> (${escapeHtml(post.author_email)})
                </div>
              </div>
              ${ownerActions}
            </div>
            <p class="post-desc">${escapeHtml(post.description)}</p>
            ${editBox}
            ${wireframeBlock}
            ${embeddedLiveBlock}
            ${adminUrlAssign}
          </article>
        `;
      })
      .join("");

    refreshIcons();
  }

  function renderInquiries() {
    const list = document.getElementById("admin-inquiries-list");
    if (!list) return;
    if (!state.inquiries || !state.inquiries.length) {
      list.innerHTML = '<p class="panel-sub">No contact inquiries received yet.</p>';
      return;
    }
    list.innerHTML = state.inquiries
      .map(
        (inq) => `
        <div class="inquiry-card">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <strong>${escapeHtml(inq.name)} (${escapeHtml(inq.email)})</strong>
            <span class="cat-badge">${escapeHtml(inq.office || "Office")}</span>
          </div>
          <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(inq.subject)}</div>
          <p style="margin:0;color:#475569;">${escapeHtml(inq.message)}</p>
        </div>
      `
      )
      .join("");
  }

  function syncAuthUi() {
    const adminLocked = document.getElementById("admin-locked-view");
    const adminUnlocked = document.getElementById("admin-unlocked-view");
    const adminBtn = document.getElementById("admin-trigger-btn");
    const sidebarDot = document.getElementById("sidebar-admin-dot");
    const postAuthGate = document.getElementById("post-auth-gate");
    const postForm = document.getElementById("project-post-form");
    const postRunningField = document.getElementById("post-running-url-field");
    const postingAs = document.getElementById("posting-as-email");

    if (adminLocked && adminUnlocked) {
      adminLocked.style.display = state.isAdmin ? "none" : "block";
      adminUnlocked.style.display = state.isAdmin ? "block" : "none";
    }
    if (adminBtn) {
      adminBtn.classList.toggle("is-active", state.isAdmin);
      const span = adminBtn.querySelector("span");
      if (span) span.textContent = state.isAdmin ? "Admin Panel" : "Admin Login";
    }
    if (sidebarDot) {
      sidebarDot.classList.toggle("online", state.isAdmin);
    }
    if (postAuthGate && postForm) {
      postAuthGate.classList.toggle("hidden", Boolean(state.user));
      postForm.classList.toggle("hidden", !state.user);
    }
    if (postRunningField) {
      postRunningField.classList.toggle("hidden", !state.isAdmin);
    }
    if (postingAs && state.user) {
      postingAs.textContent = state.user.email;
    }
  }

  async function refreshState() {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      if (!data.ok) return;
      state.user = data.user;
      state.isAdmin = Boolean(data.is_admin);
      state.samples = data.samples || [];
      state.posts = data.posts || [];
      state.inquiries = data.inquiries || [];
      syncAuthUi();
      renderSamplesEverywhere();
      renderPosts();
      renderInquiries();
    } catch (err) {
      console.error("Failed to fetch state:", err);
    }
  }

  // Event Wiring
  document.addEventListener("DOMContentLoaded", () => {
    refreshIcons();

    const wsEl = document.getElementById("workspace");
    if (wsEl) {
      const initialSection = wsEl.dataset.initialSection || "overview";
      switchSection(initialSection, false);
    }

    refreshState();

    // Launch Login Popup on initial home page launch when unauthenticated
    const isHomePage = document.body.dataset.page === "home";
    const initiallyAuth = document.body.dataset.authenticated === "true";
    if (isHomePage && !initiallyAuth && !sessionStorage.getItem("wixfix_launch_prompt_seen")) {
      setTimeout(() => {
        openModal("user-login-modal");
      }, 350);
    }

    // Mobile Menu
    const mobileBtn = document.getElementById("mobile-menu-btn");
    const mobileNav = document.getElementById("mobile-nav");
    if (mobileBtn && mobileNav) {
      mobileBtn.addEventListener("click", () => {
        mobileNav.classList.toggle("open");
      });
    }

    // Modal Triggers & Close Buttons
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal(backdrop.id);
      });
    });

    const openLoginBtn = document.getElementById("open-login-modal-btn");
    if (openLoginBtn) openLoginBtn.addEventListener("click", () => openModal("user-login-modal"));

    const gateLoginBtn = document.getElementById("gate-login-btn");
    if (gateLoginBtn) gateLoginBtn.addEventListener("click", () => openModal("user-login-modal"));

    const regOpenLoginBtn = document.getElementById("register-open-login-btn");
    if (regOpenLoginBtn) regOpenLoginBtn.addEventListener("click", () => openModal("user-login-modal"));

    // Admin Modal / Section Openers
    const adminTriggerBtn = document.getElementById("admin-trigger-btn");
    if (adminTriggerBtn) {
      adminTriggerBtn.addEventListener("click", () => {
        if (state.isAdmin) {
          if (isHomePage) {
            switchSection("admin", true);
          } else {
            window.location.href = "/?section=admin#workspace";
          }
        } else {
          openModal("admin-login-modal");
        }
      });
    }

    const panelUnlockBtn = document.getElementById("panel-unlock-admin-btn");
    if (panelUnlockBtn) panelUnlockBtn.addEventListener("click", () => openModal("admin-login-modal"));

    const quickAdminOpen = document.getElementById("quick-admin-open-btn");
    if (quickAdminOpen) {
      quickAdminOpen.addEventListener("click", () => {
        if (state.isAdmin) switchSection("admin", true);
        else openModal("admin-login-modal");
      });
    }

    document.querySelectorAll("[data-open-admin='true']").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.isAdmin) switchSection("admin", true);
        else openModal("admin-login-modal");
      });
    });

    // Left Scrollable Menu & Workspace Navigation
    document.querySelectorAll(".sidebar-link[data-section]").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchSection(btn.dataset.section, false);
      });
    });

    document.querySelectorAll("[data-switch-section]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = btn.dataset.switchSection;
        switchSection(sec, true);
        if (btn.dataset.filterCat) {
          const searchInput = document.getElementById("sample-search-input");
          if (searchInput) {
            searchInput.value = btn.dataset.filterCat.split(" ")[0];
            renderSamplesEverywhere();
          }
        }
      });
    });

    if (isHomePage) {
      document.querySelectorAll(".nav-link[data-nav-section], .mobile-nav a[data-nav-section]").forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          switchSection(link.dataset.navSection, true);
          if (mobileNav) mobileNav.classList.remove("open");
        });
      });
    }

    // Sample Search & Priority Filter
    const sampleSearch = document.getElementById("sample-search-input");
    const samplePriorityFilter = document.getElementById("sample-priority-filter");
    if (sampleSearch) sampleSearch.addEventListener("input", renderSamplesEverywhere);
    if (samplePriorityFilter) samplePriorityFilter.addEventListener("change", renderSamplesEverywhere);

    // User Login Form
    const userLoginForm = document.getElementById("user-login-form");
    if (userLoginForm) {
      userLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const feedback = document.getElementById("user-login-feedback");
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        setFeedback(feedback, "Signing in...");
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFeedback(feedback, data.error || "Sign in failed.", "error");
          return;
        }
        showToast("Signed in successfully!", "success");
        window.location.reload();
      });
    }

    // Logout Button
    const logoutBtn = document.getElementById("logout-user-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.reload();
      });
    }

    // Admin Login Form
    const adminLoginForm = document.getElementById("admin-login-form");
    if (adminLoginForm) {
      adminLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const feedback = document.getElementById("admin-login-feedback");
        const password = document.getElementById("admin-password-input").value;
        setFeedback(feedback, "Verifying...");
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFeedback(feedback, data.error || "Invalid Admin password.", "error");
          return;
        }
        document.getElementById("admin-password-input").value = "";
        setFeedback(feedback, "");
        closeModal("admin-login-modal");
        showToast("Admin Portal unlocked!", "success");
        await refreshState();
        if (isHomePage) {
          switchSection("admin", true);
        } else {
          window.location.href = "/?section=admin#workspace";
        }
      });
    }

    // Admin Exit Mode
    const adminLockBtn = document.getElementById("admin-lock-btn");
    if (adminLockBtn) {
      adminLockBtn.addEventListener("click", async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        showToast("Exited Admin mode.");
        await refreshState();
      });
    }

    // Admin Sample Website Create / Edit Form
    const adminSampleForm = document.getElementById("admin-sample-form");
    const cancelEditBtn = document.getElementById("sample-cancel-edit-btn");
    function resetSampleForm() {
      if (!adminSampleForm) return;
      adminSampleForm.reset();
      document.getElementById("sample-edit-id").value = "";
      document.getElementById("admin-sample-form-title").textContent = "Add New Sample Website";
      document.getElementById("sample-submit-btn").innerHTML = '<i data-lucide="plus-circle"></i><span>Add Sample Website</span>';
      if (cancelEditBtn) cancelEditBtn.classList.add("hidden");
      refreshIcons();
    }
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", resetSampleForm);

    if (adminSampleForm) {
      adminSampleForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const feedback = document.getElementById("admin-sample-feedback");
        const editId = document.getElementById("sample-edit-id").value;
        const payload = {
          name: document.getElementById("sample-name").value.trim(),
          url: document.getElementById("sample-url").value.trim(),
          category: document.getElementById("sample-category").value.trim(),
          priority: document.getElementById("sample-priority").value,
          description: document.getElementById("sample-description").value.trim(),
        };

        const endpoint = editId ? `/api/samples/${editId}` : "/api/samples";
        const method = editId ? "PUT" : "POST";
        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFeedback(feedback, data.error || "Failed to save sample website.", "error");
          return;
        }
        state.samples = data.samples || [];
        renderSamplesEverywhere();
        resetSampleForm();
        setFeedback(feedback, "Saved and synced to Dashboard & Footer!", "success");
        showToast("Sample website synced in real time!", "success");
      });
    }

    // Admin Table Edit/Delete Delegated Actions
    const adminTbody = document.getElementById("admin-samples-tbody");
    if (adminTbody) {
      adminTbody.addEventListener("click", async (e) => {
        const editBtn = e.target.closest("[data-edit-sample]");
        const deleteBtn = e.target.closest("[data-delete-sample]");
        if (editBtn) {
          const item = state.samples.find((s) => s.id === editBtn.dataset.editSample);
          if (!item) return;
          document.getElementById("sample-edit-id").value = item.id;
          document.getElementById("sample-name").value = item.name;
          document.getElementById("sample-url").value = item.url;
          document.getElementById("sample-category").value = item.category;
          document.getElementById("sample-priority").value = item.priority || "Standard";
          document.getElementById("sample-description").value = item.description;
          document.getElementById("admin-sample-form-title").textContent = "Edit Sample Website";
          document.getElementById("sample-submit-btn").innerHTML = '<i data-lucide="save"></i><span>Update Sample Website</span>';
          if (cancelEditBtn) cancelEditBtn.classList.remove("hidden");
          refreshIcons();
        } else if (deleteBtn) {
          const id = deleteBtn.dataset.deleteSample;
          const res = await fetch(`/api/samples/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (res.ok && data.ok) {
            state.samples = data.samples || [];
            renderSamplesEverywhere();
            showToast("Sample website deleted & footer updated.", "success");
          }
        }
      });
    }

    // Project Need & Wireframe Upload Form
    const postForm = document.getElementById("project-post-form");
    if (postForm) {
      postForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const feedback = document.getElementById("post-form-feedback");
        setFeedback(feedback, "Publishing request...");
        const formData = new FormData(postForm);
        const res = await fetch("/api/posts", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFeedback(feedback, data.error || "Could not publish post.", "error");
          return;
        }
        postForm.reset();
        state.posts = data.posts || [];
        renderPosts();
        setFeedback(feedback, "Published successfully!", "success");
        showToast("Project need & wireframe posted!", "success");
      });
    }

    // Project Posts Feed Actions (Edit / Delete / Admin Running URL)
    const postsFeed = document.getElementById("project-posts-feed");
    if (postsFeed) {
      postsFeed.addEventListener("click", async (e) => {
        const toggleEdit = e.target.closest("[data-toggle-edit-post]");
        const cancelEdit = e.target.closest("[data-cancel-edit-post]");
        const saveEdit = e.target.closest("[data-save-edit-post]");
        const deletePost = e.target.closest("[data-delete-post]");
        const saveRunningUrl = e.target.closest("[data-save-running-url]");

        if (toggleEdit) {
          const box = document.getElementById(`edit-box-${toggleEdit.dataset.toggleEditPost}`);
          if (box) box.classList.toggle("hidden");
        } else if (cancelEdit) {
          const box = document.getElementById(`edit-box-${cancelEdit.dataset.cancelEditPost}`);
          if (box) box.classList.add("hidden");
        } else if (saveEdit) {
          const id = saveEdit.dataset.saveEditPost;
          const title = document.getElementById(`edit-title-${id}`).value.trim();
          const description = document.getElementById(`edit-desc-${id}`).value.trim();
          const res = await fetch(`/api/posts/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            showToast(data.error || "Update failed.", "error");
            return;
          }
          state.posts = data.posts || [];
          renderPosts();
          showToast("Post updated!", "success");
        } else if (deletePost) {
          const id = deletePost.dataset.deletePost;
          const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            showToast(data.error || "Delete failed.", "error");
            return;
          }
          state.posts = data.posts || [];
          renderPosts();
          showToast("Post deleted.", "success");
        } else if (saveRunningUrl) {
          const id = saveRunningUrl.dataset.saveRunningUrl;
          const input = postsFeed.querySelector(`[data-running-url-input="${id}"]`);
          const running_url = input ? input.value.trim() : "";
          const res = await fetch(`/api/posts/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ running_url }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            showToast(data.error || "Could not attach running URL.", "error");
            return;
          }
          state.posts = data.posts || [];
          renderPosts();
          showToast("Running Web App URL embedded & ready to open in new tab!", "success");
        }
      });
    }

    // Registration Page Form
    const registerForm = document.getElementById("register-page-form");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const feedback = document.getElementById("register-feedback");
        const payload = {
          first_name: document.getElementById("reg-first-name").value.trim(),
          last_name: document.getElementById("reg-last-name").value.trim(),
          email: document.getElementById("reg-email").value.trim(),
          mobile: document.getElementById("reg-mobile").value.trim(),
          password: document.getElementById("reg-password").value,
          confirm_password: document.getElementById("reg-confirm-password").value,
        };
        setFeedback(feedback, "Creating account...");
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFeedback(feedback, data.error || "Registration failed.", "error");
          return;
        }
        setFeedback(feedback, "Account created! Redirecting to home...", "success");
        showToast("Welcome to Wixfix!", "success");
        setTimeout(() => {
          window.location.href = "/";
        }, 700);
      });
    }

    // Contact Page Form
    const contactForm = document.getElementById("contact-page-form");
    if (contactForm) {
      contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const feedback = document.getElementById("contact-feedback");
        const payload = {
          name: document.getElementById("contact-name").value.trim(),
          email: document.getElementById("contact-email").value.trim(),
          phone: document.getElementById("contact-phone").value.trim(),
          office: document.getElementById("contact-office").value,
          subject: document.getElementById("contact-subject").value.trim(),
          message: document.getElementById("contact-message").value.trim(),
        };
        setFeedback(feedback, "Sending inquiry...");
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFeedback(feedback, data.error || "Could not send message.", "error");
          return;
        }
        contactForm.reset();
        setFeedback(feedback, data.message, "success");
        showToast("Inquiry submitted!", "success");
      });
    }

    // Bottom-Right Minimized Google-Style Chatbot (Hover + Click + Search)
    const chatDock = document.getElementById("chatbot-dock");
    const chatFab = document.getElementById("chatbot-fab");
    const chatPinBtn = document.getElementById("chatbot-pin-btn");
    const chatMinBtn = document.getElementById("chatbot-minimize-btn");
    const chatForm = document.getElementById("chatbot-form");
    const chatInput = document.getElementById("chatbot-input");
    const chatResults = document.getElementById("chatbot-results");

    let hoverCloseTimer = null;
    if (chatDock) {
      chatDock.addEventListener("mouseenter", () => {
        if (hoverCloseTimer) clearTimeout(hoverCloseTimer);
        chatDock.classList.add("is-open");
      });
      chatDock.addEventListener("mouseleave", () => {
        if (chatDock.classList.contains("is-pinned") || document.activeElement === chatInput) return;
        hoverCloseTimer = setTimeout(() => {
          chatDock.classList.remove("is-open");
        }, 280);
      });
    }

    if (chatFab && chatDock) {
      chatFab.addEventListener("click", () => {
        chatDock.classList.toggle("is-open");
        if (chatDock.classList.contains("is-open") && chatInput) {
          chatInput.focus();
        }
      });
    }

    if (chatPinBtn && chatDock) {
      chatPinBtn.addEventListener("click", () => {
        const pinned = chatDock.classList.toggle("is-pinned");
        chatPinBtn.classList.toggle("active", pinned);
        if (pinned) chatDock.classList.add("is-open");
      });
    }

    if (chatMinBtn && chatDock) {
      chatMinBtn.addEventListener("click", () => {
        chatDock.classList.remove("is-pinned", "is-open");
        if (chatPinBtn) chatPinBtn.classList.remove("active");
        if (chatInput) chatInput.blur();
      });
    }

    function formatSimpleMarkdown(text) {
      return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br/>");
    }

    async function askChatbot(query) {
      if (!query || !chatResults) return;
      const userBubble = document.createElement("div");
      userBubble.className = "chat-msg user";
      userBubble.innerHTML = `<p>${escapeHtml(query)}</p>`;
      chatResults.appendChild(userBubble);

      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      const botBubble = document.createElement("div");
      botBubble.className = "chat-msg bot";
      const linksHtml = (data.links || [])
        .map((lnk) => {
          if (lnk.section) {
            return `<button type="button" class="chat-action-link" data-chat-section="${escapeHtml(lnk.section)}">${escapeHtml(lnk.label)} &rarr;</button>`;
          }
          if (lnk.external) {
            return `<a href="${escapeHtml(lnk.href)}" target="_blank" rel="noopener noreferrer" class="chat-action-link">${escapeHtml(lnk.label)} &#8599;</a>`;
          }
          return `<a href="${escapeHtml(lnk.href)}" class="chat-action-link">${escapeHtml(lnk.label)} &rarr;</a>`;
        })
        .join("");

      botBubble.innerHTML = `
        <p>${formatSimpleMarkdown(data.answer || "Here is what I found.")}</p>
        ${linksHtml ? `<div class="chat-links-row">${linksHtml}</div>` : ""}
      `;
      chatResults.appendChild(botBubble);
      chatResults.scrollTop = chatResults.scrollHeight;
    }

    if (chatForm && chatInput) {
      chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = chatInput.value.trim();
        if (!q) return;
        chatInput.value = "";
        askChatbot(q);
      });
    }

    document.querySelectorAll("[data-chat-q]").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (chatDock) chatDock.classList.add("is-open", "is-pinned");
        if (chatPinBtn) chatPinBtn.classList.add("active");
        askChatbot(chip.dataset.chatQ);
      });
    });

    if (chatResults) {
      chatResults.addEventListener("click", (e) => {
        const secBtn = e.target.closest("[data-chat-section]");
        if (!secBtn) return;
        const sec = secBtn.dataset.chatSection;
        if (isHomePage) {
          switchSection(sec, true);
        } else {
          window.location.href = `/?section=${encodeURIComponent(sec)}#workspace`;
        }
      });
    }
  });
})();
