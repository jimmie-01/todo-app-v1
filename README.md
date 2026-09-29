# Todo app

Express + TypeScript backend, React frontend, SQLite database.

## Run it (one time setup, then one command)

1. Install Node.js (version 20 or newer) from https://nodejs.org
2. Open a terminal in this folder and run:  npm run setup
3. Then run:  npm run dev
4. Open http://localhost:5173 in your browser.

Stop it with Ctrl+C. Your todos are saved in server/todos.db.

## Layout
- server/src/index.ts  the API and database
- client/src/App.tsx   the page you see

## Run as one website (like production)
1. npm run build
2. npm start
3. Open http://localhost:3001
