FROM eclipse-temurin:11-jdk

RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*

COPY settings.xml /root/.m2/settings.xml

RUN mvn dependency:resolve -Dartifact=org.spigotmc:spigot-api:1.16.5-R0.1-SNAPSHOT || true

WORKDIR /app

ENTRYPOINT ["mvn", "clean", "package"]
