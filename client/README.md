# Recruitment.Gorilla — Frontend

React 18 + TypeScript frontend built with Vite.

## Stack
- React 18 + TypeScript
- Bootstrap 5 + React Bootstrap
- TanStack Query v5 (data fetching)
- Axios (HTTP client)
- react-dropzone (file upload)
- react-router-dom (routing)

## Development

```bash
npm install
npm run dev       # starts dev server at http://localhost:5173
npm run build     # production build
npm run preview   # preview production build locally
```

The frontend expects the backend API to be running at `http://localhost:5134`.
To change the API base URL, update `src/services/api.ts`.
