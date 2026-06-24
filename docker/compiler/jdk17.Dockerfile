FROM eclipse-temurin:17-jdk

RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*

COPY settings.xml /root/.m2/settings.xml

RUN mvn dependency:resolve -Dartifact=io.papermc.paper:paper-api:1.20.1-R0.1-SNAPSHOT || true

WORKDIR /app

ENTRYPOINT ["mvn", "clean", "package"]
