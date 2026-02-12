# Update Constitution

1. Load `.specify/memory/constitution.md` and replace unresolved placeholders with concrete values.
2. Apply semantic version bumps for constitutional changes:
   - MAJOR: incompatible governance/principle redefinition or removal.
   - MINOR: new principle or materially expanded requirements.
   - PATCH: wording clarifications with no semantic change.
3. Validate dates in `YYYY-MM-DD` format and keep governance metadata current.
4. Sync dependent templates:
   - `.specify/templates/plan-template.md`
   - `.specify/templates/spec-template.md`
   - `.specify/templates/tasks-template.md`
   - `.specify/templates/commands/*.md`
5. Prepend a Sync Impact Report as an HTML comment at the top of the constitution.
