export function DemoPaymentFields({ amountLabel }: { amountLabel: string }) {
  return <fieldset className="demo-payment" aria-describedby="demo-payment-note">
    <legend>פרטי תשלום</legend>
    <div className="demo-payment__notice"><strong>סביבת תשלום להמחשה</strong><span>לא מתבצע חיוב אמיתי ופרטי הכרטיס אינם נשמרים או נשלחים.</span></div>
    <div className="demo-payment__amount"><span>סכום לחיוב בהדגמה</span><strong>{amountLabel}</strong></div>
    <div className="demo-payment__grid">
      <label className="form-wide">שם בעל או בעלת הכרטיס<input name="demoCardholder" autoComplete="off" defaultValue="ישראל ישראלי" required /></label>
      <label className="form-wide">מספר כרטיס לבדיקה<input name="demoCardNumber" inputMode="numeric" autoComplete="off" defaultValue="4242 4242 4242 4242" pattern="[0-9 ]{19}" required /></label>
      <label>תוקף<input name="demoExpiry" inputMode="numeric" autoComplete="off" defaultValue="12/30" pattern="[0-9]{2}/[0-9]{2}" required /></label>
      <label>שלוש ספרות בגב הכרטיס<input name="demoCvv" inputMode="numeric" autoComplete="off" defaultValue="123" pattern="[0-9]{3}" required /></label>
    </div>
    <p id="demo-payment-note">אלה נתוני בדיקה בלבד. בחיבור הסופי שדות האשראי ייטענו ישירות מספק הסליקה המאושר ולא יעברו דרך האתר.</p>
  </fieldset>;
}
