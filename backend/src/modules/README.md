# Backend Modules

This folder is the progressive modular architecture entry point.

Each module owns a business domain and exposes its public Express routes through
`routes.ts`. During the compatibility phase, these route files re-export the
existing legacy route files from `src/routes/` so public API URLs and behavior
remain stable while controllers and services are migrated gradually.

Target module shape:

```txt
module-name/
  routes.ts
  controller.ts
  service.ts
  schema.ts
  types.ts
```

Migration rule: move implementation files into modules only after the current
routes pass type-check and manual smoke tests.
