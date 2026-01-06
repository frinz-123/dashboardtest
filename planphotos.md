#Feature request Implement Photo Capture for CLEY clients

Brainstorm / recommendations for CLEY photo capture + offline queue
Below are concrete, code‑adjacent ideas grounded in the current form + queue flow (src/app/form/page.tsx, src/utils/submissionQueue.ts, src/hooks/useSubmissionQueue.ts, public/service-worker.js, src/app/api/submit-form/route.ts). I’m focusing on a “fail‑proof” offline pipeline with Google Sheets as the system of record.

1) Add CLEY‑only photo capture UI and attach to the queued payload
Right now the queue payload only carries JSON fields (no binary). That will block photo capture because files aren’t persisted in the queue. You’ll need a CLEY‑only image input and a way to persist Blobs in IndexedDB.

Tarea sugerida
Add CLEY-only photo capture UI that persists selected images for offline queueing

Iniciar tarea
2) Extend the queue to upload photos before pushing to Sheets
The queue currently sends JSON directly to /api/submit-form. For photos, you need a two‑step process: upload photo(s) to storage → then submit the form with links. If the upload fails, keep the photo blobs queued.

Tarea sugerida
Extend submission queue to upload photos first, then submit sheet links

Iniciar tarea
3) Choose free storage that fits your existing Google stack
Since you already use Google Sheets via a service account, the most seamless “free” bucket is Google Drive (15GB on the account) using the Drive API. It requires minimal new infrastructure and returns shareable links.

Tarea sugerida
Create a server-side photo upload endpoint that stores images in Google Drive and returns public URLs

Iniciar tarea
4) Background Sync should also process photo uploads offline
You already have a background sync worker (public/service-worker.js) and a queue that triggers sync. That worker will need to read photo blobs and upload them before submission (same logic as the client queue).

Tarea sugerida
Teach the service worker to upload queued photos before submitting queued orders

Iniciar tarea
Additional considerations (non‑blocking but important)
IndexedDB size limits: Storing raw photos can fill storage quickly. Client‑side resize/compress (e.g., max 1280px, JPEG quality ~0.75) before persisting.

Duplicate detection: The queue’s fingerprinting (submissionQueue.generateFingerprint) should include photo counts or IDs to avoid missing duplicates.

Sheet schema: Decide on a fixed column for photo URLs (single column with JSON or comma‑separated list).
