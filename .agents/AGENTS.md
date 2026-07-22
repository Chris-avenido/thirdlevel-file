# Code Modification Guidelines

- **Do Not Remove Working Functions**: When making adjustments or refactoring code, always analyze the existing functions carefully. You are permitted to adjust or extend code, but you must avoid removing or breaking any existing working functionality unless explicitly instructed to do so. Ensure that your modifications build upon the existing logic without discarding working code.

- **Document Core System Changes**: If you are explicitly instructed to rewrite a working function or update core system logic, you must document the new behavior. Record the architectural changes, new patterns, or design decisions in a `CHANGELOG.md` or as a Knowledge Item (KI) so that future agents are aware of the new logic and do not revert your work. If the change introduces a new strict coding pattern, update this `AGENTS.md` file with the new rule.
