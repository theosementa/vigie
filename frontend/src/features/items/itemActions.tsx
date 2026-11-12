import { Fragment } from 'react'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'

import type { Action } from './useItemActions'

export function ActionsDropdownContent({ actions }: { actions: Action[] }) {
  return (
    <DropdownMenuContent align="end" className="w-56">
      {actions.map((a) => (
        <Fragment key={a.key}>
          {(a.destructive || a.separatorBefore) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            variant={a.destructive ? 'destructive' : undefined}
            disabled={a.disabled}
            onClick={a.run}
          >
            {a.icon}
            {a.label}
          </DropdownMenuItem>
        </Fragment>
      ))}
    </DropdownMenuContent>
  )
}

export function ActionsContextContent({ actions }: { actions: Action[] }) {
  return (
    <ContextMenuContent className="w-56">
      {actions.map((a) => (
        <Fragment key={a.key}>
          {(a.destructive || a.separatorBefore) && <ContextMenuSeparator />}
          <ContextMenuItem variant={a.destructive ? 'destructive' : undefined} disabled={a.disabled} onClick={a.run}>
            {a.icon}
            {a.label}
          </ContextMenuItem>
        </Fragment>
      ))}
    </ContextMenuContent>
  )
}
