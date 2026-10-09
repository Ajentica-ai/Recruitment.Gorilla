# ai-docs — Context & Specs for Recruitment Gorilla

These documents let any AI agent (or new contributor) understand the system and add features **in the same style and flow** the project already uses. Start at the repo-root [`AGENTS.md`](../AGENTS.md), then read here as needed.

## Maintenance rule
**When you change code, update the matching doc in this folder.** Stale docs are worse than no docs. Each file lists the source files it describes — keep them aligned.

## Index
| Doc | Read it when you need to… |
|---|---|
| [architecture.md](architecture.md) | Understand the system shape, tech stack, and how a request flows browser → proxy → API → DB. |
| [conventions.md](conventions.md) | Write code that matches existing style (backend layering, DTOs, logging; frontend query/service/theme patterns). |
| [data-model.md](data-model.md) | Work with the database entities and their relationships. |
| [backend.md](backend.md) | Touch the ASP.NET Core API: structure, EF Core/migrations, CV parsing, storage, logging. |
| [frontend.md](frontend.md) | Touch the React client: pages, components, data fetching, theme. |
| [auth.md](auth.md) | Protect an endpoint, call a protected API, or work on login/JWT. |
| [dev-setup.md](dev-setup.md) | Run the app, configure secrets, run migrations, **run the tests**, or expose it on the LAN. |
| [feature-playbook.md](feature-playbook.md) | Add a new feature end-to-end (the canonical recipe + checklist). |
| [cv-to-hired-pipeline.html](cv-to-hired-pipeline.html) | See the CV-upload-to-Hired flow as an interactive diagram (open in a browser): intake/parsing, draft review, and every candidate status transition. |
| [spec-template.md](spec-template.md) | Write a spec for a new feature before building it. |
| [product-improvement-roadmap.md](product-improvement-roadmap.md) | See prioritized ideas for what to build next (ATS gaps, analytics, compliance, eng health). |
| [specs/](specs/) | See/author feature specs. Includes a worked example. |

## How a new agent should use these
1. Read [`AGENTS.md`](../AGENTS.md) and [architecture.md](architecture.md) for the big picture.
2. Skim [conventions.md](conventions.md) so your code matches.
3. For a new feature: write a spec from [spec-template.md](spec-template.md) into [specs/](specs/), then implement following [feature-playbook.md](feature-playbook.md).
4. Verify per the playbook, and update any affected docs here.
