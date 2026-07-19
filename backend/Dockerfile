# ============================================================
# Stage 1 — Build: Maven + JDK 17
# ============================================================
FROM eclipse-temurin:17-jdk-jammy AS builder

WORKDIR /build

# Copy Maven wrapper và pom.xml trước để tận dụng Docker layer cache
# (chỉ rebuild khi pom.xml thay đổi, không phải khi code thay đổi)
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod 755 mvnw
RUN ["./mvnw", "-B", "dependency:go-offline"]

# Copy source và build
COPY src/ src/
RUN ["./mvnw", "-B", "clean", "package", "-DskipTests"]

# Fail sớm nếu artifact không được tạo ra như mong đợi
RUN test -f /build/target/deutschflow-backend-*.jar

# ============================================================
# Stage 2 — Runtime: chỉ JRE 17 (nhẹ hơn ~300MB so với JDK)
# ============================================================
FROM eclipse-temurin:17-jre-jammy AS runtime

# ffmpeg + DejaVu font: required by the learning-video .mp4 render (Phase B) and its
# burned-in captions (drawtext).
#
# libreoffice-{writer,impress,calc}: headless Office → PDF conversion for the in-browser material
# preview (MaterialPreviewService). Converting in OUR container is what keeps a center's teaching
# material off third-party viewers (Office Web Viewer / Google Docs viewer would have to fetch the
# file to render it). fonts-liberation supplies the metric-compatible Arial/Times/Courier the average
# Word document asks for — without it, layout reflows and page counts drift.
#
# --no-install-recommends is load-bearing: the recommends pull in the whole LibreOffice suite plus a
# JRE and python-uno (~700MB more) for filters we never invoke.
#
# Installed as root before dropping to the app user.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg fonts-dejavu-core \
        libreoffice-writer libreoffice-impress libreoffice-calc fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Security: chạy dưới non-root user.
# --create-home: soffice touches $HOME even when handed an explicit -env:UserInstallation profile;
# without a writable home it dies with a bare non-zero exit and no diagnostic.
RUN groupadd --system app && useradd --system --gid app --create-home --home-dir /home/app app

WORKDIR /app

# Copy artifact từ builder stage
COPY --from=builder /build/target/deutschflow-backend-*.jar app.jar

# Copy wordlists (cần khi chạy vocab import)
COPY src/main/resources/wordlists/ /app/wordlists/

# Apple Root CA (StoreKit 2 JWS verification) — baked in so AppleJwsVerifier is enabled by default.
# See payment.apple.root-cert-dir in application.yml (defaults to /app/apple-certs).
COPY src/main/resources/apple-certs/ /app/apple-certs/

# Chown về non-root
RUN chown -R app:app /app
USER app

EXPOSE 8080

# JVM tuning cho container (20 CCU on t3.medium):
# -XX:MaxRAMPercentage=75  => Chỉ dùng 75% RAM container cho heap
# -XX:+UseContainerSupport => Nhận diện giới hạn RAM từ Docker cgroup
# -XX:+UseG1GC             => G1 collector — low-pause cho interactive workload
# -XX:MaxGCPauseMillis=200 => Target GC pause ≤ 200ms
# -XX:+UseStringDeduplication => Giảm heap cho chuỗi trùng lặp (vocab, prompts)
# -Djava.security.egd=...  => Tăng tốc khởi động bằng /dev/urandom
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+UseStringDeduplication -Djava.security.egd=file:/dev/./urandom $JAVA_OPTS -jar app.jar \"$@\""]
