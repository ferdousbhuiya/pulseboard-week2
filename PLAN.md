# PLAN

## Concept

PulseBoard is a simple task manager with sign-up, login, and per-user CRUD. It is designed to satisfy the Week 2 full-stack assignment using a BaaS instead of a custom backend.

## Scope

The app includes:

- Email/password registration and login
- Protected task CRUD for the signed-in user
- Firestore data scoped by user ID
- A responsive React frontend
- GitHub Actions deployment on push to `main`

## Data Model

The database uses a user-scoped collection structure:

- `users/{uid}`: profile metadata for the authenticated user
- `users/{uid}/tasks/{taskId}`: task records owned by that user

Task fields:

- `title`
- `description`
- `status`
- `dueDate`
- `createdAt`
- `updatedAt`

## Key Design Decisions

- Firebase Auth handles password storage and session management.
- Firestore security rules prevent cross-user data access.
- A subcollection per user keeps the data model easy to reason about.
- GitHub Pages is used for deployment because the app is a static frontend.

## Future Enhancements

- Add search and filtering
- Add task labels or categories
- Add richer collaboration features such as shared tasks
- Add tests in a later milestone