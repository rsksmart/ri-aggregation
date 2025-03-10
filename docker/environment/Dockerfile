FROM debian:bullseye

WORKDIR /usr/src/zksync

# Install required dependencies
RUN apt-get update; apt-get install -y make bash git gnupg openssl libssl-dev gcc g++ curl libpq-dev pkg-config software-properties-common jq

#install docker engine
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add -
RUN add-apt-repository "deb https://download.docker.com/linux/debian $(lsb_release -cs) stable"
RUN apt update; apt install -y docker-ce-cli

# Install node and yarn
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g yarn
RUN npm install -g ts-node

# Install required node packages
RUN yarn global add aglio
RUN yarn global add dredd

# Install Rust and required cargo packages
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
RUN rustup install 1.69.0
RUN rustup override set 1.69.0
RUN cargo install diesel_cli  --version=1.4.0 --no-default-features --features postgres
RUN cargo install --version=0.5.6 sqlx-cli
RUN cargo install wasm-pack --git https://github.com/d3lm/wasm-pack --rev 713868b204f151acd1989c3f29ff9d3bc944c306

# Install `solc`
RUN curl -LO https://github.com/ethereum/solidity/releases/download/v0.5.16/solc-static-linux
RUN chmod +x solc-static-linux
RUN mv solc-static-linux /usr/local/bin/solc
RUN apt-get install -y axel postgresql

# Install tools used to measure code coverage
RUN cargo install grcov
RUN rustup component add llvm-tools-preview

# Setup the environment
ENV ZKSYNC_HOME=/usr/src/zksync
ENV PATH="${ZKSYNC_HOME}/bin:${PATH}"
ENV CI=0
RUN cargo install sccache --locked
ENV RUSTC_WRAPPER=/usr/local/cargo/bin/sccache
