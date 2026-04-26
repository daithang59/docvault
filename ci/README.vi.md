# Huong Dan Thu Muc CI (Tieng Viet)

Tai lieu nay mo ta cau truc thu muc `ci/`, chuc nang cua tung file, cach cac module tuong tac voi nhau, va phan giai thich chi tiet cho `buildAndScan.groovy`.

## 1) Thu muc `ci/` gom nhung gi

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

Luu y: File dieu phoi chinh van la `Jenkinsfile` o root cua repository. `Jenkinsfile` se load cac module trong `ci/jenkins/`.

## 2) Mo hinh thuc thi

`Jenkinsfile` duoc giu nhe, logic chi tiet nam trong `ci/jenkins/steps`.

Luong chay tong quan:

1. Checkout source.
2. Load config (`config.groovy`) va cac step module (`load(...)`).
3. Chay cac buoc bao ve (`Prevent Loop`, `System Check`, `Install`).
4. Chay nhom kiem tra truoc build theo parallel:
   - Dependency check (SCA)
   - Trivy FS
   - Unit tests
   - SonarQube SAST
   - Checkov IaC
5. Build va scan image cho cac service bi anh huong (`buildAndScan.groovy`).
6. Push image va cap nhat GitOps (`pushAndGitOps.groovy`) neu co image duoc build.
7. Chay DAST (OWASP ZAP).
8. Luon archive report va don workspace.

## 3) Chuc nang tung file

### `ci/jenkins/config.groovy`

Noi tap trung cac cau hinh CI:

- Docker image su dung (Node, Trivy, Sonar scanner, Checkov)
- Danh sach service
- Duong dan Dockerfile va gia tri Helm
- GitOps repo + branch dich (`GITOPS_BRANCH` co the override)
- URL muc tieu cho ZAP

File nay tra ve map `cfg` de cac step su dung.

### `ci/jenkins/steps/preventLoop.groovy`

Dung pipeline neu commit moi nhat co `[skip ci]` de tranh vong lap tu commit GitOps.

### `ci/jenkins/steps/systemCheck.groovy`

Kiem tra nhanh agent (co Docker khong) de fail som neu moi truong loi.

### `ci/jenkins/steps/install.groovy`

Cai dependency va chay Prisma generate trong container Node.

### `ci/jenkins/steps/dependencyCheck.groovy`

Chay OWASP Dependency-Check va fail khi CVSS >= 7.
Sinh report vao `dependency-check-report/` (HTML + JSON).

### `ci/jenkins/steps/trivyFsScan.groovy`

Trivy scan filesystem workspace va fail neu co HIGH/CRITICAL.

### `ci/jenkins/steps/unitTests.groovy`

Chay test (`pnpm turbo run test`) trong container Node.

### `ci/jenkins/steps/sonarSast.groovy`

Chay Sonar scanner trong Docker, dung `withSonarQubeEnv` cua Jenkins.

### `ci/jenkins/steps/iacCheckov.groovy`

Chay Checkov cho Dockerfile + Helm:
- In ket qua ra console
- Luu ket qua vao `checkov-report/checkov-report.txt`
- Fail build neu Checkov tra ve exit code khac 0

### `ci/jenkins/steps/buildAndScan.groovy`

Xac dinh service nao can build dua tren thay doi Git, build image cho service bi anh huong, sau do Trivy scan image theo che do fail-fast.
Ket qua tra ve la CSV danh sach service da build.

### `ci/jenkins/steps/pushAndGitOps.groovy`

- Dang nhap Docker Hub bang `DOCKER_CONFIG` tam thoi
- Push tag `v<BUILD_NUMBER>` va `latest`
- Cap nhat file values Helm tren branch GitOps
- Dung `GIT_ASKPASS` de auth HTTPS an toan hon
- Retry push voi fetch/rebase de giam xung dot race condition

### `ci/jenkins/steps/dastZap.groovy`

Chay OWASP ZAP baseline va tao report HTML + JSON trong `zap-report/`.

### `ci/jenkins/steps/postCleanup.groovy`

Luon archive artifact va don workspace.

## 4) Cac module tuong tac voi nhau nhu the nao

### Truyen config

Tat ca step duoc `Jenkinsfile` load va goi voi `cfg` (neu can).

- `cfg` duoc tao 1 lan tu `config.groovy`
- Gia tri trong `cfg` duoc dung xuyen suot (image, service, path, URL)

### Luong du lieu giua cac stage

`buildAndScan.groovy` tra ve `builtServicesCsv`; `Jenkinsfile` gan vao `env.BUILT_SERVICES`.

`pushAndGitOps.groovy` doc `env.BUILT_SERVICES` de quyet dinh push.
Neu rong thi stage push bi skip.

### Luong report

- `dependencyCheck.groovy` -> `dependency-check-report/*`
- `iacCheckov.groovy` -> `checkov-report/*`
- `dastZap.groovy` -> `zap-report/*`
- `postCleanup.groovy` archive tat ca cac report tren

## 5) Giai thich chi tiet `buildAndScan.groovy`

File nay dai hon cac file khac vi no gom 3 nhiem vu:

1. Phat hien thay doi (change detection)
2. Chon service can build (selective build)
3. Kiem tra bao mat image ngay trong luc build (fail-fast)

### Dau vao

- `cfg` tu `config.groovy`
- Bien moi truong/param:
  - `FORCE_BUILD_ALL` (param/env)
  - Metadata PR (`CHANGE_TARGET`)
  - Bien lich su Jenkins (`GIT_PREVIOUS_SUCCESSFUL_COMMIT`, `GIT_PREVIOUS_COMMIT`)

### Dau ra

- Tra ve chuoi CSV service da build (vi du: `gateway,metadata-service,web`)

### Hanh vi theo tung buoc

1. Tao tag image muc tieu (`v${BUILD_NUMBER}`).
2. Kiem tra co bat buoc build tat ca khong (`shouldForceBuildAll()`).
3. Tim diff range an toan (`resolveDiffRange()`):
   - Uu tien voi PR: merge-base voi branch dich
   - Fallback: previous successful/previous commit
   - Fallback cuoi: `HEAD~1..HEAD`
   - Neu khong xac dinh duoc: build tat ca de dam bao an toan
4. Lay danh sach file thay doi (`getChangedFiles(...)`).
5. Lap qua tung backend service trong `cfg.services`:
   - Kiem tra bi anh huong bang `isServiceImpacted(...)`
   - Neu bi anh huong thi build image
   - Trivy scan image va fail neu HIGH/CRITICAL
6. Kiem tra web app bang `isWebImpacted(...)`.
7. Neu web bi anh huong thi build + scan image web.
8. Tra ve danh sach service da build dang CSV.

### Giai thich cac ham phu

#### `shouldForceBuildAll()`

Doc ca `env.FORCE_BUILD_ALL` va `params.FORCE_BUILD_ALL`.

#### `resolveDiffRange()`

Muc tieu la tranh bo sot thay doi:

- Neu la PR: fetch branch dich va tinh merge-base.
- Neu build branch binh thuong: dung commit thanh cong gan nhat.
- Neu branch moi/chua co lich su: fallback `HEAD~1..HEAD`.
- Neu van khong co moc an toan: tra `null` -> caller chuyen sang build tat ca.

#### `getChangedFiles(diffRange)`

Chay `git diff --name-only`, chuan hoa output thanh list.

#### `isServiceImpacted(service, changedFiles)`

Service duoc xem la bi anh huong khi:

- Co file trong `services/<service>/`
- Hoac co file thuoc nhom anh huong toan backend (`libs/`, lockfile, Dockerfile backend...)

#### `isWebImpacted(cfg, changedFiles)`

Web duoc xem la bi anh huong khi:

- Co file trong `apps/web/`
- Hoac co file thuoc nhom anh huong toan web (Dockerfile web, lockfile, workspace config...)

#### `isGlobalBackendImpact(path)` / `isGlobalWebImpact(path, cfg)`

Tap trung rule de mo rong de dang, tranh lap logic.

### Vi sao an toan hon cach `HEAD~1` don gian

Chi dung `HEAD~1` de bo sot thay doi trong nhieu tinh huong:

- Build dau tien cua branch
- Lich su bi rebase/squash
- Build PR can boi canh merge-base
- Pipeline truoc do fail/chua co previous successful commit

Logic hien tai uu tien do chinh xac bao mat: neu mo ho thi build tat ca.

### Luu y hieu nang

- Selective build giup tiet kiem thoi gian.
- Full rebuild fallback chu dong cham hon de an toan.
- Trivy image scan chay theo tung image, thoi gian tang theo so image duoc build.

### Diem mo rong thuong gap

- Them bot service trong `cfg.services`
- Mo rong danh sach global-impact file
- Dieu chinh severity/flag cua Trivy
- Them output JSON tong hop danh sach service da build

## 6) Quy tac khi them step moi

Quy trinh de xuyen suot voi kien truc hien tai:

1. Tao `ci/jenkins/steps/<newStep>.groovy` voi `def call(...)` va `return this`.
2. Load module trong stage `Checkout & Initialize Modules` cua `Jenkinsfile`.
3. Goi module o stage phu hop.
4. Neu tao report, nho them archive trong `postCleanup.groovy`.

## 7) Troubleshooting nhanh

- Tuong la co thay doi nhung khong build: xem log `resolveDiffRange()` va danh sach changed files.
- Push bi skip: `BUILT_SERVICES` dang rong.
- Loi push GitOps: kiem tra branch dich co ton tai va credential ID trong Jenkins.
- Loi Sonar: kiem tra ten Sonar installation trong Jenkins va token binding.

