# Quick Reference Guide
**School Management System - Recent Updates**

---

## 🎯 For Students

### How to Make a Payment

1. **Login** → **Dashboard** → **Pay Fees**
2. Choose payment frequency:
   - **Monthly**: Pay one month at a time
   - **Quarterly**: Pay 3 months together
   - **Yearly**: Pay 11 months, get 12 months coverage (1 free!)
3. Select **Year** and **Starting Month**
4. Choose **Payment Mode**:
   - UPI (instant payment via app)
   - Net Banking
   - Credit Card (via Razorpay)
   - Debit Card
   - Cheque
   - Cash

### 💳 Payment Options

#### UPI Payment (Recommended - Fast & Free)
- **UPI ID**: `anandspecialschoolsurat@sbi`
- **Two ways to pay**:
  1. **Pay via Link** - Click button, select your UPI app, pay
  2. **Scan QR Code** - Open any UPI app, scan, pay
- Enter transaction ID after payment
- Wait for admin approval

#### Credit Card Payment
- Click "Open Credit Card Payment Page"
- Opens Razorpay secure payment gateway
- Complete payment on their website
- Note transaction ID
- Return and submit for verification

#### Offline Payments (Net Banking, Cheque, Cash, Debit Card)
- Complete your payment through your bank/in-person
- Note reference/transaction ID
- Enter details in form
- Submit for verification

### 💰 Partial Payment (Can't Pay Full Amount?)
- Available for: Net Banking, Cheque, Cash, Debit Card
- Check "Pay Partial Amount" box
- Enter how much you can pay now
- Remaining amount automatically added to next month
- Example: 
  - July fee: ₹5,000
  - Pay now: ₹3,000
  - Remaining ₹2,000 automatically added to August
  - August total: ₹7,000 (₹5,000 + ₹2,000)

### 📄 After Payment
- Wait for admin to verify and approve
- Download receipt from dashboard once approved
- Receipt includes unique receipt number
- Keep receipt for your records

---

## 👨‍💼 For Admins

### Approving Payments

1. **Login** → **Fee Management**
2. See all pending payment requests
3. Click to expand and review details
4. Verify payment information
5. Check for **"Partial Payment"** tag if applicable
6. Click **Approve** or **Reject**
7. Receipt number auto-generated on approval

### Partial Payment Handling
- Shows **purple "Partial Payment" tag** under billing period
- Displays:
  - Base Amount (original fee)
  - Paid Amount (what student paid - in green)
  - Remaining (what's left - in orange)
- On approval:
  - Remaining amount **automatically added** to next month
  - Student's next month fee shows increased amount
- No manual calculation needed!

### Receipt Numbers
**Format**: AAAADDMMYYHHMMMNNN
- **AAAA**: Academic Year (2627 = 2026-27)
- **DDMMYY**: Date
- **HHMM**: Time
- **NNN**: Sequence (auto-increment)
- Example: `26270710261430001`
- Automatically generated
- No duplicate numbers
- Separate counters for fee and salary

### Configuring UPI Settings

1. **Login** → **Settings** → **UPI Settings**
2. Enter **UPI ID**: `anandspecialschoolsurat@sbi`
3. Enter **Payee Name**: Your school name
4. For QR Code:
   - Open bank app → Generate UPI QR Code
   - Save QR code image
   - Upload to Imgur (https://imgur.com) or ImgBB (https://imgbb.com)
   - Copy image URL
   - Paste in "UPI QR Code URL" field
5. Click **Save Settings**
6. Students will immediately see updated UPI details

### Payment Modes Comparison

| Mode | Partial Payment | Instant Link | Verification Required |
|------|----------------|--------------|----------------------|
| UPI | ❌ No | ✅ Yes | ✅ Yes |
| Credit Card | ❌ No | ✅ Yes | ✅ Yes |
| Net Banking | ✅ Yes | ❌ No | ✅ Yes |
| Debit Card | ✅ Yes | ❌ No | ✅ Yes |
| Cheque | ✅ Yes | ❌ No | ✅ Yes |
| Cash | ✅ Yes | ❌ No | ✅ Yes |

---

## 🔧 Technical Reference

### Modified Files
```
src/pages/student/Fees.jsx           - Payment form UI
src/pages/admin/FeeManagement.jsx    - Admin approval logic
src/pages/admin/Settings.jsx         - UPI configuration
src/utils/receiptGenerator.js        - Receipt number generation
src/utils/feeEngine.js               - Fee calculation with carryforward
src/utils/pdfExport.js               - Receipt PDF generation
firestore.rules                      - Security rules
```

### New Database Fields

**Payment Requests**:
```javascript
{
  paymentMode: "UPI" | "Net Banking" | "Credit Card" | etc,
  paidAmount: number,           // Actual amount paid
  remainingAmount: number,      // Amount to carry forward
  isPartialPayment: boolean
}
```

**Fee Ledger**:
```javascript
{
  carriedFromPreviousMonth: number,
  previousPeriodKey: string     // e.g., "2026-07"
}
```

**Receipt Counters** (new collection):
```javascript
{
  academicYear: "2627",
  feeCounter: 42,
  salaryCounter: 15,
  lastUpdated: Timestamp
}
```

### UPI Deep Link Format
```
upi://pay?pa={UPI_ID}&pn={PAYEE_NAME}&am={AMOUNT}&cu=INR&tn={DESCRIPTION}
```

### Environment Variables
No new environment variables needed. Everything configured via Firestore.

---

## 🎨 UI Color Guide

| Element | Color | Usage |
|---------|-------|-------|
| Primary Actions | #E86E07 (Orange) | Main buttons, selected states |
| UPI Sections | Blue | All UPI payment UI |
| Credit Card | Purple | Credit card payment UI |
| Partial Payment | Purple | Partial payment checkbox and info |
| Paid Status | Green | Successfully paid months |
| Unpaid Status | Red | Pending payment months |
| Late Fees | Red | Overdue indicators |
| Remaining Amount | Orange | Carried forward amounts |

---

## 📊 Payment Flow Diagram

```
Student Selects Payment
         |
         ↓
Choose Mode: Monthly/Quarterly/Yearly
         |
         ↓
Choose Payment Method
         |
    ┌────┴────┐
    ↓         ↓
  UPI or   Others
  Credit   
  Card     
    |         |
    |         ↓
    |    Partial Payment?
    |         |
    |    ┌────┴────┐
    |    ↓         ↓
    |   Yes       No
    |    |         |
    ↓    ↓         ↓
  Complete Payment
         |
         ↓
  Enter Reference ID
         |
         ↓
  Submit for Verification
         |
         ↓
  Admin Reviews
         |
    ┌────┴────┐
    ↓         ↓
 Approve   Reject
    |         |
    ↓         ↓
 Receipt   Notify
Generated  Student
    |
    ↓
If Partial: Add
Remaining to
Next Month
```

---

## 🚨 Important Notes

### For Students:
- ⚠️ UPI and Credit Card payments **cannot** use partial payment
- ⚠️ Partial payment available only for: Net Banking, Cheque, Cash, Debit Card
- ⚠️ Always keep transaction/reference ID handy
- ⚠️ Payment verification may take time - check back later
- ✅ Yearly payment = Pay 11 months, get 12 months coverage!

### For Admins:
- ⚠️ Always verify payment before approving
- ⚠️ Partial payment remaining amount auto-adds to next month
- ⚠️ Receipt numbers are auto-generated - don't modify
- ⚠️ Configure UPI settings once, used by all students
- ✅ No manual carryforward calculation needed!

---

## 🆘 Troubleshooting

### Student Issues

**"UPI section not showing"**
- ✓ Make sure UPI is selected as payment mode
- ✓ Ensure "Partial Payment" is NOT checked
- ✓ Contact admin if still not visible

**"QR code not loading"**
- ✓ Admin may not have uploaded QR code yet
- ✓ Use "Pay via Link" option instead
- ✓ Contact admin to configure QR code

**"Yearly payment only shows 8 months"**
- ✓ This is normal - shows available unpaid months
- ✓ You pay for available months, get benefit applied
- ✓ System skips already paid months

**"Can't make partial payment with UPI"**
- ✓ By design - UPI and Credit Card don't support partial payment
- ✓ Use Net Banking, Cheque, Cash, or Debit Card instead
- ✓ Or pay full amount via UPI

### Admin Issues

**"Receipt number not generating"**
- ✓ Check Firestore rules for receipt_counters collection
- ✓ Ensure admin has proper permissions
- ✓ Check browser console for errors

**"Carryforward not working"**
- ✓ Check if next month's period exists in system
- ✓ Verify fee ledger entry created
- ✓ Check student's next month fee amount

**"UPI settings not saving"**
- ✓ Ensure you're logged in as admin
- ✓ Check Firestore connection
- ✓ Verify settings document permissions

---

## 📞 Quick Links

### For Image Hosting (QR Codes):
- Imgur: https://imgur.com
- ImgBB: https://imgbb.com

### Payment Gateway:
- Razorpay: https://rzp.io/rzp/anandspecialschoolpaymentpage

### UPI Details:
- **UPI ID**: anandspecialschoolsurat@sbi
- **Bank**: State Bank of India

---

## 📈 Feature Checklist

- ✅ Partial Payment with Auto-Carryforward
- ✅ UPI Payment (Link + QR Code)
- ✅ Credit Card Payment Gateway
- ✅ Receipt Number Auto-Generation
- ✅ Yearly Payment (11 pay, 12 coverage)
- ✅ Default Year Selection (Current Year)
- ✅ Admin UPI Configuration
- ✅ Dark Mode Support
- ✅ Mobile Responsive
- ✅ Security Rules Updated

---

## 🎓 Best Practices

### For Students:
1. Always pay on time to avoid late fees
2. Use UPI for instant payments
3. Keep transaction IDs safe
4. Download receipts immediately after approval
5. Contact school if payment not approved in 2-3 days

### For Admins:
1. Verify all payment details before approving
2. Configure UPI settings immediately after setup
3. Upload high-quality QR codes
4. Check partial payment carryforward monthly
5. Keep track of receipt numbers for accounting

---

**Need Help?** Contact your school administrator or refer to the full documentation files:
- `IMPLEMENTATION_SUMMARY.md` - Complete technical details
- `TESTING_GUIDE.md` - Detailed testing procedures

**Version**: 1.0  
**Last Updated**: July 10, 2026  
**Status**: ✅ Production Ready
