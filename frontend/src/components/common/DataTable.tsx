import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface DataTableColumn<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  headClassName?: string
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>
  rows: T[]
  rowKey: (row: T) => string | number
  loading?: boolean
  empty?: ReactNode
  renderExpanded?: (row: T) => ReactNode
  expandedLabel?: (row: T) => string
  footer?: ReactNode
  rowClassName?: (row: T) => string | undefined
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  renderExpanded,
  expandedLabel,
  footer,
  rowClassName,
}: DataTableProps<T>) {
  const [expanded, setExpanded] = useState<Array<string | number>>([])
  const expandable = typeof renderExpanded === 'function'
  const columnCount = columns.length + (expandable ? 1 : 0)

  function toggle(key: string | number) {
    setExpanded((previous) =>
      previous.includes(key) ? previous.filter((value) => value !== key) : [...previous, key],
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {expandable ? <TableHead className="w-8" aria-label="Expand row" /> : null}
          {columns.map((column) => (
            <TableHead key={column.id} className={column.headClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading
          ? Array.from({ length: 4 }).map((_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                {expandable ? (
                  <TableCell>
                    <Skeleton className="size-4" />
                  </TableCell>
                ) : null}
                {columns.map((column, columnIndex) => (
                  <TableCell key={column.id}>
                    <Skeleton
                      className={cn('h-4', columnIndex === 0 ? 'w-40' : 'w-20')}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : null}

        {!loading && rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnCount} className="p-0">
              <div className="p-4">
                {empty ?? (
                  <EmptyState
                    title="No records yet"
                    message="Create the first record to get started."
                  />
                )}
              </div>
            </TableCell>
          </TableRow>
        ) : null}

        {!loading
          ? rows.map((row) => {
              const key = rowKey(row)
              const isOpen = expanded.includes(key)
              return (
                <RowGroup key={key}>
                  <TableRow className={cn(rowClassName?.(row))}>
                    {expandable ? (
                      <TableCell className="w-8">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-expanded={isOpen}
                          aria-label={
                            expandedLabel?.(row) ?? (isOpen ? 'Collapse row' : 'Expand row')
                          }
                          onClick={() => toggle(key)}
                        >
                          <ChevronRight
                            className={cn('transition-transform', isOpen && 'rotate-90')}
                          />
                        </Button>
                      </TableCell>
                    ) : null}
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.className}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>

                  {expandable && isOpen ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={columnCount} className="p-0">
                        {renderExpanded(row)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </RowGroup>
              )
            })
          : null}
      </TableBody>

      {footer && !loading && rows.length > 0 ? (
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnCount}>{footer}</TableCell>
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  )
}

/** Renders a row plus its optional expanded sibling without a wrapper element. */
function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>
}
