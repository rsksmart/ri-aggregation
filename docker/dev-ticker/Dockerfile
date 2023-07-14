# syntax=docker/dockerfile:experimental
FROM rust:1.69 as builder
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo install sccache --no-default-features
WORKDIR /usr/src/rollup
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/root/.cache/sccache \
    RUSTC_WRAPPER=/usr/local/cargo/bin/sccache \
    cargo build --bin dev_ticker_server --release

FROM debian:bullseye
RUN apt update
RUN apt install openssl -y
EXPOSE 9876
ENV RUST_BACKTRACE "full"
ENV RUST_LOG info
COPY --from=builder /usr/src/rollup/target/release/dev_ticker_server /bin/
COPY --from=builder /usr/src/rollup/etc/tokens /etc/tokens
ENTRYPOINT ["dev_ticker_server"]
