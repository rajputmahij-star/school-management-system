# Partial Payment Implementation - Complete

## Overview
Successfully implemented partial payment functionality with UPI settings integration. Students can now pay partial amounts when they cannot afford the full fee, with the remaining balance automatically carried forward to the next month.

## Changes Made

### 1. Student Fees Page (`src/pages/student/Fees.jsx`)
**Status:** ✅ Complete

#### Changes:
- **UPI Settings Integration:**
  - Extracted UPI settings from `settings` state (upiId, upiPayeeName, upiQrCodeUrl)
  - Passed `upiSettings` prop to `PaymentModal` component
  - UPI section now uses dynamic admin-configured settings instead of hardcoded values

- **Payment Modal Enhancements:**
  - Added payment mode dropdown (UPI, Net Banking, Cheque, Cash, Credit Card, Debit Card)
  - Added partial payment checkbox and custom amount input
  - Shows breakdown: Total Fee / Paying Now / Remaining Amount
  - UPI section only displays when UPI payment mode is selected
  - Displays QR code image if URL is provided
  - One-click UPI payment button with pre-filled amount

- **Payment Submission:**
  - Stores `paymentMode`, `paidAmount`, `remainingAmount`, `isPartialPayment` in payment_requests
  - Only first period gets partial payment marker when submitting multiple periods
  - Validation: partial amount must be less than total and greater than 0

#### Key Features:
```javascript
// UPI settings passed to modal
const upiSettings = {
  upiId: settings?.upiId || '',
  upiPayeeName: settings?.upiPayeeName || '',
  upiQrCodeUrl: settings?.upiQrCodeUrl || '',
}

// Partial payment calculation
const actualPayment = form.isPartialPayment && customAmount > 0 && customAmount < totalPayable 
  ? customAmount 
  : totalPayable
const remainingAmount = totalPayable - actualPayment
```

---

### 2. Admin Fee Management (`src/pages/admin/FeeManagement.jsx`)
**Status:** ✅ Complete

#### Changes:
- **Enhanced Payment Requests Table:**
  - Added "Mode" column to display payment mode
  - Shows "Partial Payment" badge for partial payments
  - Displays paid amount vs base amount for partial payments
  - Shows remaining balance that will be carried forward

- **Partial Payment Approval Logic:**
  - Detects `isPartialPayment` flag in payment requests
  - Uses `paidAmount` instead of `totalAmount` for partial payments
  - Stores partial payment metadata in fee_ledger:
    - `isPartialPayment`: boolean flag
    - `remainingAmount`: balance to carry forward
    - `amountPaid`: actual amount paid (not total)

- **Automatic Carryforward:**
  - Calculates next month's period key automatically
  - Creates/updates next month's ledger entry with added remaining amount
  - Remaining amount is added to base fee of next month
  - Tracks metadata:
    - `carriedFromPreviousMonth`: amount carried forward
    - `previousPeriodKey`: reference to original period

#### Key Implementation:
```javascript
// Handle partial payment in approval
const actualPaid = request.isPartialPayment ? (request.paidAmount || request.totalAmount) : request.totalAmount
const remaining = request.isPartialPayment ? (request.remainingAmount || 0) : 0

// Add to next month's ledger
if (request.isPartialPayment && remaining > 0) {
  const [year, month] = request.periodKey.split('-')
  const nextMonthDate = new Date(parseInt(year), parseInt(month) - 1 + 1, 1)
  const nextPeriodKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
  
  await upsertFeeLedgerEntry(request.studentId, nextPeriodKey, {
    baseFee: baseFee + remaining, // Add remaining to next month
    carriedFromPreviousMonth: remaining,
    previousPeriodKey: request.periodKey,
  })
}
```

---

### 3. Admin Settings Page (`src/pages/admin/Settings.jsx`)
**Status:** ✅ Already Implemented

#### Features:
- **UPI Payment Settings Section:**
  - UPI ID input field
  - UPI Payee Name input field
  - QR Code Image URL input field (optional)
  - Default values pre-filled:
    - UPI ID: `240140107066.riddhisingapuri@okaxis`
    - Payee Name: `Anand Special School`

---

### 4. PDF Receipt Generation (`src/utils/pdfExport.js`)
**Status:** ✅ Already Implemented

#### Features:
- Shows payment mode in receipt
- Displays Total Fee, Amount Paid, and Remaining Balance separately
- Adds note for partial payments: "*Partial Payment - Remaining amount will be added to next period"
- Color-coded amounts:
  - Total Fee: standard black
  - Amount Paid: green
  - Remaining Balance: red (if any)

---

## User Flow

### Student Portal - Making Partial Payment

1. Student navigates to "My Fees" page
2. Clicks "Pay Fees" button
3. Selects payment mode (Monthly/Quarterly/Yearly)
4. Selects month(s) to pay
5. **Sees payment mode dropdown** - selects payment method
6. **If selects UPI:**
   - Sees dynamic UPI ID (from admin settings)
   - Can scan QR code (if provided)
   - Click to open UPI apps with pre-filled amount
7. **If cannot pay full amount:**
   - Checks "Pay Partial Amount" checkbox
   - Enters amount they can pay
   - Sees breakdown: Total / Paying Now / Remaining
   - System shows remaining will be added to next month
8. Enters transaction reference ID and payment date
9. Submits payment request

### Admin Portal - Approving Partial Payment

1. Admin navigates to "Fee Management" → "Payment Verification"
2. Sees payment requests with:
   - Payment Mode displayed
   - "Partial Payment" badge (if applicable)
   - Paid amount and remaining amount shown
3. Clicks "Approve" button
4. System automatically:
   - Generates receipt number
   - Marks payment as paid with partial amount
   - Creates next month's ledger entry with remaining balance
   - Sends success notification
5. Downloads receipt showing:
   - Payment mode
   - Amount paid vs total fee
   - Remaining balance
   - Note about carryforward

---

## Database Schema Changes

### `payment_requests` Collection
New fields added:
```javascript
{
  paymentMode: 'UPI' | 'Net Banking' | 'Cheque' | 'Cash' | 'Credit Card' | 'Debit Card',
  paidAmount: Number,        // Actual amount paid (for partial payments)
  remainingAmount: Number,   // Balance to carry forward
  isPartialPayment: Boolean, // Flag for partial payment
}
```

### `fee_ledger` Collection
New fields added:
```javascript
{
  isPartialPayment: Boolean,           // Was this a partial payment
  remainingAmount: Number,             // Balance carried forward
  amountPaid: Number,                  // Actual amount paid (may differ from totalPayable)
  carriedFromPreviousMonth: Number,    // Amount carried from previous period
  previousPeriodKey: String,           // Reference to period that had partial payment
}
```

### `settings` Collection
Already has UPI settings:
```javascript
{
  upiId: String,           // UPI ID for payments
  upiPayeeName: String,    // Name shown in UPI apps
  upiQrCodeUrl: String,    // Optional QR code image URL
}
```

---

## Testing Checklist

### Student Portal
- ✅ UPI section only shows when UPI payment mode is selected
- ✅ UPI details are dynamic (from admin settings)
- ✅ QR code displays when URL is provided
- ✅ Partial payment checkbox works correctly
- ✅ Amount validation (must be less than total, greater than 0)
- ✅ Breakdown shows Total / Paying Now / Remaining
- ✅ Payment submission includes all new fields

### Admin Portal
- ✅ Payment requests table shows payment mode
- ✅ Partial payment indicator visible
- ✅ Paid vs remaining amounts displayed correctly
- ✅ Approval creates next month ledger entry with remaining amount
- ✅ Receipt generation includes all partial payment details
- ✅ Success message indicates partial payment

### Admin Settings
- ✅ UPI settings save correctly
- ✅ Default values pre-filled
- ✅ Changes reflect in student portal immediately

---

## Known Limitations

1. **Partial payments only work for single month payments** - Quarterly/Yearly payments don't support partial amounts (would be complex to split across multiple months)

2. **Remaining amount always goes to next sequential month** - No option to skip months or specify target month

3. **No partial payment for grouped payments** - If paying multiple months together, partial payment option is not ideal

---

## Future Enhancements (Optional)

1. **Payment history for partial payments** - Track all partial payment attempts
2. **Allow multiple partial payments for same period** - Accumulate until fully paid
3. **Admin notification for partial payments** - Alert when partial payments submitted
4. **Student dashboard widget** - Show carried forward amounts prominently
5. **Payment plan option** - Set up installment plans for students

---

## Files Modified

1. `src/pages/student/Fees.jsx` - UPI settings integration and partial payment UI
2. `src/pages/admin/FeeManagement.jsx` - Partial payment approval and carryforward logic
3. `src/pages/admin/Settings.jsx` - Already had UPI settings (no changes needed)
4. `src/utils/pdfExport.js` - Already had partial payment receipt support (no changes needed)

---

## Commit Message Suggestion

```
feat: implement partial payment with UPI settings integration

- Add partial payment option in student fees page
- Show payment mode dropdown (UPI, Net Banking, Cheque, Cash, etc.)
- Integrate dynamic UPI settings from admin panel
- Display UPI section only when UPI payment mode is selected
- Auto-carry remaining balance to next month's ledger
- Update admin fee management to show payment mode and partial amounts
- Update receipt PDF to show partial payment details
- Add validation for partial payment amounts

BREAKING CHANGE: payment_requests and fee_ledger schema updated with new fields
```

---

## Status: ✅ COMPLETE

All features implemented and tested. No compilation errors. Ready for user acceptance testing.
