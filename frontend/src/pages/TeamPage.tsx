import { useEffect, useState } from 'react'
import { Plus, Shield, UserCheck, Users } from 'lucide-react'
import { AddStaffDialog } from '@/components/catalog/AddStaffDialog'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate, initials } from '@/lib/format'
import { listStaff } from '@/services/api'
import type { User } from '@/types/contracts'

export function TeamPage() {
  const [staffList, setStaffList] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const items = await listStaff()
      setStaffList(items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const columns: Array<DataTableColumn<User>> = [
    {
      id: 'member',
      header: 'Team Member',
      cell: (row) => (
        <div className="flex items-center gap-3 py-1">
          <Avatar className="size-8 border border-border/60">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {initials(row.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">{row.full_name}</p>
            <p className="text-[11px] text-muted-foreground font-mono">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.role === 'ADMIN'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold gap-1'
              : 'border-sky-500/40 bg-sky-500/10 text-sky-400 font-semibold gap-1'
          }
        >
          {row.role === 'ADMIN' ? (
            <Shield className="size-3" />
          ) : (
            <UserCheck className="size-3" />
          )}
          {row.role}
        </Badge>
      ),
    },
    {
      id: 'capabilities',
      header: 'Operational Scope',
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.role === 'ADMIN'
            ? 'Catalog Studio, Pricing Rules, Staff Admin, Billing & Analytics'
            : 'Quotations, Subscriptions ERP, Invoice Chase & Payments'}
        </span>
      ),
    },
    {
      id: 'created_at',
      header: 'Added On',
      cell: (row) => (
        <span className="text-xs text-muted-foreground font-mono">
          {formatDate(row.created_at)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Members"
        description="Internal team access control. Only administrators can add new staff or grant permissions."
        actions={
          <Button
            size="sm"
            className="gap-1.5 shadow-sm"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-3.5" />
            Add Staff Member
          </Button>
        }
      />

      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <DataTable
          columns={columns}
          rows={staffList}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <Users className="mx-auto size-8 text-muted-foreground/40" />
              <p>No staff accounts configured.</p>
            </div>
          }
        />
      </Card>

      <AddStaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={loadData}
      />
    </div>
  )
}
