# ============================================================
# Stage 1 — Build: Maven + JDK 17
# ============================================================
FROM eclipse-temurin:17-jdk-jammy AS builder

WORKDIR /build

# Copy Maven wrapper và pom.xml trước để tận dụng Docker layer cache
# (chỉ rebuild khi pom.xml thay đổi, không phải khi code thay đổi)
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -q

# Copy source và build
COPY src/ src/
RUN ./mvnw clean package -DskipTests -q

# ============================================================
# Stage 2 — Runtime: chỉ JRE 17 (nhẹ hơn ~300MB so với JDK)
# ============================================================
FROM eclipse-temurin:17-jre-jammy AS runtime

# Security: chạy dưới non-root user
RUN groupadd --system app && useradd --system --gid app app

WORKDIR /app

# Copy artifact từ builder stage
COPY --from=builder /build/target/deutschflow-backend-*.jar app.jar

# Copy wordlists (cần khi chạy vocab import)
COPY src/main/resources/wordlists/ /app/wordlists/

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
