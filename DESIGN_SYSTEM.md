# Bizavo product design system

Bizavo should feel like one business workspace, not a collection of acquired admin tools. The system favors quiet hierarchy, clear states, progressive disclosure and connected records over dense dashboards.

## Product principles

1. **Work first, modules second.** Navigation groups reflect how teams operate: Operations, People & money, Growth and Manage.
2. **One source record.** Payments, receipts, journals and project profitability reference the same transaction rather than copying amounts.
3. **Status before decoration.** Every transactional surface exposes state, ownership, due date and next action.
4. **Progressive depth.** Lists show the minimum needed to decide; detail pages and disclosure panels hold secondary actions.
5. **No fake success.** External communication is marked sent only after the provider accepts it. Missing configuration produces a clear device-share fallback.
6. **Role-shaped simplicity.** People see only the modules and project scope relevant to their role.

## Foundations

| Token | Use |
| --- | --- |
| Ink `#0F1930` | Brand shell and high-emphasis text |
| Primary `hsl(228 80% 58%)` | Primary actions, links and active navigation |
| Canvas `hsl(218 33% 98%)` | Application background |
| Surface `#FFFFFF` | Cards, tables and forms |
| Border `hsl(220 20% 90%)` | Low-contrast structure |
| Success | Completed, paid, delivered and healthy states |
| Warning | Awaiting approval, processing and pending states |
| Destructive | Rejected, failed, void and blocked states |

Radius is intentionally generous on containers (`16px`) and slightly tighter on controls (`12px`). Shadows are restrained and never replace borders. Dense financial tables keep 44px headers and 16px cell padding for scanability.

## Navigation

- Desktop uses one grouped sidebar with stable nouns.
- Mobile uses Home, the role's primary workspace, one secondary workspace, Search and More.
- Global search spans projects, clients, vendors, SKUs, employees, invoices, receipts and leads while preserving role/project access.
- Dead controls are not shown. Search is functional; notifications stay absent until there is a real inbox.

## Transaction pattern

Every money-moving workflow follows the same mental model:

1. Create or receive the source document.
2. Review and approve where needed.
3. Record the real-world financial event.
4. Post the journal and update balances atomically.
5. Generate/share evidence.
6. Preserve an audit trail; correct with reversals rather than deletion.

## Content style

- Prefer familiar nouns: Purchases, People, Finance and Documents.
- Button labels describe the result: “Record payment,” “Create and issue document,” “Send secure link.”
- Empty states explain what will appear and how to create the first record.
- Error messages name the invalid state and the corrective action.
