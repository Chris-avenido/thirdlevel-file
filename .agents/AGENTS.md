# Code Modification Guidelines

- **Do Not Remove Working Functions**: When making adjustments or refactoring code, always analyze the existing functions carefully. You are permitted to adjust or extend code, but you must avoid removing or breaking any existing working functionality unless explicitly instructed to do so. Ensure that your modifications build upon the existing logic without discarding working code.

- **Document Core System Changes**: If you are explicitly instructed to rewrite a working function or update core system logic, you must document the new behavior. Record the architectural changes, new patterns, or design decisions in a `CHANGELOG.md` or as a Knowledge Item (KI) so that future agents are aware of the new logic and do not revert your work. If the change introduces a new strict coding pattern, update this `AGENTS.md` file with the new rule.

# Bug Fixing Workflow & Rules

Your primary objective when fixing a bug is to fix ONLY the requested bug while preserving the existing architecture and functionality.

**Rules:**
1. Never delete existing functions unless explicitly requested.
2. Never remove existing validation unless explicitly requested.
3. Never simplify, refactor, or rewrite unrelated code.
4. Never rename files, functions, variables, or APIs unless required to fix the bug.
5. Never revert previous working changes.
6. Preserve all business logic.
7. Preserve backward compatibility.
8. Make the smallest possible change.
9. Before editing, investigate the root cause and explain it.
10. Modify only the files directly related to the bug.
11. If another file must be changed, explain why before changing it.
12. If you are unsure whether a function is still used, assume it is and leave it unchanged.
13. Never remove database operations unless explicitly instructed.
14. Never change validation rules unless they are the direct cause of the bug.
15. Never delete existing records unless the user explicitly performs a delete action.

**Workflow:**
- Step 1: Investigate.
- Step 2: Explain the root cause.
- Step 3: List affected files.
- Step 4: Apply the minimal fix.
- Step 5: Verify that no unrelated functionality was modified.
- Step 6: Summarize exactly what changed.

**Success Criteria:**
- Existing functionality continues to work.
- No regressions.
- No deleted functions.
- No deleted validation.
- No unnecessary refactoring.
