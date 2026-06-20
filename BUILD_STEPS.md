# BUILD_STEPS

This file tracks the incremental build plan and verify checkpoints used for the assignment.

## Step 1: Initialize the project

- Create the Vite + React + TypeScript scaffold
- Add the base styling and app shell

Verify:

- `npm run build`

## Step 2: Add Firebase integration

- Configure Firebase app initialization
- Add auth and Firestore helpers
- Add `.env.example`

Verify:

- `npm run build`

## Step 3: Implement authentication

- Add registration
- Add login/logout
- Add auth state handling in the UI

Verify:

- Sign in and sign out locally against Firebase

## Step 4: Implement CRUD

- Add create task
- Add read task stream
- Add update task
- Add delete task

Verify:

- Create, edit, and delete tasks while signed in

## Step 5: Add security and deployment

- Add Firestore rules
- Add GitHub Actions deployment workflow
- Configure GitHub Pages deployment on push to `main`

Verify:

- `npm run build`
- GitHub Actions workflow completes successfully

## Step 6: Document the project

- Expand the README with setup, usage, and deployment notes
- Add this build plan and the project plan document

Verify:

- README includes the required assignment sections