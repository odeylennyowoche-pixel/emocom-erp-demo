import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useData } from '../../data/store'
import { addEmployee, updateEmployee } from '../../data/actions'
import { fullName } from '../../data/selectors'
import { useAction } from '../../hooks/useAction'
import { todayISO } from '../../lib/dates'
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Form'
import { NotFoundPage } from '../../app/RouteError'
import { AccessDenied } from '../auth/Guards'
import { employeeSchema, type EmployeeFormValues } from './employeeSchema'
import { LOCATIONS } from '../../data/seedCatalog'

export default function EmployeeFormPage() {
  const { id } = useParams()
  const { state, perms, commit, commitWith } = useData()
  const navigate = useNavigate()
  const run = useAction()
  const existing = id ? state.employees.find((e) => e.id === id) : undefined

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: existing
      ? { ...existing, managerId: existing.managerId ?? '' }
      : {
          firstName: '',
          lastName: '',
          email: '',
          phone: '+234 ',
          departmentId: '',
          jobTitle: '',
          status: 'Active',
          employmentType: 'Full-time',
          joinDate: todayISO(),
          location: 'Lekki HQ',
          managerId: '',
        },
  })

  if (id && !existing) return <NotFoundPage title="Employee not found" />
  if (!perms.canManageEmployees) return <AccessDenied message="Only HR and executives can add or edit employee records." />

  const deptId = watch('departmentId')
  const managers = state.employees.filter((e) => e.status !== 'Inactive' && e.id !== id && (!deptId || e.departmentId === deptId))

  const onSubmit = (values: EmployeeFormValues) => {
    const input = { ...values, managerId: values.managerId || undefined }
    if (existing) {
      const ok = run(() => commit((s) => updateEmployee(s, existing.id, input)), { title: 'Employee updated', description: `${values.firstName} ${values.lastName}'s record was saved.` })
      if (ok) navigate(`/employees/${existing.id}`)
    } else {
      let newId = ''
      const ok = run(
        () => {
          newId = commitWith((s) => addEmployee(s, input)).id
        },
        { title: 'Employee added', description: `${values.firstName} ${values.lastName} was added to the directory.` },
      )
      if (ok) navigate(`/employees/${newId}`)
    }
  }

  return (
    <>
      <PageHeader title={existing ? `Edit ${fullName(existing)}` : 'Add employee'} description={existing ? `${existing.employeeNo} · update personal and employment details.` : 'Create a new staff record. Fields marked * are required.'} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <Card>
          <CardHeader title="Personal details" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required error={errors.firstName?.message}>
              {(fid, d) => <Input id={fid} aria-describedby={d} invalid={!!errors.firstName} autoComplete="off" {...register('firstName')} />}
            </Field>
            <Field label="Last name" required error={errors.lastName?.message}>
              {(fid, d) => <Input id={fid} aria-describedby={d} invalid={!!errors.lastName} autoComplete="off" {...register('lastName')} />}
            </Field>
            <Field label="Work email" required error={errors.email?.message} hint="Use the fictional demo domain, e.g. name@enterpriseone.example">
              {(fid, d) => <Input id={fid} type="email" aria-describedby={d} invalid={!!errors.email} autoComplete="off" {...register('email')} />}
            </Field>
            <Field label="Phone" required error={errors.phone?.message}>
              {(fid, d) => <Input id={fid} type="tel" aria-describedby={d} invalid={!!errors.phone} autoComplete="off" {...register('phone')} />}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Employment" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Department" required error={errors.departmentId?.message}>
              {(fid, d) => (
                <Select id={fid} aria-describedby={d} invalid={!!errors.departmentId} {...register('departmentId')}>
                  <option value="">Select department…</option>
                  {state.departments.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Job title" required error={errors.jobTitle?.message}>
              {(fid, d) => <Input id={fid} aria-describedby={d} invalid={!!errors.jobTitle} {...register('jobTitle')} />}
            </Field>
            <Field label="Reports to" error={errors.managerId?.message}>
              {(fid, d) => (
                <Select id={fid} aria-describedby={d} {...register('managerId')}>
                  <option value="">No manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {fullName(m)} — {m.jobTitle}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Employment status" required error={errors.status?.message}>
              {(fid, d) => (
                <Select id={fid} aria-describedby={d} {...register('status')}>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Employment type" required error={errors.employmentType?.message}>
              {(fid, d) => (
                <Select id={fid} aria-describedby={d} {...register('employmentType')}>
                  {EMPLOYMENT_TYPES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Joining date" required error={errors.joinDate?.message}>
              {(fid, d) => <Input id={fid} type="date" aria-describedby={d} invalid={!!errors.joinDate} {...register('joinDate')} />}
            </Field>
            <Field label="Work location" required error={errors.location?.message}>
              {(fid, d) => (
                <Select id={fid} aria-describedby={d} {...register('location')}>
                  {LOCATIONS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              )}
            </Field>
          </CardBody>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(existing ? `/employees/${existing.id}` : '/employees')}>
            Cancel
          </Button>
          <Button type="submit" icon={<Save className="size-4" />} disabled={isSubmitting || (!!existing && !isDirty)}>
            {existing ? 'Save changes' : 'Add employee'}
          </Button>
        </div>
      </form>
    </>
  )
}
