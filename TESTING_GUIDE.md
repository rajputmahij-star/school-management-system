# Testing Guide - School Management System Features
**Date:** July 10, 2026

---

## 🎯 Quick Start

**Dev Server:** http://localhost:3000/

**Test Credentials:**
- Admin: Check your `.env` file for admin credentials
- Student: Use existing student accounts or create via admin panel

---

## 1️⃣ Test Partial Payment Feature

### Steps:
1. **Login as Student**
2. Navigate to **Dashboard** → Click **Pay Fees** button
3. Select **Monthly** payment mode
4. Select year **2026** and any unpaid month (e.g., July)
5. Select payment mode: **Net Banking**, **Cheque**, **Cash**, or **Debit Card**
6. **Check the "Pay Partial Amount" checkbox**
7. Enter a partial amount (e.g., if fee is ₹5,000, enter ₹3,000)

### Expected Results:
- ✅ Should show three-line breakdown:
  - Total Fee: ₹5,000
  - Paying Now: ₹3,000
  - Remaining: ₹2,000
- ✅ Purple note saying "Remaining amount will be added to your next month's fee"
- ✅ Form validates: Amount must be less than total

8. Enter Reference ID, Payment Date, and Remarks
9. Click **Submit Payment Request**

### Admin Verification:
10. **Login as Admin**
11. Navigate to **Fee Management**
12. Find the pending request
13. Should show **"Partial Payment"** tag under billing period
14. Should display:
    - Base Amount: ₹5,000
    - Paid Amount: ₹3,000 (in green)
    - Total to Approve: ₹3,000
    - Remaining: ₹2,000 (in orange)
15. Click **Approve**
16. Receipt number generated (format: 26270710261430001)

### Verify Carryforward:
17. Go back to Student account
18. Try to pay for **next month** (e.g., August)
19. ✅ Fee for August should show ₹2,000 more than normal
20. Example: If normal fee is ₹5,000, should show ₹7,000

---

## 2️⃣ Test UPI Payment Integration

### Test "Pay via Link":
1. **Login as Student**
2. Click **Pay Fees**
3. Select **Monthly** mode, year **2026**, any unpaid month
4. Select payment mode: **UPI**
5. **Do NOT check partial payment**

### Expected Results:
- ✅ Blue UPI payment section appears
- ✅ Two tabs: "Pay via Link" and "Scan QR Code"
- ✅ "Pay via Link" is selected by default
- ✅ Shows UPI ID: `anandspecialschoolsurat@sbi`
- ✅ Shows full UPI payment URL (copyable):
  ```
  upi://pay?pa=anandspecialschoolsurat@sbi&pn=School&am=5000&cu=INR&tn=Fee%20Payment...
  ```
- ✅ Copy button next to UPI ID (click to test)
- ✅ Copy button next to UPI URL (click to test)
- ✅ Blue "Pay ₹5,000 via UPI" button
- ✅ Note: "Click to open your UPI app (PhonePe, GPay, Paytm, etc.)"

6. Click the **blue pay button** (if on mobile, should open UPI apps)
7. On desktop, copy the UPI URL and paste in mobile to test

### Test "Scan QR Code":
8. Click **"Scan QR Code"** tab

### Expected Results:
- ✅ QR code image should display (if admin configured it)
- ✅ Shows "Amount to Pay: ₹5,000"
- ✅ Shows UPI ID for manual entry
- ✅ Copy button for UPI ID
- ✅ Note: "Open any UPI app and scan the QR code above"

9. If QR code not configured:
- ✅ Should show yellow warning: "QR Code not available. Please use 'Pay via Link' option..."

### Admin Configuration Check:
10. **Login as Admin**
11. Navigate to **Settings**
12. Scroll to **UPI Settings** section
13. Verify fields:
    - UPI ID: `anandspecialschoolsurat@sbi`
    - UPI Payee Name: (configured name)
    - UPI QR Code URL: (image URL from Imgur/ImgBB)
14. Try updating values and save
15. Go back to student view and verify changes appear

---

## 3️⃣ Test Credit Card Payment Gateway

### Steps:
1. **Login as Student**
2. Click **Pay Fees**
3. Select **Monthly** mode, year **2026**, any unpaid month
4. Select payment mode: **Credit Card**
5. **Do NOT check partial payment**

### Expected Results:
- ✅ Purple Credit Card payment section appears
- ✅ Shows purple card icon
- ✅ Title: "Pay via Credit Card"
- ✅ Subtitle: "Secure Online Payment Gateway"
- ✅ Shows "Amount to Pay: ₹5,000"
- ✅ Purple button: "Open Credit Card Payment Page" with external link icon
- ✅ Security badges showing: "Secure" and "SSL Encrypted"
- ✅ List of accepted cards: Visa, Mastercard, RuPay, Amex (not visible but in code)

6. Click **"Open Credit Card Payment Page"** button

### Expected Results:
- ✅ Opens `https://rzp.io/rzp/anandspecialschoolpaymentpage` in new tab
- ✅ Razorpay payment page should load
- ✅ Can test with Razorpay test cards

7. Complete test payment (if using test mode)
8. Note transaction/reference ID
9. Return to original tab
10. Enter reference ID, payment date, remarks
11. Submit for verification

---

## 4️⃣ Test Default Year Selection

### Steps:
1. **Login as Student**
2. Click **Pay Fees**
3. Observe the **Year** dropdown

### Expected Results:
- ✅ Default selected year should be **2026** (current year)
- ✅ NOT 2027 (which was the bug)
- ✅ Should auto-select current year if available in list
- ✅ If current year not in list, selects first available year

4. Change year dropdown to different years
5. Verify month list updates correctly
6. Switch between Monthly/Quarterly/Yearly modes
7. Verify year selection persists appropriately

---

## 5️⃣ Test Yearly Payment Coverage

### Steps:
1. **Login as Student**
2. Click **Pay Fees**
3. Select **Yearly** payment mode
4. Select year **2026**
5. Select **December** as starting month

### Expected Results:
- ✅ Should show preview of months to be paid
- ✅ Should include months: Dec 2026 → Nov 2027 (11 months)
- ✅ Should NOT stop at May (old academic year logic)
- ✅ Shows "Yearly Payment — Paying for 11 month(s) now"
- ✅ Lists all 11 consecutive unpaid months
- ✅ Amount calculated correctly

6. Try selecting different starting months:
   - Select **January** → Should cover Jan → Dec
   - Select **June** → Should cover Jun → May next year
   - Select **March** → Should cover Mar → Feb next year

### Expected Results:
- ✅ Always picks 11 consecutive unpaid months (12 months coverage, pay for 11)
- ✅ Not limited to June-May academic year
- ✅ Rolling 12-month coverage from any starting point

### Important Note:
- Display currently shows actual available unpaid months (8-11 typically)
- This is because system generates periods dynamically
- User pays for 11 months, gets 12 months coverage (1 month free)

---

## 6️⃣ Test Receipt Number Generation

### Steps:
1. **Login as Student**
2. Submit a payment request (any mode)
3. **Login as Admin**
4. Go to **Fee Management**
5. Find the pending request
6. Click **Approve**

### Expected Results:
- ✅ Success toast shows receipt number (e.g., "Receipt: 26270710261430001")
- ✅ Receipt number format breakdown:
  - **2627** - Academic year 2026-27 (April to March)
  - **0710** - July 10 (DDMM)
  - **26** - Year 2026 (YY)
  - **1430** - Time 14:30 (HHMM)
  - **001** - Sequence number

7. Approve another payment immediately

### Expected Results:
- ✅ Sequence should increment: **002**, **003**, etc.
- ✅ Date and time should update
- ✅ Academic year stays 2627 (until April 2027)

### Check Receipt:
8. Student can download receipt
9. Verify receipt shows correct receipt number
10. Check Firestore database:
    - Collection: `receipt_counters`
    - Document should exist with current counters

---

## 7️⃣ Test Integration Scenarios

### Scenario A: Partial Payment → Carryforward → Full Payment
1. Submit partial payment for July (₹3,000 of ₹5,000)
2. Admin approves
3. Check August fee → Should show ₹7,000 (₹5,000 + ₹2,000 carried)
4. Pay full ₹7,000 for August
5. Admin approves
6. Check September fee → Should be back to normal ₹5,000

### Scenario B: UPI Payment → Change to Credit Card
1. Start payment flow, select UPI
2. Verify UPI section appears
3. Change payment mode to Credit Card
4. Verify Credit Card section appears, UPI section hidden
5. Change to Partial Payment checkbox
6. Verify both UPI and Credit Card sections hidden

### Scenario C: Quarterly with Partial Payment
1. Select Quarterly mode
2. Select starting month
3. Should show 3 months preview
4. Enable partial payment
5. Verify UPI/Credit Card sections do NOT appear
6. Submit partial amount for 3 months
7. Admin approves
8. Remaining should carry to 4th month (not split across 3)

### Scenario D: Yearly Payment Full Flow
1. Select Yearly mode
2. Select any starting month
3. Verify 11 months listed
4. Calculate total (should be 11 × monthly fee + any fines)
5. Select UPI payment
6. Complete UPI payment
7. Submit with reference ID
8. Admin approves
9. Verify all 11 months marked as paid
10. Receipt generated with correct total

---

## 🎨 Visual Verification Checklist

### UI Elements:
- [ ] Payment modal scrolls properly on mobile
- [ ] Month lists are touch-friendly
- [ ] Color coding: Green (paid), Orange (selected), Red (unpaid)
- [ ] Dark mode works for all new sections
- [ ] UPI section is blue-themed
- [ ] Credit Card section is purple-themed
- [ ] Partial payment section is purple-themed
- [ ] Buttons have hover states
- [ ] Copy icons work smoothly
- [ ] External link icon shows for Credit Card button
- [ ] QR code displays at appropriate size

### Responsive Design:
- [ ] Test on mobile viewport (< 640px)
- [ ] Test on tablet viewport (640-1024px)
- [ ] Test on desktop viewport (> 1024px)
- [ ] Verify modal max-height on small screens
- [ ] Check scrolling behavior

---

## 🐛 Error Scenarios to Test

### Validation Errors:
1. Try submitting without selecting month → Error
2. Try submitting without reference ID → Error
3. Try submitting without payment date → Error
4. Try partial payment with amount ≥ total → Error
5. Try partial payment with zero/negative amount → Error
6. Try partial payment with non-numeric input → Should handle gracefully

### Edge Cases:
1. No unpaid months available → Should show appropriate message
2. QR code URL invalid/broken → Should show error or placeholder
3. Admin hasn't configured UPI → Should use fallback or hide section
4. Only 1 unpaid month left but select Quarterly → Should show only 1
5. Only 5 unpaid months left but select Yearly → Should show only 5
6. Student has advance payments → Yearly should skip paid months

### Network/Database:
1. Test with slow network (throttle in DevTools)
2. Test with offline mode → Should show appropriate errors
3. Test Firebase connection issues
4. Test concurrent admin approvals

---

## ✅ Success Criteria

All tests pass when:
- ✅ No console errors during any flow
- ✅ All UI elements render correctly
- ✅ Data persists correctly in Firestore
- ✅ Receipt numbers generate without collision
- ✅ Partial payments carry forward accurately
- ✅ UPI links open correctly
- ✅ Credit Card links open in new tab
- ✅ Yearly payment covers correct months
- ✅ Default year is current year
- ✅ Admin can approve/reject all payment types
- ✅ Dark mode works throughout
- ✅ Responsive design works on all viewports

---

## 📊 Database Verification

### Check Firestore Collections:

#### 1. Payment Requests (`payment_requests`)
```javascript
{
  studentId: "...",
  periodKey: "2026-07",
  billingPeriod: "July 2026",
  paymentMode: "UPI",
  baseAmount: 5000,
  lateFee: 0,
  totalAmount: 5000,
  paidAmount: 3000,  // For partial payments
  remainingAmount: 2000,  // For partial payments
  isPartialPayment: true,
  referenceId: "TXN123456",
  status: "Verification Pending",
  ...
}
```

#### 2. Fee Ledger (`fee_ledger`)
```javascript
{
  studentId: "...",
  periodKey: "2026-08",
  baseFee: 5000,
  fine: 0,
  totalPayable: 7000,  // 5000 + 2000 carried
  carriedFromPreviousMonth: 2000,
  previousPeriodKey: "2026-07",
  status: "Pending",
  ...
}
```

#### 3. Receipt Counters (`receipt_counters`)
```javascript
{
  academicYear: "2627",
  feeCounter: 42,
  salaryCounter: 15,
  lastUpdated: Timestamp
}
```

---

## 🎓 Testing Tips

1. **Use DevTools Console**: Watch for any warnings or errors
2. **Use React DevTools**: Inspect component state
3. **Use Network Tab**: Verify Firebase calls
4. **Use Firestore Console**: Check data structure
5. **Test Both Light/Dark Mode**: Toggle in settings
6. **Test Multiple Students**: Different fee structures
7. **Test Edge Times**: Near midnight for receipt number generation
8. **Clear Cache**: If seeing old code behavior
9. **Check Mobile**: Use real device, not just browser DevTools
10. **Document Issues**: Screenshot + console log + steps to reproduce

---

## 📱 Mobile-Specific Testing

### iOS Safari:
- UPI links may not work (UPI apps not common on iOS)
- QR code should display fine
- Credit Card link should work

### Android Chrome:
- UPI links should open UPI app picker
- Test with PhonePe, GPay, Paytm installed
- QR code scanning from other device

### Browser Compatibility:
- Chrome ✅
- Firefox ✅
- Safari ✅
- Edge ✅
- Mobile browsers ✅

---

**Happy Testing! 🚀**

Report any issues with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/videos
- Console errors
- Browser and device info
