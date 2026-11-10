import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@/components/Icon'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useLeaving } from '@/hooks/useLeaving'
import { ActionsContextContent, ActionsDropdownContent } from '@/features/items/itemActions'
import type { Action } from '@/features/items/useItemActions'
import type { SavedView } from '@/lib/api'
import { useT, type TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useActiveView, useMoveView, useViews } from './queries'
import { useDeleteView } from './useDeleteView'
import { useViewDialogs } from './viewDialogsContext'

const makeInstructions = (t: TFunction): ScreenReaderInstructions => ({
  draggable: t('view.dnd.instructions'),
})

function makeAnnouncements(views: SavedView[], t: TFunction): Announcements {
  const name = (id: string | number) => views.find((v) => v.id === id)?.name ?? ''
  const pos = (id: string | number | undefined) => views.findIndex((v) => v.id === id) + 1
  return {
    onDragStart: ({ active }) => t('view.dnd.start', { name: name(active.id), position: pos(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t('view.dnd.over', { name: name(active.id), position: pos(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('view.dnd.end', { name: name(active.id), position: pos(over.id) })
        : t('view.dnd.dropped', { name: name(active.id) }),
    onDragCancel: ({ active }) => t('view.dnd.cancel', { name: name(active.id) }),
  }
}

function ViewRow({
  view,
  index,
  active,
  leaving,
  blockLeaving,
  arrived,
  actions,
}: {
  view: SavedView
  index: number
  active: boolean
  leaving: boolean
  /** The whole block is closing: the rows stay still instead of collapsing a second time inside it. */
  blockLeaving: boolean
  arrived: boolean
  actions: Action[]
}) {
  const t = useT()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: view.id, disabled: leaving })
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    '--i': arrived ? 0 : index % 8,
  } as CSSProperties
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('min-w-0', leaving ? (blockLeaving ? undefined : 'leaving') : arrived ? 'expand' : 'enter', isDragging && 'z-10')}
      inert={leaving}
    >
      <ContextMenu>
        <ContextMenuTrigger render={<div className="nv" data-dragging={isDragging || undefined} />}>
          <Link
            ref={setActivatorNodeRef}
            to={{ pathname: '/', search: view.query }}
            aria-current={active ? 'page' : undefined}
            // Space picks the row up (Enter keeps following the link); the pointer needs a 4 px drag.
            aria-roledescription={attributes['aria-roledescription']}
            aria-describedby={attributes['aria-describedby']}
            draggable={false}
            title={view.name}
            {...listeners}
          >
            <Icon name="bookmark" small bold={active} />
            <span className="nv-name">{view.name}</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="icon-btn nv-more"
                  aria-label={t('view.actions', { name: view.name })}
                  title={t('item.actions')}
                />
              }
            >
              <Icon name="menu-dots" small />
            </DropdownMenuTrigger>
            <ActionsDropdownContent actions={actions} />
          </DropdownMenu>
        </ContextMenuTrigger>
        <ActionsContextContent actions={actions} />
      </ContextMenu>
    </li>
  )
}

/** Desktop sidebar: the saved views in their own section between the main entries and settings, in the user's order (drag, or Space and arrows). */
export function SidebarViews() {
  const t = useT()
  const { data: views = [] } = useViews()
  const activeId = useActiveView()?.id
  const move = useMoveView()
  const deleteView = useDeleteView()
  const dialogs = useViewDialogs()
  const rows = useLeaving(views)
  const ids = useMemo(() => views.map((v) => v.id), [views])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter', 'Tab'] },
    }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const to = ids.indexOf(String(over.id))
    if (to >= 0) move.mutate({ id: String(active.id), position: to })
  }

  const blockLeaving = rows.length > 0 && rows.every((r) => r.leaving)
  if (rows.length === 0) return null
  return (
    // Opens and closes its height as a block, so the entries below never jump.
    <div className={blockLeaving ? 'leaving' : 'expand'}>
      {/* One child only: the grid collapse above animates a single row. */}
      <div>
        <div className="nav-sep" />
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
          accessibility={{ announcements: makeAnnouncements(views, t), screenReaderInstructions: makeInstructions(t) }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="nv-list" aria-label={t('views.label')}>
              {rows.map(({ item: view, leaving, arrived }, index) => (
                <ViewRow
                  key={view.id}
                  view={view}
                  index={index}
                  active={view.id === activeId}
                  leaving={leaving}
                  blockLeaving={blockLeaving}
                  arrived={arrived}
                  actions={[
                    { key: 'rename', label: t('view.rename'), icon: <Icon name="pen" />, run: () => dialogs.rename(view) },
                    {
                      key: 'delete',
                      label: t('common.delete'),
                      icon: <Icon name="trash-bin-minimalistic" />,
                      destructive: true,
                      run: () => deleteView(view),
                    },
                  ]}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
