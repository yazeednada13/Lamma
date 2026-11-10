# Local Development — Lamma

**Status:** environment facts were detected on 2026-11-10 by read-only checks. The setup steps are [P] until Phase 1 is approved.

## 1. Detected environment (Windows 11 Pro)
| Tool | Detected | Notes |
|---|---|---|
| .NET SDKs | 7.0.401, 8.0.319, 8.0.427, 9.0.100, 9.0.308, 9.0.320 | **No .NET 10 SDK.** The target version is open (OQ-001) |
| dotnet-ef (global) | 9.0.6 | Must match the chosen EF Core major version. Any update is the founder's action |
| Node.js / npm | 22.17.0 / 10.9.2 | Suitable for Vite + React |
| pnpm | not installed | Not required |
| Python | 3.14.6 | Only for serving the prototype |
| SQL Server | Services `MSSQLSERVER` (default instance) and `MSSQL$MSSQLSERVER01` running; SQL Agent for 01 stopped | `sqlcmd` is on PATH, but its version output was empty |
| LocalDB | `MSSQLLocalDB`, `ProjectModels` instances | An option for test DBs |
| Docker | not installed | Testcontainers unavailable |
| Git | 2.47.1 | **Founder-only usage** |

## 2. Viewing the original prototype (reference only)
From `frontend-reference/Lamma-UI-Design/`:
```bash
python serve.py
```
Then open:
- http://127.0.0.1:5180/app/index.html (prototype)
- `#/screens` (screen index)
- `/design-system/components.html` (component catalogue)
- `/docs/ux-architecture.html` (sitemap and journeys)

Do **not** use `python -m http.server`, which truncates files over 64 KB on this machine (per the prototype README). Never edit files in this folder.

## 3. Backend setup (after Phase 1 approval) [P]
- Connection string via user-secrets, run from `src/Lamma.Api`:
  ```bash
  dotnet user-secrets set "ConnectionStrings:Lamma" "Server=localhost;Database=Lamma_Dev;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False"
  ```
  - Instance choice: the default `localhost`, `localhost\MSSQLSERVER01`, or `(localdb)\MSSQLLocalDB`. The founder decides.
- **Migrations and database updates are executed by the founder only.** The exact commands are provided at each Backend checkpoint (see DATABASE-DESIGN §13).
- Run the API with `dotnet run --project src/Lamma.Api`. The port is defined in `launchSettings.json`.
- Tests: `dotnet test`, using a separate test database (TESTING-STRATEGY §2).
- Recommended database setting (founder action): `ALTER DATABASE Lamma_Dev SET READ_COMMITTED_SNAPSHOT ON;`

## 4. Frontend setup (after Phase 1 Part B approval) [P]
```bash
cd frontend
npm install
npm run dev
```
- `npm install` runs only after the founder approves the dependency list.
- The dev server proxies `/api` to the backend, which keeps the origin same-site for cookie auth (option A).
- Production build: `npm run build`. Tests: `npm run test`.

## 5. Secrets & configuration rules
- Never commit connection strings with credentials, signing keys, or provider API keys.
- Use `appsettings.Development.json` only for non-secret settings.
- A `.gitignore` covering `bin/`, `obj/`, `node_modules/`, `dist/`, `*.user`, and `.env*` is proposed for Phase 1. The founder commits it.
