FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server ./cmd/api

FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

# Folder kerja aplikasi: /app (semua upload tersimpan di /app/uploads)
WORKDIR /app

COPY --from=builder /app/server .

RUN mkdir -p uploads/proofs uploads/products

EXPOSE 8080

CMD ["./server"]
