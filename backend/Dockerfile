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

# JVM tuning cho container:
# -XX:MaxRAMPercentage=75  => Chỉ dùng 75% RAM của container (an toàn cho t3.medium 4GB)
# -XX:+UseContainerSupport => Nhận diện giới hạn RAM từ Docker cgroup
# -Djava.security.egd=... => Tăng tốc khởi động bằng cách dùng /dev/urandom (không block)
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
