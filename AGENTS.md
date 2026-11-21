# Project Instructions for AI Coding Agents

## ⚠️ Mandatory Pre-Implementation Rule
Before creating or modifying any file, function, component, model, or route in this repository:
1. **Always read `README.md` first.** `README.md` is the authoritative single source of truth for the codebase architecture, existing models, APIs, shared utilities, and UI components.
2. **Zero Redundancy & No Duplicate Functions**:
   - Check if an existing utility (`connectDB`, `ApiResponse`, `getSession`, `cn`, `scalekit`) covers the need.
   - Check if an existing UI component in `src/components/ui/` (Button, Dialog, Input, Select, Toast, etc.) already exists before adding any new component.
   - Do NOT introduce duplicate data models or parallel schemas (e.g. `Chatbot` vs `Setting`).
3. **No Unused Code**:
   - Do NOT leave unused imports, unreferenced schemas, or orphaned files.
   - Do NOT use `any` when explicit types can be defined.
4. **API Responses**:
   - Always use `ApiResponse.success()` and `ApiResponse.error()` from `@/lib/apiResponse` for JSON endpoints.
5. **Keep `README.md` Updated**:
   - Whenever you introduce a new route, model, utility, or component, immediately update `README.md` to keep the project inventory accurate.

