# Build from the repository root (see compose.yaml): the build reads packages/contracts/openapi.yaml.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY packages/contracts/openapi.yaml packages/contracts/openapi.yaml
COPY services/tenant-api/.mvn services/tenant-api/.mvn
COPY services/tenant-api/mvnw services/tenant-api/pom.xml services/tenant-api/
WORKDIR /src/services/tenant-api
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY services/tenant-api/src src
# Tests run in CI with Testcontainers; the image only packages the jar.
RUN ./mvnw -B -q package -DskipTests

FROM eclipse-temurin:21-jre
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /src/services/tenant-api/target/tenant-api-*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
