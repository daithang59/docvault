# Thư mục `vars`

Thư mục `vars/` chứa các Jenkins Shared Library global steps của DocVault. Trong Jenkins, mỗi file `vars/<ten>.groovy` được Jenkins tự động expose thành một step tên `<ten>()`. Hàm `def call(...)` trong từng file là entrypoint được gọi từ `Jenkinsfile` hoặc `Jenkinsfile.storage`.

Mục tiêu của thư mục này là giữ `Jenkinsfile` ngắn gọn, tái sử dụng được các bước CI/CD, và gom logic DevSecOps vào các step có trách nhiệm rõ ràng.

## Cách cấu hình hoạt động

Step trung tâm là `docvaultConfig()`. Step này đọc biến môi trường, áp dụng giá trị mặc định, rồi trả về map `cfg`. Các step khác nhận `cfg` để biết image Docker cần dùng, registry, GitOps branch, danh sách service, SonarQube, Argo CD, Terraform, Helm values và các tuỳ chọn bảo mật.

Các nguồn cấu hình chính:

- Biến môi trường Jenkins, ví dụ `GITOPS_BRANCH`, `RELEASE_BRANCH`, `REGISTRY_HOST`, `SONAR_HOST_URL`, `DEPLOY_TARGET_URL`, `ZAP_TARGET`.
- Jenkins parameters trong `Jenkinsfile`, sau đó được merge vào `cfg`.
- Jenkins credentials, ví dụ registry credential, GitHub credential, NVD API key, kubeconfig, cosign key.

## Luồng pipeline chính

`Jenkinsfile` sử dụng các step trong `vars/` theo luồng chính sau:

1. `docvaultConfig()` khởi tạo cấu hình.
2. `preventLoop()` chặn build lặp từ commit GitOps có `[skip ci]`.
3. `detectChanges(cfg)` phân tích diff để quyết định bước nào cần chạy.
4. `systemCheck()` kiểm tra agent có Docker.
5. `installStep(cfg)` cài dependency và generate Prisma client.
6. `secretScan()` quét secret sớm trước khi build.
7. `unitTests(cfg)` chạy test workspace.
8. Các security gate chạy trước build image: `dependencyCheck(cfg)`, `trivyFsScan(cfg)`, `sonarSast(cfg)`, `policyAsCode(cfg)`, `iacCheckov(cfg)`, `terraformValidate(cfg)`.
9. `buildAndScan(cfg)` build Docker image cho service bị ảnh hưởng và scan image bằng Trivy.
10. `pushAndGitOps(cfg, builtServicesCsv)` push image, resolve digest, cập nhật GitOps branch và Helm values.
11. `argocdHealthCheck(cfg)`, `postDeploySmokeTest(cfg)`, `dastZap(cfg)` xác minh sau deploy.
12. `postCleanup()` archive report và dọn workspace.

`Jenkinsfile.storage` dùng luồng riêng cho hạ tầng lưu trữ tài liệu: `docvaultConfig()` rồi `documentStorageGitOps(cfg)`.

## Vai trò từng file

| File | Step | Vai trò |
| --- | --- | --- |
| `docvaultConfig.groovy` | `docvaultConfig()` | Tạo map cấu hình chuẩn cho pipeline. Chứa default cho registry, image toolchain, danh sách service, GitOps branch, Argo CD app, SonarQube, Terraform và các tuỳ chọn signing/security. |
| `detectChanges.groovy` | `detectChanges(cfg)` | Xác định file thay đổi dựa trên diff Git. Trả về các cờ như `runAppCi`, `runSecurityCi`, `runIacCi`, `runImageBuild`, `docsOnly`, `infraChanged` để Jenkinsfile skip hoặc chạy stage phù hợp. |
| `preventLoop.groovy` | `preventLoop()` | Đọc commit message cuối cùng. Nếu có `[skip ci]` thì abort build để tránh vòng lặp do pipeline tự commit lên GitOps branch. |
| `systemCheck.groovy` | `systemCheck()` | Kiểm tra môi trường Jenkins agent tối thiểu bằng `docker --version`. |
| `installStep.groovy` | `installStep(cfg)` | Chạy container Node, bật Corepack, cài `pnpm install --frozen-lockfile`, dùng Docker volume cache cho pnpm/Turbo, và chạy `pnpm turbo run prisma:generate --continue`. |
| `unitTests.groovy` | `unitTests(cfg)` | Chạy `pnpm turbo run test` trong container Node với cache volume và network host. |
| `secretScan.groovy` | `secretScan()` | Chạy TruffleHog để phát hiện secret bị commit. Tạo `.trufflehog-exclude`, xuất report vào `secret-scan-report/`, archive artifact và fail nếu phát hiện secret. |
| `dependencyCheck.groovy` | `dependencyCheck(cfg)` | Chạy OWASP Dependency-Check để SCA dependency. Hỗ trợ NVD API key, cache database qua directory hoặc Docker volume, xuất HTML/JSON/log và fail với CVSS >= 7. |
| `trivyFsScan.groovy` | `trivyFsScan(cfg)` | Tạo snapshot sạch bằng `git archive`, chạy Trivy filesystem scan cho vuln/secret/misconfig, xuất JSON vào `trivy-fs-report/`, và fail với HIGH/CRITICAL. |
| `sonarSast.groovy` | `sonarSast(cfg)` | Chạy SonarQube scanner trong container. Tự chọn Sonar host reachable, dùng Jenkins `withSonarQubeEnv`, và có thể poll Quality Gate nếu bật `enforceQualityGate`. |
| `iacCheckov.groovy` | `iacCheckov(cfg)` | Chạy Checkov cho Terraform, Kubernetes và Helm ở các thư mục IaC. Hỗ trợ skip check/skip path/extra args và ghi `checkov-report/checkov-report.txt`. |
| `terraformValidate.groovy` | `terraformValidate(cfg)` | Chạy Terraform `fmt -check -recursive`, `init -backend=false`, và `validate` cho `cfg.terraformDir`. Bỏ qua nếu thư mục Terraform không tồn tại. |
| `policyAsCode.groovy` | `policyAsCode(cfg)` | Render Helm values thành manifest Kubernetes, chạy Kyverno CLI với policy trong `policies/kyverno`, archive report và manifest đã render. |
| `buildAndScan.groovy` | `buildAndScan(cfg)` | Chọn service/web cần build theo changed files, build Docker image theo batch, dùng cache từ `latest`, scan từng image bằng Trivy image scan, set `env.INFRA_CHANGED`, và trả về CSV danh sách image đã build. |
| `pushAndGitOps.groovy` | `pushAndGitOps(cfg, builtServicesCsv)` | Push image đã build lên registry, optional push `latest`, resolve image digest, optional ký/verify bằng cosign, cập nhật Helm values trên GitOps branch, sync `infra/k8s` khi có thay đổi, commit `[skip ci]`, và retry push khi cần. |
| `argocdHealthCheck.groovy` | `argocdHealthCheck(cfg)` | Dùng `kubectl` để đợi các Argo CD Application trong `cfg.argocdApps` đạt `Synced/Healthy`. Có thể dùng kubeconfig từ Jenkins credential. |
| `postDeploySmokeTest.groovy` | `postDeploySmokeTest(cfg)` | Gọi `DEPLOY_TARGET_URL` và `/api/health` với retry để xác minh web/API sau deploy. Skip nếu chưa cấu hình URL. |
| `dastZap.groovy` | `dastZap(cfg)` | Chạy OWASP ZAP baseline scan với `cfg.zapTarget`, tạo HTML/JSON report trong `zap-report/`, đánh dấu stage unstable cho lỗi scan mềm, nhưng fail nếu có High/Critical finding hoặc không tạo được report. |
| `documentStorageGitOps.groovy` | `documentStorageGitOps(cfg)` | Luồng riêng cho storage: chạy Terraform plan/apply cho S3/KMS/IAM của document storage, có approval tuỳ chọn, đọc Terraform outputs, cập nhật `document-service.yaml` trên GitOps branch bằng `yq`, lint/template Helm rồi commit/push. |
| `postCleanup.groovy` | `postCleanup()` | Archive các report bảo mật và DAST, sau đó dọn workspace bằng container Alpine và `cleanWs`. |

## Artifact và report

Các step trong `vars/` tạo và archive các thư mục report sau:

- `dependency-check-report/`: report OWASP Dependency-Check.
- `checkov-report/`: report Checkov IaC.
- `trivy-fs-report/`: report Trivy filesystem scan.
- `zap-report/`: report OWASP ZAP DAST.
- `policy-report/`: report Kyverno.
- `policy-rendered/`: manifest Helm đã render để kiểm tra policy.
- `secret-scan-report/`: report TruffleHog.

## Quy ước khi thêm step mới

- Đặt file dưới dạng `vars/<tenStep>.groovy`.
- Cung cấp `def call(...)` làm entrypoint.
- Nhận `cfg` nếu step cần cấu hình chung từ `docvaultConfig()`.
- Không hardcode secret; dùng Jenkins credentials.
- Ghi report vào thư mục riêng và thêm archive trong `postCleanup.groovy` nếu report cần lưu lại.
- Giữ step có một trách nhiệm rõ ràng để Jenkinsfile chỉ còn điều phối thứ tự chạy.
