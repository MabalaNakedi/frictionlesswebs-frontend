const API = (window.FW_API_URL || '').replace(/\/$/, '');

const api = path => `${API}${path}`;


/* =========================================================
   GENERAL HELPERS
========================================================= */

function token() {
  return localStorage.getItem('fw_token') || '';
}

function esc(value) {

  return String(value ?? '').replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]
  );

}

function formatDate(value) {

  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  );

}

function formatDateTime(value) {

  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );

}

async function request(path, options = {}) {

  const headers = {
    ...(options.headers || {})
  };

  if (token()) {
    headers.Authorization =
      `Bearer ${token()}`;
  }

  const response = await fetch(
    api(path),
    {
      ...options,
      headers
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {

    const error = new Error(
      data.error ||
      `Request failed (${response.status})`
    );

    error.status = response.status;

    throw error;
  }

  return data;
}


/* =========================================================
   NORMAL WEBSITE MOBILE MENU
========================================================= */

const menu =
  document.querySelector('.menu');

const links =
  document.querySelector('.links');

if (menu && links) {

  menu.addEventListener(
    'click',
    () => {
      links.classList.toggle('open');
    }
  );

}

document
  .querySelectorAll('.links a')
  .forEach(link => {

    link.addEventListener(
      'click',
      () => {
        links?.classList.remove('open');
      }
    );

  });


/* =========================================================
   CONTACT FORM
========================================================= */

const contactForm =
  document.querySelector('[data-contact]');

if (contactForm) {

  contactForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();

      const notice =
        contactForm.querySelector('.notice');

      if (notice) {
        notice.className = 'notice';
        notice.textContent = 'Sending…';
      }

      try {

        const data =
          Object.fromEntries(
            new FormData(contactForm)
          );

        const response =
          await request(
            '/api/messages',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify(data)
            }
          );

        if (notice) {
          notice.classList.add('ok');
          notice.textContent =
            response.message;
        }

        contactForm.reset();

      } catch (error) {

        if (notice) {

          notice.classList.add('err');

          notice.textContent =
            API
              ? error.message
              : 'Backend not connected yet.';
        }

      }

    }
  );

}


/* =========================================================
   LOGIN / REGISTER
========================================================= */

function authForm(type) {

  const form =
    document.querySelector(
      `[data-${type}]`
    );

  if (!form) return;

  form.addEventListener(
    'submit',
    async event => {

      event.preventDefault();

      const notice =
        form.querySelector('.notice');

      if (notice) {
        notice.className = 'notice';
        notice.textContent =
          'Please wait…';
      }

      try {

        const response =
          await request(
            `/api/${type}`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify(
                  Object.fromEntries(
                    new FormData(form)
                  )
                )
            }
          );

        localStorage.setItem(
          'fw_token',
          response.token
        );

        if (notice) {
          notice.classList.add('ok');
          notice.textContent =
            'Success. Redirecting…';
        }

        location.href =
          response.user.role === 'admin'
            ? 'admin.html'
            : 'dashboard.html';

      } catch (error) {

        if (notice) {

          notice.classList.add('err');

          notice.textContent =
            API
              ? error.message
              : 'Backend not connected yet.';
        }

      }

    }
  );

}

authForm('login');
authForm('register');


/* =========================================================
   NORMAL CLIENT DASHBOARD AUTH
========================================================= */

async function requireUser() {

  const userElement =
    document.querySelector('[data-user]');

  if (!userElement) return;

  try {

    const data =
      await request('/api/me');

    userElement.textContent =
      data.user.name;

    const adminLink =
      document.querySelector(
        '[data-admin-link]'
      );

    if (
      adminLink &&
      data.user.role === 'admin'
    ) {
      adminLink.hidden = false;
    }

  } catch {

    location.href =
      'login.html';

  }

}

requireUser();


/* =========================================================
   LOGOUT
========================================================= */

document
  .querySelectorAll('[data-logout]')
  .forEach(button => {

    button.addEventListener(
      'click',
      () => {

        localStorage.removeItem(
          'fw_token'
        );

        location.href =
          'index.html';

      }
    );

  });


/* =========================================================
   ADMIN APPLICATION
========================================================= */

const adminRoot =
  document.querySelector('.admin-body');

if (adminRoot) {
  initAdmin();
}


async function initAdmin() {

  const state = {
    user: null,
    overview: null,
    clients: [],
    messages: [],
    projects: [],
    activity: [],
    messageFilter: 'all'
  };


  /* -------------------------------------------------------
     ELEMENTS
  ------------------------------------------------------- */

  const sidebar =
    document.querySelector(
      '[data-admin-sidebar]'
    );

  const overlay =
    document.querySelector(
      '[data-admin-overlay]'
    );

  const projectModal =
    document.querySelector(
      '[data-project-modal]'
    );

  const projectForm =
    document.querySelector(
      '[data-project-form]'
    );


  /* -------------------------------------------------------
     VERIFY ADMIN
  ------------------------------------------------------- */

  try {

    const me =
      await request('/api/me');

    if (
      !me.user ||
      me.user.role !== 'admin'
    ) {

      location.href =
        'dashboard.html';

      return;
    }

    state.user =
      me.user;

    const name =
      me.user.name || 'Admin';

    document
      .querySelectorAll(
        '[data-admin-name], [data-admin-greeting]'
      )
      .forEach(element => {

        element.textContent =
          name;

      });

  } catch {

    location.href =
      'login.html';

    return;

  }


  /* -------------------------------------------------------
     MOBILE SIDEBAR
  ------------------------------------------------------- */

  function openSidebar() {

    sidebar?.classList.add('open');
    overlay?.classList.add('show');

  }

  function closeSidebar() {

    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');

  }

  document
    .querySelector('[data-admin-menu]')
    ?.addEventListener(
      'click',
      openSidebar
    );

  document
    .querySelector('[data-admin-close]')
    ?.addEventListener(
      'click',
      closeSidebar
    );

  overlay?.addEventListener(
    'click',
    closeSidebar
  );


  /* -------------------------------------------------------
     PAGE NAVIGATION
  ------------------------------------------------------- */

  function showSection(section) {

    document
      .querySelectorAll(
        '[data-admin-page]'
      )
      .forEach(page => {

        page.classList.toggle(
          'active',
          page.dataset.adminPage ===
            section
        );

      });

    document
      .querySelectorAll(
        '[data-admin-section]'
      )
      .forEach(button => {

        button.classList.toggle(
          'active',
          button.dataset.adminSection ===
            section
        );

      });

    closeSidebar();

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }

  document
    .querySelectorAll(
      '[data-admin-section]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          showSection(
            button.dataset.adminSection
          );

        }
      );

    });

  document
    .querySelectorAll(
      '[data-go-section]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          showSection(
            button.dataset.goSection
          );

        }
      );

    });


  /* -------------------------------------------------------
     LOAD ALL ADMIN DATA
  ------------------------------------------------------- */

  async function loadAll() {

    try {

      const [
        overview,
        clients,
        messages,
        projects,
        activity
      ] = await Promise.all([

        request(
          '/api/admin/overview'
        ),

        request(
          '/api/admin/clients'
        ),

        request(
          '/api/admin/messages'
        ),

        request(
          '/api/admin/projects'
        ),

        request(
          '/api/admin/activity'
        )

      ]);

      state.overview =
        overview;

      state.clients =
        clients.clients || [];

      state.messages =
        messages.messages || [];

      state.projects =
        projects.projects || [];

      state.activity =
        activity.activity || [];

      renderEverything();

    } catch (error) {

      console.error(error);

      if (
        error.status === 401 ||
        error.status === 403
      ) {

        location.href =
          'login.html';

      }

    }

  }


  /* -------------------------------------------------------
     RENDER EVERYTHING
  ------------------------------------------------------- */

  function renderEverything() {

    renderStats();

    renderRecentEnquiries();

    renderOverviewProjects();

    renderClients();

    renderMessages();

    renderProjects();

    renderActivity();

    populateClientSelect();

  }


  /* -------------------------------------------------------
     STATS
  ------------------------------------------------------- */

  function renderStats() {

    const stats =
      state.overview?.stats || {};

    setText(
      '[data-stat-clients]',
      stats.clients || 0
    );

    setText(
      '[data-stat-messages]',
      stats.newMessages || 0
    );

    setText(
      '[data-stat-active]',
      stats.activeProjects || 0
    );

    setText(
      '[data-stat-completed]',
      stats.completedProjects || 0
    );

    setText(
      '[data-new-message-count]',
      stats.newMessages || 0
    );

  }


  /* -------------------------------------------------------
     RECENT ENQUIRIES
  ------------------------------------------------------- */

  function renderRecentEnquiries() {

    const container =
      document.querySelector(
        '[data-recent-enquiries]'
      );

    if (!container) return;

    const messages =
      state.messages.slice(0, 5);

    if (!messages.length) {

      container.innerHTML =
        emptyState(
          'No enquiries yet',
          'New website enquiries will appear here.'
        );

      return;
    }

    container.innerHTML =
      messages.map(message => `

        <article class="admin-mini-row">

          <div class="admin-mini-avatar">
            ${esc(
              message.name
                ?.charAt(0)
                ?.toUpperCase() || '?'
            )}
          </div>

          <div class="admin-mini-content">

            <strong>
              ${esc(message.name)}
            </strong>

            <span>
              ${esc(
                message.company ||
                message.email
              )}
            </span>

          </div>

          <div class="admin-mini-meta">

            <span class="admin-status status-${esc(message.status)}">
              ${esc(message.status)}
            </span>

            <small>
              ${formatDate(
                message.created_at
              )}
            </small>

          </div>

        </article>

      `).join('');

  }


  /* -------------------------------------------------------
     OVERVIEW PROJECTS
  ------------------------------------------------------- */

  function renderOverviewProjects() {

    const container =
      document.querySelector(
        '[data-overview-projects]'
      );

    if (!container) return;

    const projects =
      state.projects
        .filter(project =>
          ![
            'completed',
            'cancelled'
          ].includes(project.status)
        )
        .slice(0, 5);

    if (!projects.length) {

      container.innerHTML =
        emptyState(
          'No active projects',
          'Create your first client project.'
        );

      return;
    }

    container.innerHTML =
      projects.map(project => `

        <article class="admin-project-mini">

          <div class="admin-project-mini-top">

            <div>

              <strong>
                ${esc(project.name)}
              </strong>

              <span>
                ${esc(
                  project.client_name ||
                  'Unassigned'
                )}
              </span>

            </div>

            <strong>
              ${Number(project.progress) || 0}%
            </strong>

          </div>

          <div class="admin-progress">

            <span
              style="width:${Number(project.progress) || 0}%"
            ></span>

          </div>

          <div class="admin-project-mini-bottom">

            <span>
              ${esc(project.stage)}
            </span>

            <span>
              ${esc(project.status)}
            </span>

          </div>

        </article>

      `).join('');

  }


  /* -------------------------------------------------------
     CLIENTS
  ------------------------------------------------------- */

  function renderClients(
    clients = state.clients
  ) {

    const container =
      document.querySelector(
        '[data-clients]'
      );

    if (!container) return;

    const count =
      document.querySelector(
        '[data-client-result-count]'
      );

    if (count) {

      count.textContent =
        `${clients.length} ${
          clients.length === 1
            ? 'client'
            : 'clients'
        }`;

    }

    if (!clients.length) {

      container.innerHTML =
        emptyState(
          'No clients found',
          'Registered client accounts will appear here.'
        );

      return;
    }

    container.innerHTML = `

      <table class="admin-table">

        <thead>

          <tr>
            <th>Client</th>
            <th>Projects</th>
            <th>Joined</th>
            <th></th>
          </tr>

        </thead>

        <tbody>

          ${clients.map(client => `

            <tr>

              <td>

                <div class="admin-client-cell">

                  <div class="admin-client-avatar">

                    ${esc(
                      client.name
                        ?.charAt(0)
                        ?.toUpperCase() || '?'
                    )}

                  </div>

                  <div>

                    <strong>
                      ${esc(client.name)}
                    </strong>

                    <span>
                      ${esc(client.email)}
                    </span>

                  </div>

                </div>

              </td>

              <td>
                ${Number(
                  client.project_count
                ) || 0}
              </td>

              <td>
                ${formatDate(
                  client.created_at
                )}
              </td>

              <td>

                <button
                  class="admin-small-btn"
                  type="button"
                  data-create-for-client="${esc(client.id)}"
                >
                  + Project
                </button>

              </td>

            </tr>

          `).join('')}

        </tbody>

      </table>

    `;

    container
      .querySelectorAll(
        '[data-create-for-client]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            openProjectModal();

            const select =
              projectForm?.elements.userId;

            if (select) {

              select.value =
                button.dataset
                  .createForClient;

            }

          }
        );

      });

  }


  /* CLIENT SEARCH */

  document
    .querySelector(
      '[data-client-search]'
    )
    ?.addEventListener(
      'input',
      event => {

        const search =
          event.target.value
            .trim()
            .toLowerCase();

        const filtered =
          state.clients.filter(
            client => {

              return (
                client.name
                  .toLowerCase()
                  .includes(search) ||

                client.email
                  .toLowerCase()
                  .includes(search)
              );

            }
          );

        renderClients(filtered);

      }
    );


  /* -------------------------------------------------------
     MESSAGES
  ------------------------------------------------------- */

  function renderMessages() {

    const container =
      document.querySelector(
        '[data-admin-messages]'
      );

    if (!container) return;

    let messages =
      [...state.messages];

    if (
      state.messageFilter !== 'all'
    ) {

      messages =
        messages.filter(
          message =>
            message.status ===
            state.messageFilter
        );

    }

    if (!messages.length) {

      container.innerHTML =
        emptyState(
          'No enquiries',
          'There are no enquiries in this category.'
        );

      return;
    }

    container.innerHTML =
      messages.map(message => `

        <article class="admin-enquiry">

          <div class="admin-enquiry-top">

            <div class="admin-client-cell">

              <div class="admin-client-avatar">

                ${esc(
                  message.name
                    ?.charAt(0)
                    ?.toUpperCase() || '?'
                )}

              </div>

              <div>

                <strong>
                  ${esc(message.name)}
                </strong>

                <a
                  href="mailto:${esc(message.email)}"
                >
                  ${esc(message.email)}
                </a>

              </div>

            </div>

            <span
              class="admin-status status-${esc(message.status)}"
            >
              ${esc(message.status)}
            </span>

          </div>


          <div class="admin-enquiry-details">

            ${
              message.company
                ? `
                  <span>
                    <small>COMPANY</small>
                    ${esc(message.company)}
                  </span>
                `
                : ''
            }

            ${
              message.budget
                ? `
                  <span>
                    <small>BUDGET</small>
                    ${esc(message.budget)}
                  </span>
                `
                : ''
            }

            <span>
              <small>RECEIVED</small>
              ${formatDateTime(
                message.created_at
              )}
            </span>

          </div>


          <p class="admin-enquiry-message">
            ${esc(message.message)}
          </p>


          <div class="admin-enquiry-actions">

            <a
              class="admin-secondary-btn"
              href="mailto:${esc(message.email)}"
            >
              Email client
            </a>

            <select
              class="admin-status-select"
              data-message-status="${esc(message.id)}"
            >

              ${[
                'new',
                'read',
                'contacted',
                'closed'
              ].map(status => `

                <option
                  value="${status}"
                  ${
                    status ===
                    message.status
                      ? 'selected'
                      : ''
                  }
                >
                  ${status}
                </option>

              `).join('')}

            </select>

          </div>

        </article>

      `).join('');

    container
      .querySelectorAll(
        '[data-message-status]'
      )
      .forEach(select => {

        select.addEventListener(
          'change',
          async () => {

            try {

              await request(
                `/api/admin/messages/${select.dataset.messageStatus}`,
                {
                  method: 'PATCH',

                  headers: {
                    'Content-Type':
                      'application/json'
                  },

                  body:
                    JSON.stringify({
                      status:
                        select.value
                    })
                }
              );

              await loadAll();

            } catch (error) {

              alert(error.message);

            }

          }
        );

      });

  }


  /* MESSAGE FILTERS */

  document
    .querySelectorAll(
      '[data-message-filter]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          state.messageFilter =
            button.dataset.messageFilter;

          document
            .querySelectorAll(
              '[data-message-filter]'
            )
            .forEach(item => {

              item.classList.toggle(
                'active',
                item === button
              );

            });

          renderMessages();

        }
      );

    });


  /* -------------------------------------------------------
     PROJECTS
  ------------------------------------------------------- */

  function renderProjects() {

    const container =
      document.querySelector(
        '[data-projects]'
      );

    if (!container) return;

    if (!state.projects.length) {

      container.innerHTML =
        emptyState(
          'No projects yet',
          'Create your first project and assign it to a client.'
        );

      return;
    }

    container.innerHTML = `

      <div class="admin-project-grid">

        ${state.projects.map(project => `

          <article class="admin-project-card">

            <div class="admin-project-card-top">

              <span
                class="admin-status status-${esc(project.status)}"
              >
                ${esc(project.status)}
              </span>

              <span class="admin-project-percent">
                ${Number(project.progress) || 0}%
              </span>

            </div>


            <h2>
              ${esc(project.name)}
            </h2>

            <p class="admin-project-client">

              ${esc(
                project.client_name ||
                'No client assigned'
              )}

            </p>


            <p class="admin-project-description">

              ${esc(
                project.description ||
                'No project description yet.'
              )}

            </p>


            <div class="admin-progress">

              <span
                style="width:${Number(project.progress) || 0}%"
              ></span>

            </div>


            <div class="admin-project-info">

              <div>
                <small>STAGE</small>
                <strong>
                  ${esc(project.stage)}
                </strong>
              </div>

              <div>
                <small>COMPLETION</small>
                <strong>
                  ${formatDate(
                    project.estimated_completion
                  )}
                </strong>
              </div>

            </div>


            <div class="admin-project-actions">

              <button
                class="admin-secondary-btn"
                type="button"
                data-edit-project="${esc(project.id)}"
              >
                Edit project
              </button>

              <button
                class="admin-danger-btn"
                type="button"
                data-delete-project="${esc(project.id)}"
              >
                Delete
              </button>

            </div>

          </article>

        `).join('')}

      </div>

    `;


    /* EDIT */

    container
      .querySelectorAll(
        '[data-edit-project]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            const project =
              state.projects.find(
                item =>
                  item.id ===
                  button.dataset.editProject
              );

            if (project) {
              openProjectModal(project);
            }

          }
        );

      });


    /* DELETE */

    container
      .querySelectorAll(
        '[data-delete-project]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          async () => {

            const project =
              state.projects.find(
                item =>
                  item.id ===
                  button.dataset.deleteProject
              );

            if (!project) return;

            const confirmed =
              confirm(
                `Delete "${project.name}"?`
              );

            if (!confirmed) return;

            try {

              await request(
                `/api/admin/projects/${project.id}`,
                {
                  method: 'DELETE'
                }
              );

              await loadAll();

            } catch (error) {

              alert(error.message);

            }

          }
        );

      });

  }


  /* -------------------------------------------------------
     ACTIVITY
  ------------------------------------------------------- */

  function renderActivity() {

    const container =
      document.querySelector(
        '[data-admin-activity]'
      );

    if (!container) return;

    if (!state.activity.length) {

      container.innerHTML =
        emptyState(
          'No activity yet',
          'Project and client activity will appear here.'
        );

      return;
    }

    container.innerHTML =
      state.activity.map(item => `

        <article class="admin-activity-row">

          <div class="admin-activity-dot"></div>

          <div class="admin-activity-content">

            <div>

              <strong>
                ${esc(item.title)}
              </strong>

              <small>
                ${formatDateTime(
                  item.created_at
                )}
              </small>

            </div>

            <p>
              ${esc(item.description)}
            </p>

            ${
              item.client_name
                ? `
                  <span>
                    ${esc(item.client_name)}
                    ${
                      item.project_name
                        ? ` · ${esc(item.project_name)}`
                        : ''
                    }
                  </span>
                `
                : ''
            }

          </div>

        </article>

      `).join('');

  }


  /* -------------------------------------------------------
     PROJECT MODAL
  ------------------------------------------------------- */

  function populateClientSelect() {

    const select =
      document.querySelector(
        '[data-project-client]'
      );

    if (!select) return;

    const current =
      select.value;

    select.innerHTML = `

      <option value="">
        Select a client
      </option>

      ${state.clients.map(client => `

        <option value="${esc(client.id)}">

          ${esc(client.name)}
          — ${esc(client.email)}

        </option>

      `).join('')}

    `;

    if (
      state.clients.some(
        client =>
          client.id === current
      )
    ) {

      select.value =
        current;

    }

  }


  function openProjectModal(
    project = null
  ) {

    if (
      !projectModal ||
      !projectForm
    ) return;

    projectForm.reset();

    populateClientSelect();

    const title =
      document.querySelector(
        '[data-project-modal-title]'
      );

    const progressValue =
      document.querySelector(
        '[data-progress-value]'
      );

    if (project) {

      if (title) {
        title.textContent =
          'Edit project';
      }

      projectForm.elements.projectId.value =
        project.id;

      projectForm.elements.userId.value =
        project.user_id || '';

      projectForm.elements.name.value =
        project.name || '';

      projectForm.elements.description.value =
        project.description || '';

      projectForm.elements.status.value =
        project.status || 'planning';

      projectForm.elements.stage.value =
        project.stage || 'Planning';

      projectForm.elements.progress.value =
        Number(project.progress) || 0;

      projectForm.elements.startedAt.value =
        dateInputValue(
          project.started_at
        );

      projectForm.elements.estimatedCompletion.value =
        dateInputValue(
          project.estimated_completion
        );

    } else {

      if (title) {
        title.textContent =
          'Create project';
      }

      projectForm.elements.projectId.value =
        '';

      projectForm.elements.progress.value =
        0;

    }

    if (progressValue) {

      progressValue.textContent =
        `${projectForm.elements.progress.value}%`;

    }

    projectModal.hidden =
      false;

    document.body.classList.add(
      'modal-open'
    );

  }


  function closeProjectModal() {

    if (!projectModal) return;

    projectModal.hidden =
      true;

    document.body.classList.remove(
      'modal-open'
    );

  }


  document
    .querySelectorAll(
      '[data-open-project-modal]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => openProjectModal()
      );

    });


  document
    .querySelectorAll(
      '[data-close-project-modal]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        closeProjectModal
      );

    });


  const progressInput =
    document.querySelector(
      '[data-progress-input]'
    );

  progressInput?.addEventListener(
    'input',
    () => {

      setText(
        '[data-progress-value]',
        `${progressInput.value}%`
      );

    }
  );


  /* SAVE PROJECT */

  projectForm?.addEventListener(
    'submit',
    async event => {

      event.preventDefault();

      const notice =
        document.querySelector(
          '[data-project-notice]'
        );

      if (notice) {

        notice.className =
          'notice';

        notice.textContent =
          'Saving project…';

      }

      const formData =
        Object.fromEntries(
          new FormData(projectForm)
        );

      const projectId =
        formData.projectId;

      const payload = {

        userId:
          formData.userId,

        name:
          formData.name,

        description:
          formData.description,

        status:
          formData.status,

        stage:
          formData.stage,

        progress:
          Number(formData.progress),

        startedAt:
          formData.startedAt || null,

        estimatedCompletion:
          formData.estimatedCompletion || null

      };

      try {

        if (projectId) {

          await request(
            `/api/admin/projects/${projectId}`,
            {
              method: 'PATCH',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify(payload)
            }
          );

        } else {

          await request(
            '/api/admin/projects',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify(payload)
            }
          );

        }

        if (notice) {

          notice.classList.add('ok');

          notice.textContent =
            'Project saved.';

        }

        await loadAll();

        setTimeout(
          closeProjectModal,
          400
        );

      } catch (error) {

        if (notice) {

          notice.classList.add('err');

          notice.textContent =
            error.message;

        }

      }

    }
  );


  /* -------------------------------------------------------
     INITIAL LOAD
  ------------------------------------------------------- */

  await loadAll();


  /* -------------------------------------------------------
     ADMIN HELPERS
  ------------------------------------------------------- */

  function setText(
    selector,
    value
  ) {

    const element =
      document.querySelector(selector);

    if (element) {
      element.textContent =
        value;
    }

  }

}


/* =========================================================
   SHARED UI HELPERS
========================================================= */

function emptyState(
  title,
  text
) {

  return `

    <div class="admin-empty">

      <div class="admin-empty-icon">
        ◇
      </div>

      <strong>
        ${esc(title)}
      </strong>

      <p>
        ${esc(text)}
      </p>

    </div>

  `;

}


function dateInputValue(value) {

  if (!value) return '';

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return date
    .toISOString()
    .slice(0, 10);

    }
