/**
 * ClickUp-inspired Tailwind class presets.
 * Use in components: className={cn(cu.btnPrimary, className)}
 */
export const cu = {
  /* Layout */
  appShell:
    'min-h-screen bg-cu-app font-sans text-cu-text text-sm antialiased transition-[margin] duration-300',
  mainContent: 'flex min-h-screen min-w-0 flex-1 flex-col bg-white',
  pageWrapper: 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto',

  /* Sidebar */
  sidebar:
    'fixed top-0 left-0 z-[200] flex h-screen flex-col overflow-hidden border-r border-cu-border bg-white font-sans transition-[width] duration-300',
  sidebarExpanded: 'w-[280px]',
  sidebarCollapsed: 'w-14',
  sidebarHeader: 'flex shrink-0 items-center gap-2 px-3 pb-2.5 pt-3.5',
  sidebarTitle: 'min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight text-cu-text',
  sidebarScroll: 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto',
  sidebarFooter: 'mt-auto shrink-0 border-t border-cu-border bg-white px-2.5 pb-3.5 pt-2.5',

  /* Nav */
  navItem:
    'flex w-full min-h-[30px] cursor-pointer items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-2.5 py-1.5 text-[13px] font-normal text-cu-text-secondary no-underline transition-colors hover:bg-cu-hover hover:text-cu-text',
  navItemActive:
    'bg-cu-primary-soft font-medium text-cu-primary hover:bg-cu-primary-soft hover:text-cu-primary',
  navIcon: 'inline-flex h-4 w-4 shrink-0 items-center justify-center text-cu-text-muted',
  navIconActive: 'text-cu-primary',
  navLabel: 'min-w-0 flex-1 truncate text-left',

  /* Buttons */
  btnPrimary:
    'inline-flex items-center justify-center gap-1.5 rounded-md border border-cu-primary bg-cu-primary px-3.5 py-2 text-sm font-semibold text-white shadow-none transition-colors hover:border-cu-primary-hover hover:bg-cu-primary-hover disabled:cursor-not-allowed disabled:opacity-50',
  btnSecondary:
    'inline-flex items-center justify-center gap-1.5 rounded-md border border-cu-border bg-white px-3.5 py-2 text-sm font-medium text-cu-text-secondary shadow-none transition-colors hover:border-gray-300 hover:bg-cu-hover hover:text-cu-text disabled:cursor-not-allowed disabled:opacity-50',
  btnGhost:
    'inline-flex items-center justify-center rounded-md border-0 bg-transparent p-1.5 text-cu-text-muted transition-colors hover:bg-cu-hover hover:text-cu-text',
  btnIcon:
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cu-border bg-white text-cu-text-secondary transition-colors hover:border-gray-300 hover:bg-cu-hover hover:text-cu-text',
  btnCreate:
    'inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border-0 bg-cu-primary px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cu-primary-hover',

  /* Inputs */
  input:
    'w-full rounded-lg border border-cu-border bg-white px-3.5 py-2.5 text-sm text-cu-text outline-none transition-[border-color,box-shadow] placeholder:text-cu-text-muted focus:border-cu-primary focus:ring-2 focus:ring-cu-primary/20',
  search:
    'flex w-full items-center rounded-lg border border-transparent bg-cu-hover px-3 py-2 transition-[border-color,box-shadow] focus-within:border-cu-border focus-within:bg-white focus-within:ring-2 focus-within:ring-cu-primary/20',

  /* Cards */
  card: 'rounded-xl border border-cu-border bg-white p-6 shadow-cu-sm',
  cardHover: 'transition-shadow hover:shadow-cu-md',

  /* Tables */
  tableWrap: 'overflow-hidden rounded-lg border border-cu-border bg-white',
  tableHead:
    'bg-cu-app text-left text-xs font-semibold uppercase tracking-wide text-cu-text-secondary',
  tableRow: 'border-b border-cu-border transition-colors hover:bg-cu-hover/60',
  tableCell: 'px-4 py-3 text-sm text-cu-text',

  /* Badges */
  badge:
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
  badgePrimary: 'border-cu-primary/25 bg-cu-primary-soft text-cu-primary',
  badgeNeutral: 'border-cu-border bg-cu-app text-cu-text-secondary',
  badgeSuccess: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  badgeWarning: 'border-amber-200 bg-amber-50 text-amber-700',
  badgeDanger: 'border-red-200 bg-red-50 text-red-600',

  /* Modals */
  modalOverlay: 'fixed inset-0 z-[120000] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]',
  modal:
    'z-[120001] flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-cu-border bg-white shadow-cu-lg',
  modalHeader: 'border-b border-cu-border px-5 py-4',
  modalBody: 'min-h-0 flex-1 overflow-y-auto px-5 py-4',
  modalFooter: 'flex items-center justify-end gap-2 border-t border-cu-border bg-cu-app px-5 py-3.5',

  /* Dropdowns */
  dropdown:
    'absolute z-[600] min-w-[10rem] overflow-hidden rounded-lg border border-cu-border bg-white py-1 shadow-cu-md',
  dropdownItem:
    'flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-sm text-cu-text transition-colors hover:bg-cu-hover',

  /* Navbar */
  navbar:
    'sticky top-0 z-[500] flex h-16 shrink-0 items-center justify-between gap-5 border-b border-cu-border bg-white px-6',
  navbarDashboard:
    'absolute top-4 right-9 z-[31] h-auto border-0 bg-transparent p-0 shadow-none',

  /* Task list */
  taskRow:
    'flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm text-cu-text transition-colors hover:bg-cu-hover',
  taskRowActive: 'bg-cu-primary-soft text-cu-primary',

  /* Section */
  sectionTitle: 'text-[13px] font-bold tracking-tight text-cu-text',
  divider: 'mx-3 my-2 h-px bg-cu-border',
} as const;
