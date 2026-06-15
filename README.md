# Shantiniketan Public School ERP

A full-stack School ERP system built with **React + Vite** (frontend) and **Express + Prisma + PostgreSQL** (backend).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, Recharts |
| Backend | Express.js, Prisma ORM, PostgreSQL |
| Auth | JWT (access + refresh tokens) |

## Local Development

### Prerequisites
- Node.js >= 18
- PostgreSQL running locally

### Backend
```bash
cd backend
cp .env.example .env   # Edit DATABASE_URL and secrets
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed     # Seed default data
npm run dev             # Starts on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # Starts on http://localhost:3000 (proxies /api to backend)
```

### Default Login
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@shantiniketan.edu | password123 |
| Principal | principal@shantiniketan.edu | password123 |
| Admin/Clerk | clerk@shantiniketan.edu | password123 |

## Deployment

### Frontend → Vercel
1. Import the repo on [Vercel](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Set environment variable: `VITE_API_URL` = your Render backend URL
4. Deploy

### Backend → Render
1. Create a **Web Service** on [Render](https://render.com)
2. Set **Root Directory** to `backend`
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm run start`
5. Add environment variables (see `backend/.env.example`)
6. Deploy

## License
Private — Shantiniketan Public School, Chapetla
