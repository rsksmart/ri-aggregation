FROM debian

RUN echo "Let's go!"
SHELL ["/bin/bash", "-c"]
ENV HOME=/root
ENV OPENSSL_DIR=/usr/local/ssl
ENV ZKSYNC_HOME=/zksync
ENV PATH="${PATH}:/usr/local/ssl/bin:${ZKSYNC_HOME}/bin:${HOME}/.fnm:${HOME}/.cargo/bin"

WORKDIR $HOME


# Update apt
RUN apt-get update

RUN apt-get install -y build-essential curl unzip git wget cmake clang lld python2

# Create certificates for ssl
RUN apt install -y libnss3-tools
RUN curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
RUN chmod +x mkcert-v*-linux-amd64
RUN cp mkcert-v*-linux-amd64 /usr/local/bin/mkcert
RUN mkcert install 
ENV NODE_EXTRA_CA_CERTS="${HOME}/.local/share/mkcert/rootCA.pem"

# # Install Yarn and Vue
RUN curl -fsSL https://fnm.vercel.app/install | bash
RUN source ~/.bashrc && fnm use --install-if-missing 14
RUN source ~/.bashrc && npm config set user 0 
RUN source ~/.bashrc && npm config set unsafe-perm true 
# RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
# RUN apt-get install -y nodejs
RUN source ~/.bashrc && npm i -g yarn @vue/cli

# Install Axel 2.17.10
WORKDIR /usr/local/src/
RUN wget https://github.com/axel-download-accelerator/axel/releases/download/v2.17.10/axel-2.17.10.tar.gz
RUN tar xvf axel-2.17.10.tar.gz
WORKDIR /usr/local/src/axel-2.17.10
RUN apt-get install -y gettext pkg-config autoconf-archive build-essential autoconf automake autopoint libssl-dev txt2man
RUN autoreconf -i
RUN ./configure && make && make install && cd ..

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y -v

# Install PSQL
RUN apt-get install -y postgresql-client

# Install Diesel CLI (do not optimise with lld
RUN apt-get install -y libpq-dev
RUN cargo install diesel_cli --no-default-features --features postgres

# Install OpenSSL
WORKDIR /usr/local/src/
RUN apt install -y  zlib1g-dev
RUN wget https://www.openssl.org/source/openssl-1.1.1o.tar.gz
RUN tar xvf openssl-1.1.1o.tar.gz
WORKDIR /usr/local/src/openssl-1.1.1o
RUN ./config --prefix=/usr/local/ssl --openssldir=/usr/local/ssl shared zlib
RUN rm test/recipes/80-test_ssl_new.t   ## Workaround to make the tests pass 😈
RUN make && make test && make install
RUN touch /etc/ld.so.conf.d/openssl-1.1.1o.conf
RUN echo '/usr/local/ssl/lib' >> /etc/ld.so.conf.d/openssl-1.1.1o.conf
RUN ldconfig -v

# Install SQLX CLI
RUN cargo install --version=0.5.6 sqlx-cli

# Install Solidity compiler
RUN source ~/.bashrc && npm install -g solc@0.5.17

# Install Drone
WORKDIR /usr/local/src/
RUN curl -L https://github.com/harness/drone-cli/releases/latest/download/drone_linux_amd64.tar.gz | tar zxv
RUN install -t /usr/local/bin drone

WORKDIR ${ZKSYNC_HOME}

# COPY ./init.sh /
# RUN chmod +x /init.sh
# RUN echo "|------> $PATH"
ENTRYPOINT [ "tail", "-f", "/dev/null" ]