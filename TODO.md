# Branding System Implementation TODO

## Backend Updates
- [ ] Update SystemSetting model to include appName, description, appleTouchIcon
- [ ] Update SystemSetting controller to handle new fields in updateSystemSetting

## Client-side API Integration
- [ ] Create client/src/utils/systemSetting.js for API fetch utility

## Global State Management
- [ ] Implement SystemSettingContext.jsx with React Context for global branding state
- [ ] Include fallback defaults if API fails

## App Integration
- [ ] Wrap App.jsx with context provider
- [ ] Fetch and apply settings on app mount/install/refresh

## Dynamic Head Updates
- [ ] Modify index.html to support dynamic title, favicon, apple-touch-icon updates

## PWA Manifest
- [ ] Create client/public/site.webmanifest with dynamic strategy

## Theme Colors
- [ ] Update tailwind.config.js to use CSS custom properties for colors
- [ ] Dynamically set CSS variables from API data

## Example Component
- [ ] Modify HeroSection.jsx to demonstrate theme color usage without inline styles

## Testing
- [ ] Test PWA install on Android, iOS, Desktop
- [ ] Verify dynamic updates on refresh
- [ ] Ensure no hardcoded colors in components
