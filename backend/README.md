# Backend Scaffold

This project currently runs as a static frontend app.

Suggested scalable backend layout:

```
backend/
  src/
    server.js
    routes/
    services/
    repositories/
    middleware/
```

When a real API is introduced, move localStorage-based auth/profile logic from frontend into backend endpoints.
