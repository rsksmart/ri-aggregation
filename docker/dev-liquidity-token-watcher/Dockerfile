# syntax=docker/dockerfile:experimental
FROM rust:latest as builder
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo install sccache --no-default-features 
WORKDIR /usr/src/rollup
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/root/.cache/sccache \
    RUSTC_WRAPPER=/usr/local/cargo/bin/sccache \
    cargo build --release

FROM debian:bullseye
EXPOSE 9975
ENV RUST_BACKTRACE "full"
ENV RUST_LOG info
COPY --from=builder /usr/src/rollup/target/release/dev-liquidity-token-watcher /bin/
COPY --from=builder /usr/src/rollup/etc/tokens /etc/tokens
ENTRYPOINT ["dev-liquidity-token-watcher"]
