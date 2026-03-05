# 🌾 LumbungS3

LumbungS3 is a lightweight, self-hosted, S3-compatible object storage system with a stunning management dashboard. Designed for speed and minimal operational overhead, it leverages the power of **Bun**, **Hono**, **Drizzle ORM**, and **SQLite**.

The name **“Lumbung”** refers to the traditional Indonesian rice storage house, symbolizing a reliable place to store your valuable digital resources.

![Dashboard Preview](https://via.placeholder.com/1200x600/0f172a/6366f1?text=LumbungS3+Dashboard+Preview)

## ✨ Features

- **S3-Compatible API**: Compatible with standard S3 clients.
- **Modern Dashboard**: Built with React, Vite, and Tailwind CSS 4.0.
- **Drizzle ORM**: Type-safe database interactions with SQLite.
- **Multipart Uploads**: High-performance chunked uploads for large files.
- **Virtual Folders**: Navigate objects using S3-style directory prefixes.
- **Presigned URLs**: Secure temporary access for private objects.
- **Live Metrics**: Real-time throughput and storage monitoring.

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed.

### Installation

```bash
git clone https://github.com/Haslab-dev/LumbungS3.git
cd LumbungS3
bun install
```

### Database Setup

LumbungS3 uses Drizzle ORM. Initialize your database schema with:

```bash
bunx drizzle-kit push
```

### Development

Start the unified full stack (Frontend + Backend) concurrently:

```bash
bun dev
```

- **Dashboard**: `http://localhost:5173`
- **Unified API**: `http://localhost:9000`

## 🧪 Testing

We provide a formal test suite to verify S3 compatibility and core functionality.

**Ensure the server is running (`bun dev`) before executing tests:**

```bash
# Run the formal test suite
bun test

# Run the detailed multipart integration script
bun run scripts/test_upload.ts
```

## 🛠 Tech Stack

- **Backend**: [Bun](https://bun.sh), [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team).
- **Frontend**: [React](https://reactjs.org), [Vite](https://vite.dev), [Tailwind CSS 4.0](https://tailwindcss.com), [TanStack Query](https://tanstack.com/query).
- **Storage**: SQLite (WAL mode) with hashed file storage.

## 🗺 Roadmap

### Phase 1: Core (Completed)

- [x] S3-compatible API structure
- [x] Modern Dashboard UI / UX
- [x] Bucket Management (Create/Delete/Visibility)
- [x] Object Operations (Upload/Download/Delete)
- [x] S3-style Multipart Upload
- [x] Presigned URLs for secure access
- [x] Folder Navigation & Breadcrumbs

### Phase 2: Platform

- [ ] **Object Versioning**: Keep multiple versions of the same file.
- [ ] **Lifecycle Rules**: Automatically transition or delete old data.
- [ ] **IAM-Lite**: Basic access policies and multiple credential sets.
- [ ] **Object Metadata & Tags**: Extended categorization for files.

### Phase 3: Distributed

- [ ] Multi-node clustering
- [ ] Geo-replication
- [ ] Erasure coding for high availability

## 📜 License

MIT
