# CI Folder Guide (English)

This document explains the structure of the `ci/` folder, what each file does, how modules interact, and a deep dive into `buildAndScan.groovy`.

## 1) What the `ci/` folder contains

```text
ci/
└── jenkins/
    ├── config.groovy
    └── steps/
        ├── preventLoop.groovy
        ├── systemCheck.groovy
        ├── install.groovy
        ├── dependencyCheck.groovy
        ├── trivyFsScan.groovy
        ├── unitTests.groovy
        ├── sonarSast.groovy
        ├── iacCheckov.groovy
        ├── buildAndScan.groovy
        ├── pushAndGitOps.groovy
        ├── dastZap.groovy
        └── postCleanup.groovy
```

Important: The orchestrator is still `Jenkinsfile` at repo root. It loads modules from `ci/jenkins/`.

## 2) Execution model

`Jenkinsfile` is intentionally thin and delegates logic to files under `ci/jenkins/steps`.

High-level flow:

1. Checkout code.
2. Load config (`config.groovy`) and step modules (`load(...)`).
3. Run guard steps (`Prevent Loop`, `System Check`, `Install`).
4. Run pre-build checks in parallel:
   - Dependency check (SCA)
   - Trivy FS
   - Unit tests
   - SonarQube SAST
   - Checkov IaC
5. Build and image-scan only impacted services (`buildAndScan.groovy`).
6. Push images and update GitOps values (`pushAndGitOps.groovy`) if anything was built.
7. Run DAST (OWASP ZAP).
8. Always archive reports and clean workspace.

## 3) File-by-file responsibilities

### `ci/jenkins/config.groovy`

Single source of CI constants and runtime settings:

- Docker images (Node, Trivy, Sonar scanner, Checkov)
- Services list
- Dockerfiles/paths
- GitOps repo and target branch (`GITOPS_BRANCH` override supported)
- ZAP target

It returns a `cfg` map that all step scripts use.

### `ci/jenkins/steps/preventLoop.groovy`

Stops CI when latest commit contains `[skip ci]`. This prevents self-trigger loops caused by GitOps update commits.

### `ci/jenkins/steps/systemCheck.groovy`

Basic agent validation (`docker --version`) to fail early if the runner is not ready.

### `ci/jenkins/steps/install.groovy`

Runs dependency install and Prisma generate inside a Node container.

### `ci/jenkins/steps/dependencyCheck.groovy`

Runs OWASP Dependency-Check and fails on CVSS >= 7.
Outputs reports to `dependency-check-report/` (HTML + JSON).

### `ci/jenkins/steps/trivyFsScan.groovy`

Runs Trivy filesystem scan over workspace and fails on HIGH/CRITICAL findings.

### `ci/jenkins/steps/unitTests.groovy`

Runs test suite (`pnpm turbo run test`) in containerized Node environment.

### `ci/jenkins/steps/sonarSast.groovy`

Runs Sonar scanner in Docker with Jenkins Sonar environment (`withSonarQubeEnv`).

### `ci/jenkins/steps/iacCheckov.groovy`

Runs Checkov for Dockerfile + Helm checks.
- Streams result to console
- Saves output to `checkov-report/checkov-report.txt`
- Fails build when Checkov exits non-zero

### `ci/jenkins/steps/buildAndScan.groovy`

Decides what to build based on git changes, builds impacted images, then Trivy scans each built image with fail-fast gates.
Returns a CSV list of built services used by downstream stage.

### `ci/jenkins/steps/pushAndGitOps.groovy`

- Logs in to Docker Hub using isolated `DOCKER_CONFIG`
- Pushes built image tags (`v<BUILD_NUMBER>` + `latest`)
- Updates Helm values on GitOps branch
- Uses `GIT_ASKPASS` for safer HTTPS auth
- Retries push with fetch/rebase to handle branch race conditions

### `ci/jenkins/steps/dastZap.groovy`

Runs OWASP ZAP baseline scan and outputs HTML + JSON report in `zap-report/`.

### `ci/jenkins/steps/postCleanup.groovy`

Always archives artifacts and cleans workspace.

## 4) How modules interact

### Config and dependency injection

All step files are loaded by `Jenkinsfile` and called with `cfg` when needed.

- `cfg` is produced once by `config.groovy`
- `cfg` values are consumed across steps (images, service names, paths, URLs)

### Cross-stage data flow

`buildAndScan.groovy` returns `builtServicesCsv` and `Jenkinsfile` stores it in `env.BUILT_SERVICES`.

`pushAndGitOps.groovy` consumes `env.BUILT_SERVICES`.
If empty, push stage is skipped.

### Report flow

- `dependencyCheck.groovy` -> `dependency-check-report/*`
- `iacCheckov.groovy` -> `checkov-report/*`
- `dastZap.groovy` -> `zap-report/*`
- `postCleanup.groovy` archives all above paths

## 5) Deep dive: `buildAndScan.groovy`

This script is longer because it combines three concerns:

1. Change detection
2. Selective build planning
3. Build-time image vulnerability gates

### Inputs

- `cfg` map from `config.groovy`
- Environment and params:
  - `FORCE_BUILD_ALL` (param/env)
  - PR metadata (`CHANGE_TARGET`)
  - Jenkins history vars (`GIT_PREVIOUS_SUCCESSFUL_COMMIT`, `GIT_PREVIOUS_COMMIT`)

### Output

- Returns comma-separated built service IDs (for example: `gateway,metadata-service,web`)

### Step-by-step behavior

1. Resolve target image tag (`v${BUILD_NUMBER}`).
2. Determine whether full rebuild is forced (`shouldForceBuildAll()`).
3. Compute a robust diff range (`resolveDiffRange()`):
   - Preferred for PR: merge-base against target branch
   - Fallback: previous successful/previous commit
   - Last fallback: `HEAD~1..HEAD`
   - If none available: force full rebuild for safety
4. Collect changed file paths (`getChangedFiles(...)`).
5. For each backend service in `cfg.services`:
   - Determine impact with `isServiceImpacted(...)`
   - Build image if impacted
   - Trivy image scan with HIGH/CRITICAL fail-fast
6. Evaluate web impact via `isWebImpacted(...)`.
7. Build and scan web image if impacted.
8. Return built list as CSV.

### Helper functions explained

#### `shouldForceBuildAll()`

Checks both `env.FORCE_BUILD_ALL` and Jenkins parameter `params.FORCE_BUILD_ALL`.

#### `resolveDiffRange()`

Attempts to prevent false negatives in change detection:

- PR branch mode: fetch target branch and compute merge-base.
- Branch mode: use previous successful commit when available.
- Fresh branch fallback: use `HEAD~1..HEAD`.
- No safe range: return `null` -> caller switches to full rebuild.

#### `getChangedFiles(diffRange)`

Runs `git diff --name-only`, normalizes newline-separated file list into a Groovy list.

#### `isServiceImpacted(service, changedFiles)`

A service is impacted when either:

- Path starts with `services/<service>/`
- Path is globally backend-impacting (`libs/`, root dependency/build files, backend Dockerfile)

#### `isWebImpacted(cfg, changedFiles)`

Web is impacted when either:

- Path starts with `apps/web/`
- Path is globally web-impacting (web Dockerfile, lockfiles, workspace build config)

#### `isGlobalBackendImpact(path)` / `isGlobalWebImpact(path, cfg)`

These keep impact rules centralized and easy to extend.

### Why this is safer than `HEAD~1` only

Using only `HEAD~1` can miss changes in these cases:

- First build of a branch
- Rebased/squashed history
- PR builds needing merge-base context
- Interrupted pipelines with no previous success

The current logic degrades to full rebuild when uncertain, prioritizing security correctness over speed.

### Performance notes

- Selective build reduces unnecessary image rebuilds.
- Full rebuild fallback is intentionally conservative.
- Trivy image scan runs once per built image and can increase time linearly with image count.

### Typical customization points

- Add/remove services in `cfg.services`
- Add global impact file rules in helper functions
- Tune Trivy severities/flags
- Introduce additional outputs (for example JSON summary of built services)

## 6) If you add a new CI step

Recommended pattern:

1. Create `ci/jenkins/steps/<newStep>.groovy` with `def call(...)` and `return this`.
2. Load it in `Jenkinsfile` during `Checkout & Initialize Modules`.
3. Call it in the appropriate stage.
4. If it generates reports, archive them in `postCleanup.groovy`.

## 7) Quick troubleshooting

- Nothing built unexpectedly: inspect `resolveDiffRange()` and changed-file logs in build output.
- Push skipped: `BUILT_SERVICES` was empty.
- GitOps push fails: verify target branch exists and Jenkins credential IDs are correct.
- Sonar failures: verify Jenkins Sonar installation name and token binding.

