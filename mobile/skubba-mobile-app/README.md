# SKUBBA Mobile App Source Pack

This folder contains the application source for the SKUBBA companion app described in the project plan. It is designed to be copied into an existing Expo Router + TypeScript project created with `create-expo-app`.

## Included prototype features

- Welcome screen
- Demo login screen
- Bottom-tab navigation
- Home dashboard
- Scan history
- Dynamic scan detail pages
- Morning/evening routine suggestions
- Curated-product UI placeholders
- Profile/privacy screen
- Typed scan/product data models
- Mock scan data so mobile work can continue before the backend is finished
- Placeholder auth/API services ready to be replaced by Supabase/FastAPI integration

## Install/use

1. Create or open your Expo project.
2. Copy the folders in this source pack into the project root, replacing the default `app` folder if necessary.
3. Make sure Expo Router and Expo vector icons are installed. They are normally included in the default Expo Router template.
4. Start Expo:

   ```powershell
   npx expo start
   ```

5. Open with Expo Go, web, or your Android emulator.

## Expected project structure

```
app/
  _layout.tsx
  index.tsx
  login.tsx
  (tabs)/
    _layout.tsx
    home.tsx
    history.tsx
    routine.tsx
    profile.tsx
  scan/
    [id].tsx
components/
data/
types/
services/
constants/
```

## Backend handoff contract

The app currently expects scan objects shaped like `types/scan.ts`. Your backend team should either return those field names directly or map backend records to this format in `services/api.ts`.

Important planned fields include:
- scan/user IDs
- timestamp
- model version
- primary condition
- classifier confidence
- AI summary and observations
- morning/evening routines
- product categories
- optional image expiration timestamp

## Next integration steps

1. Replace `services/auth.ts` with Supabase Auth.
2. Replace `services/api.ts` mock data with your FastAPI endpoints.
3. Replace `mockProducts.ts` with the team's curated product database/API.
4. Add loading/error states around network calls.
5. Add user-to-mirror pairing (QR code or one-time code).
6. Add progress charts only after deciding on a validated metric; classifier confidence should not be presented as medical severity.
