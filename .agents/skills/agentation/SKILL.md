---
name: agentation
description: Add Agentation visual feedback toolbar to a Next.js project
---

# Agentation Setup

Set up the Agentation annotation toolbar in this project.

## Steps

1. **Check if already installed**
   - Look for `agentation` in package.json dependencies
   - If not found, run `npm install agentation -D` (or pnpm/yarn based on lockfile)

2. **Check if already configured**
   - Search for `<Agentation` or `import { Agentation }` in src/ or app/
   - If found, report that Agentation is already set up and exit

3. **Detect framework**
   - Next.js App Router: has `app/layout.tsx` or `app/layout.js`
   - Next.js Pages Router: has `pages/_app.tsx` or `pages/_app.js`

4. **Add the component**

   For Next.js App Router, add to the root layout:
   ```tsx
   import { Agentation } from "agentation";

   // Add inside the body, after children:
   {process.env.NODE_ENV === "development" && <Agentation />}
   ```

   For Next.js Pages Router, add to _app:
   ```tsx
   import { Agentation } from "agentation";

   // Add after Component:
   {process.env.NODE_ENV === "development" && <Agentation />}
   ```

5. **Confirm setup**
   - Tell the user to run their dev server and look for the Agentation toolbar (floating button in bottom-right corner)

## Props (v3+)

| Prop | Type | Description |
|------|------|-------------|
| `onAnnotationAdd` | `(annotation: Annotation) => void` | Called when an annotation is created |
| `onAnnotationDelete` | `(annotation: Annotation) => void` | Called when an annotation is deleted |
| `onAnnotationUpdate` | `(annotation: Annotation) => void` | Called when an annotation is edited |
| `onAnnotationsClear` | `(annotations: Annotation[]) => void` | Called when all annotations are cleared |
| `onCopy` | `(markdown: string) => void` | Callback with markdown output when copy is clicked |
| `onSubmit` | `(output: string, annotations: Annotation[]) => void` | Called when "Send Annotations" is clicked |
| `copyToClipboard` | `boolean` | Default `true`. Set to `false` to prevent writing to clipboard |
| `endpoint` | `string` | Server URL for Agent Sync (e.g. `"http://localhost:4747"`) |
| `sessionId` | `string` | Pre-existing session ID to join |
| `onSessionCreated` | `(sessionId: string) => void` | Called when a new session is created |
| `webhookUrl` | `string` | Webhook URL to receive annotation events |

## Notes

- The `NODE_ENV` check ensures Agentation only loads in development
- Agentation requires React 18+
- Install as a devDependency (`-D`) since it is only used in development
- No additional configuration needed — it works out of the box
- v3 adds programmatic callbacks (`onAnnotationAdd`, `onSubmit`, etc.), Agent Sync via `endpoint`, dark/light mode toggle, and zero runtime dependencies
