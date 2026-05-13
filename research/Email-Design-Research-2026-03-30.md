# Email Design Research — March 30, 2026

## Key Findings Summary

### Best Free Tools
- **MJML** — best developer email framework, compiles to Gmail/Outlook-safe HTML. Free, open source.
- **SENDUNE** — open source email builder, zero limits, no signup
- **Stripo** — drag-and-drop builder, 4 free exports/month
- **Canva** — best for email header images/banners, free tier

### What Works in Gmail/Outlook (VERIFIED safe)
- Inline styles, tables for layout, border-radius, background colors
- Gradients (with solid color fallback for Outlook)
- Images (host externally, include alt text)
- Web-safe fonts: Arial, Georgia, Verdana, Trebuchet MS

### What BREAKS in Gmail/Outlook
- Flexbox, CSS Grid — broken everywhere in email
- Custom web fonts — not reliable
- Animations — stripped
- Media queries — no support in desktop Gmail
- Background images — broken in Outlook (uses Word rendering engine)

### Testing (Free)
- **mail-tester.com** — spam score checker, free
- **Postdrop** — visual preview across clients, free
- Send test to your own Gmail + Outlook before any campaign

### Deliverability Critical Items
- SPF/DKIM/DMARC must be set up for bunncom.com domain
- Text-to-image ratio: 60% text / 40% images
- Avoid spam trigger words: "free", "act now", "limited time"
- Domain warmup: don't send 18K emails day one. Start with 50, then 100, then 200, ramp up over 2-3 weeks

### Recommended Approach
1. Design in MJML or Canva
2. Test with mail-tester.com + Postdrop
3. Send test to personal Gmail + Outlook
4. Set up SPF/DKIM/DMARC before any real sends
5. Warm up domain gradually — 50 → 100 → 200 → 500 → 1000
