# DocVault DevSecOps Pipeline Status Assessment

Updated: 2026-04-29  
Branch assessed: `devsecops-pipeline`

## Executive Summary

Repo hiện đang ở **cuối Phase 3 - Jenkins CI cơ bản** và chạm một phần **Phase 5 - GitOps/CD** ở mức file cấu hình. Mức sẵn sàng tổng thể cho DevSecOps MVP: **Medium, khoảng 60-65%**.

Điểm mạnh lớn nhất:

- Application baseline khá tốt: `pnpm build` pass, `pnpm test` pass, có `scripts/e2e-check.mjs` cover luồng Editor -> Approver -> Viewer -> Compliance Officer.
- Pipeline code đã có nền rõ: `Jenkinsfile`, `vars/*.groovy`, Docker build, Trivy, SonarQube, Checkov, Dependency-Check, ZAP, push image và GitOps update.
- GitOps đi đúng hướng: Jenkins update Helm values trên branch GitOps, không deploy trực tiếp bằng `kubectl`.

Blocker lớn nhất:

- Jenkins, credentials, SonarQube, Docker Hub namespace, GitOps branch và ArgoCD chưa được cấu hình/chạy thật.
- `Jenkinsfile` vẫn dùng `@Library('docvault@testing')`, trong khi fix pipeline hiện nằm trên `devsecops-pipeline`.
- K8s/Helm còn hardcode môi trường dev và có nguy cơ probe sai: chart dùng `/api/health` cho mọi service, trong khi backend service expose `/health`; chỉ gateway có global prefix `/api`.

## Architecture Fit Review

| Component | Current fit | Assessment |
|---|---|---|
| Gateway | `services/gateway` proxy `metadata`, `documents`, `workflow`, `audit`, `notify`; có JWT, CORS, Swagger. | Đúng vai trò edge/API gateway. Cần đảm bảo Jenkins/K8s env URL khớp runtime. |
| Auth/IAM | Keycloak realm/seed nằm ở `infra/keycloak`; JWT strategy có ở services và `libs/auth`. | Đủ cho MVP, nhưng auth logic còn lặp ở nhiều service, shared lib chưa được dùng triệt để. |
| Metadata | `metadata-service` sở hữu Prisma schema, ACL, workflow history, policy authorize download. | Fit tốt. Đây là source-of-truth đúng với kế hoạch. |
| Document | `document-service` upload MinIO/S3, checksum, grant token, presign/stream, watermark path. | Fit tốt. Không ôm ACL chính, gọi metadata để authorize. |
| Workflow | `workflow-service` enforce `DRAFT -> PENDING -> PUBLISHED/REJECT`, có unit test. | Fit tốt cho MVP. |
| Audit | `audit-service` dùng Mongo/Mongoose, query audit, hash chain. | Đủ demo compliance; cần cập nhật tài liệu cũ nếu còn nói Postgres là audit store. |
| Notification | `notification-service` là in-memory/dev sink. | Chấp nhận được MVP, chưa phải production-ready. |

## DevSecOps Readiness Review

| Layer | Current state | Readiness |
|---|---|---|
| Local baseline | `infra/docker-compose.dev.yml`, `.env.example`, `scripts/start-sequential.mjs`, `scripts/e2e-check.mjs`. | Khá tốt; E2E chưa được chạy lại trong lần đánh giá này. |
| Build/Test | `pnpm build` pass 9/9 packages; `pnpm test` pass các package có test. | Sẵn sàng đưa vào CI. |
| Containerization | Có `Dockerfile.backend`, `apps/web/Dockerfile`, healthcheck image. | Nền tốt; cần verify build/push tất cả image trong Jenkins thật. |
| IaC/K8s | Có Helm chart generic, values per service, infra deps, ArgoCD app manifests. Không thấy Terraform. | Có nền deploy, nhưng chưa đạt Phase 2 đầy đủ theo kế hoạch. |
| Jenkins CI | Có `Jenkinsfile` và `vars/*.groovy`. | Code pipeline khá đầy đủ, nhưng Jenkins chưa deploy/cấu hình nên chưa operational. |
| Security gates | Trivy image, Checkov fail pipeline; Sonar chạy scan; Dependency-Check đang `UNSTABLE`; ZAP luôn chạy cuối. | Có toolchain, nhưng gate policy chưa nhất quán. |
| GitOps/CD | `vars/pushAndGitOps.groovy` push image, update `infra/k8s/values/*.yaml`, commit `[skip ci]`. | Đúng hướng; còn cần tạo branch `gitops-testing`, đổi Docker namespace, chạy ArgoCD thật. |
| Observability | Có ArgoCD app cho kube-prometheus-stack; app log JSON có `traceId`/latency. | Mới ở mức nền. Chưa thấy Loki, dashboard app, ServiceMonitor/app metrics. |

## Gap Analysis

| Area | Expected | Current state in repo | Gap | Severity | Recommended action |
|---|---|---|---|---|---|
| Jenkins setup | Jenkins chạy được pipeline từ SCM. | Chỉ có `Jenkinsfile` và guide; user chưa deploy Jenkins. | Chưa operational. | High | Deploy Jenkins, cài plugins, credentials, agent label, tạo job branch `devsecops-pipeline`. |
| Shared library branch | Jenkins dùng đúng branch chứa fix. | `Jenkinsfile` dùng `@Library('docvault@testing')`. | Có thể lấy code pipeline cũ. | High | Đổi tạm sang `@Library('docvault@devsecops-pipeline')` trước khi merge. |
| Docker namespace | Push image vào namespace user sở hữu. | `vars/docvaultConfig.groovy` và values còn `duyimew`. | Có thể push fail hoặc deploy image sai owner. | High | Đổi `dockerOrg` và image repositories sang Docker Hub namespace của bạn. |
| K8s health probes | Probe đúng endpoint từng service. | Chart dùng `/api/health` cho mọi release. | Backend services không set global prefix `/api`. | High | Cho phép `healthPath` trong values; gateway/web dùng `/api/health`, backend dùng `/health`. |
| GitOps branch | Branch deploy state tồn tại. | Pipeline default `gitops-testing`, ArgoCD targetRevision cũng vậy. | Chưa xác nhận branch đã tạo. | High | Tạo/push `gitops-testing` trước khi chạy Push & GitOps. |
| Sonar quality gate | Fail pipeline khi quality gate fail. | `sonarSast.groovy` chỉ chạy scanner, chưa thấy `waitForQualityGate`. | Chưa là gate thật. | Medium | Thêm stage `Quality Gate` sau Sonar hoặc cấu hình fail condition rõ. |
| Trivy FS gate | Fail khi có HIGH/CRITICAL. | `trivyFsScan.groovy` thiếu `--exit-code 1`. | Có thể chỉ report, không chặn. | Medium | Thêm `--exit-code 1` hoặc policy severity rõ. |
| Dependency-Check gate | Fail hoặc policy rõ. | `--failOnCVSS 7` nhưng bọc `catchError(... UNSTABLE)`. | Không chặn pipeline. | Medium | Quyết định SCA là blocking hay non-blocking; MVP nên blocking sau khi baseline sạch. |
| ZAP | Chạy khi target có gateway thật. | `DAST - OWASP ZAP` luôn chạy cuối với hardcoded `zapTarget`. | Dễ fail khi chưa deploy cluster. | Medium | Tạm gate bằng parameter `RUN_ZAP` hoặc chỉ bật sau khi ArgoCD deploy xong. |
| Secrets | Secrets không hardcode trong Git. | `infra/k8s/infra-deps/app-secrets.yaml` chứa secret dev dạng plaintext. | Chấp nhận demo, không production. | Medium | Gắn nhãn dev-only; về sau dùng SealedSecrets/ExternalSecrets. |
| Terraform | Plan yêu cầu Terraform nền tảng. | Không thấy file `.tf`. | Thiếu Phase 2 theo kế hoạch. | Medium | Chưa cần nếu dùng local cluster; ghi rõ deferred. |
| Observability | Metrics, dashboard, logs tập trung. | Có kube-prometheus-stack app; chưa thấy app metrics/ServiceMonitor/Loki. | Chưa đủ demo runtime evidence. | Medium | Sau CI/CD, thêm app metrics hoặc dashboard tối thiểu; Loki để sau nếu thiếu thời gian. |
| E2E evidence | Demo flow chạy lại được. | Có `scripts/e2e-check.mjs`, nhưng chưa chạy trong đánh giá này. | Chưa có evidence mới. | Medium | Sau khi local stack/Jenkins sẵn, chạy `pnpm test:e2e` và lưu log/screenshot. |

## Top Priorities

1. **Sửa cấu hình branch và Docker namespace**: đổi `@Library` sang `devsecops-pipeline` khi test, đổi `dockerOrg`/image repositories khỏi `duyimew`.
2. **Tạo `gitops-testing` và chuẩn hóa Helm values**: tạo branch, sửa health probe path, kiểm tra values cho từng service.
3. **Deploy Jenkins local/VM bằng Docker**: cài plugin, credentials `dockerhub-credentials` và `github-credentials`, label agent, tạo job SCM.
4. **Chạy pipeline từng lớp**: `Install`, `Unit Tests`, `Trivy FS`, `Sonar`, `Checkov`, `Build & Scan Services`, sau đó mới `Push & GitOps`.
5. **Chỉ bật ArgoCD/ZAP sau khi CI ổn**: apply ArgoCD app manifests, verify sync, rồi mới bật DAST với target thật.

## Anti-Pattern Warnings

- Đừng dựng monitoring/ZAP trước khi Jenkins build-push-GitOps chạy ổn. ZAP đang phụ thuộc gateway deployed thật.
- Đừng merge/chạy Jenkins với `@Library('docvault@testing')` nếu branch `testing` chưa có các fix pipeline hiện tại.
- Đừng để `duyimew` làm Docker namespace nếu bạn không có quyền push Docker Hub namespace đó.
- Đừng coi security scan là gate hoàn chỉnh khi Sonar chưa có quality gate và Trivy FS/Dependency-Check chưa fail pipeline nhất quán.
- Đừng xem K8s manifests là sẵn sàng deploy khi health probe còn dùng một path chung cho các service khác nhau.

## Proposed Next Sprint

### Must-do

- Đổi Jenkins shared library branch khi test pipeline: `@Library('docvault@devsecops-pipeline')`.
- Đổi `dockerOrg` trong `vars/docvaultConfig.groovy` và image repository trong `infra/k8s/values/*.yaml`.
- Sửa Helm chart để mỗi service có `healthPath`.
- Tạo `gitops-testing` trên `origin`.
- Deploy Jenkins, tạo credentials, chạy job với `FORCE_BUILD_ALL=true`.

### Should-do

- Thêm Sonar quality gate stage.
- Thêm `--exit-code 1` cho Trivy FS nếu muốn chặn HIGH/CRITICAL.
- Thêm parameter `RUN_ZAP=false` mặc định cho lần CI đầu.
- Chạy `pnpm test:e2e` sau khi local full stack healthy và lưu evidence vào docs.

### Optional

- Thêm ServiceMonitor/app metrics tối thiểu.
- Thêm dashboard Grafana cơ bản cho gateway/service health.
- Chuẩn bị Loki/promtail nếu cần demo log tập trung.
- Tạo checklist rollback GitOps bằng commit revert trên `gitops-testing`.

## Verification Performed

Các lệnh đã chạy trong lần đánh giá này:

```bash
pnpm test
pnpm build
```

Kết quả:

- `pnpm test`: pass. Các test đáng chú ý gồm gateway health, metadata status service, workflow service transitions, audit hash chain.
- `pnpm build`: pass 9/9 packages, bao gồm `@docvault/throttler`, `gateway`, `metadata-service`, `document-service`, `workflow-service`, `audit-service`, `notification-service`, `web`.

Chưa chạy trong lần đánh giá này:

- `pnpm test:e2e`, vì cần full stack local đang chạy.
- Jenkins pipeline thật, vì Jenkins/credentials/agent chưa được cấu hình.
- ArgoCD sync thật, vì cluster/ArgoCD chưa được triển khai trong môi trường này.
