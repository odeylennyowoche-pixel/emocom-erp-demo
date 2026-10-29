import { z } from 'zod'
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES } from '../../types'
import { todayISO } from '../../lib/dates'

export const employeeSchema = z.object({
  firstName: z.string().trim().min(2, 'Enter at least 2 characters').max(40),
  lastName: z.string().trim().min(2, 'Enter at least 2 characters').max(40),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number'),
  departmentId: z.string().min(1, 'Select a department'),
  jobTitle: z.string().trim().min(2, 'Enter a job title').max(60),
  status: z.enum(EMPLOYMENT_STATUSES),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  joinDate: z
    .string()
    .min(1, 'Select the joining date')
    .refine((d) => d <= todayISO().slice(0, 4) + '-12-31', 'Joining date is too far in the future'),
  location: z.string().trim().min(2, 'Enter a work location'),
  managerId: z.string().optional(),
})

export type EmployeeFormValues = z.infer<typeof employeeSchema>
