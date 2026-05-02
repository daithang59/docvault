# Hướng dẫn khởi động lại môi trường local DevSecOps

Tài liệu này dùng để **khởi động lại Jenkins + SonarQube trên Docker** sau khi tắt máy và mở lại, để tiếp tục làm việc với pipeline DocVault.

---

## 1. Thành phần đang dùng

Môi trường local hiện tại gồm các container chính:

- `jenkins-blueocean`: Jenkins controller
- `jenkins-docker`: Docker-in-Docker cho Jenkins build/push image
- `sonarqube`: SonarQube server

Các volumes quan trọng:

- `jenkins-data`: giữ dữ liệu Jenkins
- `jenkins-docker-certs`: giữ cert cho Jenkins <-> Docker dind
- `sonarqube_data`: dữ liệu SonarQube
- `sonarqube_extensions`: plugins/extensions SonarQube
- `sonarqube_logs`: logs SonarQube

Network dùng chung:

- `jenkins`

---

## 2. Kiểm tra Docker đã chạy chưa

Mỗi lần mở máy, trước tiên:

1. Mở **Docker Desktop**
2. Chờ Docker engine chạy ổn định
3. Mở **PowerShell** và kiểm tra:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

Nếu Docker chưa chạy ổn, **không chạy các lệnh Jenkins/SonarQube**.

---

## 3. Cách khởi động lại với setup hiện tại

### 3.1. Khởi động SonarQube

```powershell
docker start sonarqube
```

### 3.2. Khởi động Jenkins Docker daemon

> Lưu ý: nếu `jenkins-docker` trước đó được tạo với `--rm`, sau khi reboot có thể container này không còn tồn tại. Khi đó phải chạy lại bằng `docker run`.

Thử trước:

```powershell
docker start jenkins-docker
```

Nếu báo container không tồn tại, chạy lại:

```powershell
docker run --name jenkins-docker --rm --detach --privileged --network jenkins --network-alias docker --env DOCKER_TLS_CERTDIR=/certs --volume jenkins-docker-certs:/certs/client --volume jenkins-data:/var/jenkins_home --publish 2376:2376 docker:dind --storage-driver overlay2
```

### 3.3. Khởi động Jenkins controller

```powershell
docker start jenkins-blueocean
```

### 3.4. Kiểm tra lại trạng thái

```powershell
docker ps
```

Kết quả mong đợi là thấy đủ:

- `sonarqube`
- `jenkins-docker`
- `jenkins-blueocean`

---

## 4. Kiểm tra nhanh sau khi khởi động

### 4.1. Kiểm tra logs SonarQube

```powershell
docker logs --tail 50 sonarqube
```

### 4.2. Kiểm tra logs Jenkins

```powershell
docker logs --tail 50 jenkins-blueocean
```

### 4.3. Kiểm tra Docker trong Jenkins còn hoạt động không

```powershell
docker exec -it jenkins-blueocean sh -c "env | grep DOCKER && echo '---' && ls -la /certs/client && echo '---' && docker version"
```

Kết quả đúng nên có:

- `DOCKER_HOST=tcp://docker:2376`
- `DOCKER_CERT_PATH=/certs/client`
- `DOCKER_TLS_VERIFY=1`
- `docker version` chạy được

---

## 5. Truy cập UI sau khi khởi động lại

### Jenkins

Mở trình duyệt:

```text
http://localhost:8080
```

### SonarQube

Mở trình duyệt:

```text
http://localhost:9000
```

---

## 6. Quy trình làm việc mỗi lần mở máy

Làm theo đúng thứ tự sau:

```powershell
docker start sonarqube
docker start jenkins-docker
docker start jenkins-blueocean
docker ps
```

Nếu `jenkins-docker` không tồn tại thì thay dòng `docker start jenkins-docker` bằng lệnh `docker run` ở phần 3.2.

Sau đó kiểm tra nhanh:

```powershell
docker logs --tail 20 sonarqube
docker logs --tail 20 jenkins-blueocean
```

Rồi vào Jenkins chạy lại pipeline.

---

## 7. Cách làm tốt hơn để khỏi phải chạy lại thủ công

Setup hiện tại có thể hoạt động, nhưng để tiện hơn về sau, nên đổi restart policy để container tự khởi động lại sau khi mở máy.

### 7.1. Cho SonarQube và Jenkins controller tự khởi động lại

```powershell
docker update --restart unless-stopped sonarqube
docker update --restart unless-stopped jenkins-blueocean
```

### 7.2. Dựng lại `jenkins-docker` theo kiểu bền hơn

Vì `--rm` không phù hợp nếu muốn tự restart sau reboot, nên có thể recreate lại như sau:

```powershell
docker rm -f jenkins-docker

docker run --name jenkins-docker --detach --restart unless-stopped --privileged --network jenkins --network-alias docker --env DOCKER_TLS_CERTDIR=/certs --volume jenkins-docker-certs:/certs/client --volume jenkins-data:/var/jenkins_home --publish 2376:2376 docker:dind --storage-driver overlay2
```

Sau khi đổi theo cách này, về sau bạn chỉ cần:

```powershell
docker start sonarqube jenkins-docker jenkins-blueocean
```

Hoặc thậm chí chỉ cần mở Docker Desktop, nếu restart policy đã hoạt động đúng.

---

## 8. Nếu có lỗi thường gặp

### Lỗi: container name already in use

Ví dụ:

```text
Conflict. The container name "/jenkins-docker" is already in use
```

Cách xử lý:

```powershell
docker ps -a
docker rm -f jenkins-docker
```

rồi chạy lại container.

### Lỗi: Docker trong Jenkins không chạy được

Chạy:

```powershell
docker exec -it jenkins-blueocean sh -c "env | grep DOCKER && echo '---' && ls -la /certs/client && echo '---' && docker version"
```

Nếu `DOCKER_CERT_PATH` sai hoặc `/certs/client` rỗng, cần recreate lại `jenkins-docker` và `jenkins-blueocean`.

### Lỗi: SonarQube không lên UI

Kiểm tra:

```powershell
docker logs --tail 100 sonarqube
```

và chờ thêm một lúc vì SonarQube có thể khởi động chậm hơn Jenkins.

---

## 9. Checklist mở máy đi làm

- [ ] Mở Docker Desktop
- [ ] `docker ps -a` kiểm tra container
- [ ] `docker start sonarqube`
- [ ] `docker start jenkins-docker` hoặc `docker run ...` nếu container không còn
- [ ] `docker start jenkins-blueocean`
- [ ] `docker ps` xác nhận đủ 3 container
- [ ] Vào `http://localhost:8080`
- [ ] Vào `http://localhost:9000`
- [ ] Kiểm tra Jenkins pipeline / SonarQube UI

---

## 10. Lệnh nhanh gợi ý để lưu lại

### Bản dùng với setup hiện tại

```powershell
docker start sonarqube
docker start jenkins-docker
docker start jenkins-blueocean
docker ps
```

### Nếu `jenkins-docker` bị mất

```powershell
docker run --name jenkins-docker --rm --detach --privileged --network jenkins --network-alias docker --env DOCKER_TLS_CERTDIR=/certs --volume jenkins-docker-certs:/certs/client --volume jenkins-data:/var/jenkins_home --publish 2376:2376 docker:dind --storage-driver overlay2
```

---

## 11. Khuyến nghị cuối cùng

Để đỡ quên lệnh về sau, bạn nên:

- giữ file này trong repo `docs/`
- hoặc tạo thêm script PowerShell như `start-devsecops-local.ps1`
- hoặc dùng `docker compose` cho cả Jenkins + SonarQube + dind nếu sau này muốn quản lý gọn hơn

