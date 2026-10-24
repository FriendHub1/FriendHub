# XOXO Avenue — Multilingual Confirmation Email (BETA)

Status: NOT deployed. Production authentication unchanged.

Approved design: original XOXO Avenue logo, dark purple background, neon pink hearts, yellow confirmation button, and one row of official social icons (Facebook, X, Instagram, TikTok). No repeated social row or privacy-policy footer.

Languages: en, es, pt-BR, de, no, pl, fr, cs. Fallback: en.

## Integration requirements
1. Host the original logo and social assets at stable public HTTPS URLs.
2. On sign-up, pass the selected site locale in Supabase Auth user metadata:
```js
const allowed = ['en','es','pt-BR','de','no','pl','fr','cs'];
const language = allowed.includes(selectedLocale) ? selectedLocale : 'en';
await supabase.auth.signUp({
  email, password,
  options: {
    data: { language },
    emailRedirectTo: 'https://xoxoavenue.com'
  }
});
```
3. Supabase Auth > Email Templates > Confirm sign up: install the approved HTML email template, using Go template conditional branches based on `{{ .Data.language }}`. Always preserve `{{ .ConfirmationURL }}` for the confirmation link.
4. Test all eight language branches and fallback with controlled test registrations before any production activation.

Documentation: https://supabase.com/docs/guides/troubleshooting/customizing-emails-by-language-KZ_38Q
No actual emails have been sent or authentication settings modified.
