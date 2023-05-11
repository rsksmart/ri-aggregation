docker rmi -f rskj:latest
docker builder prune -f -a
docker build . -f Dockerfile_EIP2028 -t rskj:latest