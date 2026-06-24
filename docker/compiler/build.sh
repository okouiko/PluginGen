#!/bin/bash
# Build all compiler Docker images
set -e

JDK_VERSIONS=("8" "11" "17" "21")

for jdk in "${JDK_VERSIONS[@]}"; do
    echo "Building plugin-compiler:jdk${jdk}..."
    docker build \
        -f jdk${jdk}.Dockerfile \
        -t plugin-compiler:jdk${jdk} \
        .
    echo "Done building plugin-compiler:jdk${jdk}"
done

echo "All compiler images built successfully!"
