FROM eclipse-temurin:8-jdk

RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*

COPY settings.xml /root/.m2/settings.xml

RUN mvn dependency:resolve -Dartifact=org.bukkit:bukkit:1.12.2-R0.1-SNAPSHOT || true

WORKDIR /app

ENTRYPOINT ["mvn", "clean", "package"]
