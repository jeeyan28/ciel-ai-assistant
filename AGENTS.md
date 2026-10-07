# AGENTS.md

Rules for any AI agent working in this repository. Read this fully before every task. If a rule here conflicts with the task prompt, stop and ask.

## READ THIS FIRST — the 9 rules

1. Do ONLY the task. Nothing extra.
2. Do it the way the task describes. Do not choose a different approach, flow, library, or feature. If you think another way is better, say so in ONE sentence and wait for my answer.
3. If anything is unclear, ask me BEFORE editing. One short question, then wait. Never guess.
4. Do not create any file unless the task gives its exact path.
5. Edit only the files the task names.
6. Git: only `git status`, `git diff`, `git log`. I handle git.
7. No dependency changes, no reformatting, no refactoring, no new comments or docs.
8. If the code or files differ from what the task says, stop and ask.
9. When done, print the short report and STOP. Do not suggest or start next steps.

## 1. Prime rule

Do ONLY what the task asks. Nothing before it, nothing after it, nothing "while you're there".

If you notice something else that looks wrong, write it in your final report under "Noticed, not touched". Do not fix it.

## 2. Forbidden unless the task names it explicitly

- Creating any new file, folder, or `.md` file (this includes notes, plans, summaries, reports, changelogs, TODO files, test files, example files, scripts).
- Creating or editing documentation, README text, or comments, except the exact lines the task names.
- Deleting or renaming any file or folder that is not on the task's list.
- Refactoring, renaming variables, reordering code, or "cleaning up".
- Reformatting. Never run `prettier --write`, `npm run format`, or any auto-fixer on files you were not told to edit. Match the existing style of the file you edit (see `.prettierrc.json`).
- Installing, upgrading, or removing dependencies. Never edit `package-lock.json` by hand. Do not run `npm audit fix`, `npm update`, or `npm install <pkg>`.
- Editing config files (`vite.config.ts`, `tsconfig.json`, `eslint.config.js`, CI workflows, Docker files, `.gitignore`, `.env*`) unless the task names that file.
- Adding abstractions, helpers, utility functions, types, error handling, logging, or "defensive" code that the task did not ask for.
- ANY git command other than the three read-only ones below. The user handles git, always.
  - Allowed: `git status`, `git diff`, `git log`.
  - Never: `git init`, `git add`, `git commit`, `git push`, `git pull`, `git fetch`, `git clone`, `git remote`, `git branch`, `git checkout`, `git switch`, `git merge`, `git rebase`, `git reset`, `git restore`, `git stash`, `git tag`, `git clean`, `git config`, `git rm`, `git mv`.
  - Never use the GitHub CLI (`gh`) or any GitHub/GitLab API or web action.
  - If the folder is not a git repo, do not initialize one. If git is not set up, ignore it and continue the task.
  - Do not create `.git`, `.gitignore`, or `.gitattributes`, and do not edit them.
  - Do not suggest commit messages, branch names, or PR text unless the task asks for them.
- Reading or printing secrets. Never open `.env` or any `.env.*` except `.env.example`. Never print tokens or keys.

## 3. Protected paths (do not edit unless the task names the exact path)

- `docs/` (the system specification is the source of truth; code follows it, not the other way around)
- `private/` (user's private notes; not part of the repo)
- `LICENSE`, `SECURITY.md`, `CHANGELOG.md`, `.github/`, `.githooks/`, `.gitleaks.toml`, `.env.example`
- `package.json`, `package-lock.json`, `ciel-web/package.json` (except a script line the task names)
- `ciel-web/src/api/contract.ts` and `ciel-web/src/api/client.ts` (these are the API contract)

## 4. How to work on every task

1. Restate the task in two sentences and list the exact files you will touch. Do not touch any file not on that list. If you discover you need another file, stop and ask.
2. Before deleting anything, search for references: `grep -rn "<name>" . --exclude-dir=node_modules --exclude-dir=.git`. Remove only the references the task names.
3. Make the smallest change that completes the task. Smallest diff wins.
4. Do not guess. If code, a path, or behavior is not what the task says, stop and ask. Do not invent a workaround.
5. Run the checks the task lists (from the repo root): `npm run lint`, `npm test`, `npm run build`. If a check fails because of your change, fix only that. If it fails for a reason unrelated to your change, report it and stop. Do not fix it.
6. Run `git status` and `git diff --stat`. Every changed file must be on your list from step 1. If any other file changed, undo your own edit to it by hand (never with git) and report it.

## 5. Ask, don't assume

Ask me a question BEFORE you edit anything if:
- the task has two or more reasonable readings,
- a name, path, value, or behavior is missing from the task,
- you are about to choose between options (a library, a file location, a naming style, a design),
- the result would add a feature, screen, route, option, or behavior I did not name.

How to ask:
- ONE question at a time, short, with 2 to 3 numbered options and your recommended option marked.
- Then STOP and wait. Do not continue with "assumptions". Do not edit while waiting.
- Do not ask about things the task already answers or things you can check by reading the code.

Never replace what I asked for with your own idea of a better flow. Suggestions go in one sentence under "Needs your decision" in the report, not into the code.

## 6. Stop and ask when

- A file the task says to edit or delete does not exist or is different from the description.
- You would need to create a file, add a dependency, or edit a protected path.
- A fix needs more than the lines the task describes.
- Tests, lint, or build fail and the cause is not your change.
- You are unsure. Asking is always correct; guessing is never.

## 7. Final report format (and nothing longer)

```
Task: <one line>
Files changed: <list>
Files deleted: <list>
Checks: lint <pass/fail> | test <pass/fail> | build <pass/fail>
Noticed, not touched: <list or "none">
Needs your decision: <list or "none">
```

Do not write the report to a file. Print it in the terminal only.

## 8. Project facts (for orientation only; not tasks)

- Ciel is a single-user personal AI IT assistant.
- Today the repo contains only a frontend simulation in `ciel-web/` (React, TypeScript, Vite, Zustand). The backend (FastAPI, PostgreSQL) does not exist yet.
- Specification: `docs/architecture.md`, `docs/api.md`, `docs/security.md`, `docs/mvp.md`, `docs/evaluation.md`. Build order: `private/roadmap.md`.
- Code style: follow the file you are in. The codebase uses single quotes and no semicolons.
- Commands run from the repo root: `npm run lint`, `npm test`, `npm run build`.

## 9. Explain (the user is learning)

After the report, print an "Explain" block in the terminal. Never write it to a file or into code comments.
- What changed, in plain words (max 5 lines).
- Why each changed file exists (one sentence per file).
- One concept a beginner may not know, in 2 sentences.
- The one file to read first to follow how it works.
Do not add extra code, files, or features "to teach".