import { messages } from './messages.th'

const errorMessages: Record<string, string> = {
  BILL_NOT_PAYABLE: messages.billNotPayable,
  INVALID_FILE_PATH: messages.invalidFilePath,
  SLIP_NOT_PENDING: messages.slipAlreadyReviewed,
  FORBIDDEN: messages.forbidden,
  REASON_REQUIRED: messages.reasonRequired,
  NO_HOUSE: messages.unlinkedAccount,
  INVALID_AMOUNT: messages.ledgerAmountInvalid,
  INVALID_BILL_SELECTION: messages.monthRequired,
  IDENTIFIER_REQUIRED: messages.identifierRequired,
  REQUEST_NOT_OPEN: messages.resetRequestClosed,
  LEDGER_NOT_FOUND: messages.ledgerNotFound,
  LEDGER_LOCKED: messages.ledgerLocked,
  CATEGORY_REQUIRED: messages.categoryRequired,
  DATE_REQUIRED: messages.ledgerDateRequired,
  INVALID_ENTRY_TYPE: messages.invalidEntryType,
  INVALID_CATEGORY: messages.invalidTicketCategory,
  TITLE_REQUIRED: messages.ticketTitleRequired,
  DESCRIPTION_REQUIRED: messages.ticketDescriptionRequired,
  TICKET_NOT_FOUND: messages.ticketNotFound,
  INVALID_PHOTO_KIND: messages.invalidPhotoKind,
  TOO_MANY_PHOTOS: messages.ticketTooManyPhotos,
  INVALID_TRANSITION: messages.ticketTransitionInvalid,
  TICKET_CLOSED: messages.ticketClosed,
  FEE_REQUIRED: messages.ticketFeeRequired,
  EXPENSE_ALREADY_RECORDED: messages.ticketExpenseRecorded,
  INVALID_ASSIGNEE: messages.invalidAssignee,
  CONTRACTOR_NOT_FOUND: messages.contractorNotFound,
  COMMENT_REQUIRED: messages.ticketCommentRequired,
  ASSET_NOT_FOUND: messages.assetNotFound,
  ASSET_RETIRED: messages.assetRetired,
  INVALID_DATE: messages.maintenanceDateInvalid,
  INVALID_MAINTENANCE_KIND: messages.maintenanceKindInvalid,
}

export function toThaiError(error: unknown): string {
  const value = error as { code?: string; message?: string; name?: string; status?: number }
  const message = value?.message ?? ''
  if ((Object.values(messages) as string[]).includes(message)) return message
  if (value?.code && errorMessages[value.code]) return errorMessages[value.code]
  if (value?.code === 'same_password' || message.toLowerCase().includes('should be different from the old password')) {
    return messages.passwordSameAsCurrent
  }
  for (const [code, thai] of Object.entries(errorMessages)) {
    if (message.includes(code)) return thai
  }
  if (
    message.includes('บ้านเลขที่หรือรหัสผ่านไม่ถูกต้อง')
    || message.toLowerCase().includes('invalid login credentials')
    || value?.code === 'invalid_credentials'
  ) return messages.wrongCredentials
  if (value?.name?.includes('Storage') || value?.code?.startsWith('Storage')) return messages.uploadFailed
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return messages.network
  if (value?.code === 'PGRST116') return messages.unlinkedAccount
  if (value?.code?.startsWith('23') || value?.code?.startsWith('PGRST')) return messages.generic
  return messages.generic
}
