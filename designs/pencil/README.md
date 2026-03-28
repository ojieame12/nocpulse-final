# Pencil Design Files

Primary FieldPulse v3 Pencil document:

- `nocpulse.pen`

Current state:

- `nocpulse.pen` is a symlink to `/Users/ojieame/Downloads/nocpulse`
- Pencil can open the repo-local path directly
- the symlink exists because terminal-level reads from `Downloads` are blocked
  by local macOS privacy permissions in the current environment

Working rule:

- use `designs/pencil/nocpulse.pen` as the canonical design path for UI work
- do not infer UI changes from code alone; validate against the Pencil document
